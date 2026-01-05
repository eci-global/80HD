"""
Complexity-based Router for LiteLLM Proxy

This module classifies incoming prompts by complexity and routes them
to the appropriate Claude model:
  - SIMPLE → Haiku (fast, cheap)
  - MODERATE → Sonnet (balanced)
  - COMPLEX → Opus (most capable)

The classifier uses Haiku itself (fast/cheap) to analyze prompts.

Key design decisions:
  - Bias toward SIMPLE: When in doubt, use Haiku
  - Content over length: Long prompts aren't necessarily complex
  - Conservative Opus usage: Only for genuine architecture/planning tasks
"""

import asyncio
import logging
from logging.handlers import RotatingFileHandler
import time
import os
import subprocess
from collections import deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import hashlib
import random
import json
import re
import math

with open(__file__, "rb") as _router_fp:
    ROUTER_BUILD_ID = hashlib.sha256(_router_fp.read()).hexdigest()[:12]

# ============================================================
# REPO REGISTRY (Portable, Multi-Repo Support)
# ============================================================

class RepoRegistry:
    """
    In-memory registry mapping logical repo names to repo roots.
    This allows the proxy to resolve repo context without assuming filesystem layout.
    """
    def __init__(self):
        self._repos: Dict[str, Path] = {}

    def register(self, repo: str, repo_root: str):
        path = Path(repo_root).expanduser().resolve()
        if not path.exists():
            raise ValueError(f"repo_root does not exist: {repo_root}")
        self._repos[repo] = path
        logger.info(f"🗂️  Registered repo '{repo}' → {path}")

    def resolve(self, repo: str) -> Optional[Path]:
        return self._repos.get(repo)


# Global registry instance
_repo_registry = RepoRegistry()

from litellm.integrations.custom_logger import CustomLogger
try:
    from langfuse import Langfuse
except ImportError:  # pragma: no cover - optional dependency
    Langfuse = None

try:
    from llm_tracekit import setup_export_to_coralogix
    from opentelemetry import trace as ot_trace
    from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
        OTLPSpanExporter,  # type: ignore
    )
except ImportError:  # pragma: no cover - optional dependency
    setup_export_to_coralogix = None
    ot_trace = None
    BatchSpanProcessor = None  # type: ignore
    OTLPSpanExporter = None  # type: ignore

# LiteLLMInstrumentor is optional (not all llm-tracekit versions have it)
try:
    from llm_tracekit import LiteLLMInstrumentor
except ImportError:  # pragma: no cover - optional in some versions
    LiteLLMInstrumentor = None
import litellm
from litellm.proxy.proxy_server import UserAPIKeyAuth, DualCache
from typing import Literal
# Add exception import for policy violation handling
from litellm.exceptions import BadRequestError

# Configure logging to both console and file
LOG_LEVEL_NAME = os.environ.get("COMPLEXITY_ROUTER_LOG_LEVEL", "INFO").upper()
LOG_LEVEL = getattr(logging, LOG_LEVEL_NAME, logging.INFO)

logger = logging.getLogger("complexity_router")
logger.setLevel(LOG_LEVEL)

# Remove existing handlers to avoid duplicates
logger.handlers.clear()

# Console handler (for immediate feedback)
console_handler = logging.StreamHandler()
console_handler.setLevel(LOG_LEVEL)
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# File handler with rotation (for persistent logging)
log_dir = os.path.dirname(os.path.abspath(__file__))
log_file = os.path.join(log_dir, "complexity_router.log")
file_handler = RotatingFileHandler(
    log_file,
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setLevel(LOG_LEVEL)
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

logger.info(f"📝 Router logging to: {log_file}")

import uuid

# ============================================================
# CONFIGURATION
# ============================================================

# Model mapping based on complexity classification
MODEL_MAP = {
    "SIMPLE": "claude-haiku-4-5",
    "MODERATE": "claude-sonnet-4-5",
    "COMPLEX": "claude-opus-4-5",
}

# The model used for classification (Haiku is fast and cheap)
CLASSIFIER_MODEL = "claude-haiku-4-5"

# Classification prompt - Routes code writing to Sonnet, architecture to Opus
# Sonnet performs better for code writing tasks
# Opus is better for architectural/engineering/multi-step planning
CLASSIFIER_PROMPT = """You are a task complexity classifier. Your job is to route requests to the appropriate model based on task type.

**IMPORTANT:**
- Code writing tasks → MODERATE (Sonnet performs better for code)
- Architectural/engineering tasks → COMPLEX (Opus for multi-step planning)
- Everything else → SIMPLE (Haiku for non-code tasks)

## Classification Rules:

### SIMPLE (Haiku - non-code tasks)
- Greetings, thanks, confirmations, acknowledgments
- Simple questions ("What is X?", "How do I Y?")
- Documentation lookup and explanations
- Reading/summarizing files
- Configuration file edits
- Tool result processing (just reading output)
- Simple syntax questions
- **Long prompts with simple non-code requests** (context length ≠ complexity)

### MODERATE (Sonnet - code writing tasks)
**Sonnet performs better for code writing than Opus. Use Sonnet for:**
- Writing functions, methods, classes
- Implementing features and functionality
- Code refactoring (single file or related files)
- Debugging code issues
- Writing unit tests and test cases
- API integrations and implementations
- Code reviews requiring detailed feedback
- Database query writing and optimization
- Writing scripts and automation
- **Any task that involves writing or modifying code**

### COMPLEX (Opus - architectural/engineering tasks)
**Opus is better for architectural thinking and multi-step planning. Use Opus for:**
- System architecture design from scratch
- Multi-step planning across multiple systems/components
- Complex migrations between frameworks/languages/platforms
- Security audits and vulnerability analysis requiring deep analysis
- Performance optimization requiring architectural decisions
- Trade-off analysis between multiple architectural approaches
- Building entirely new systems/features requiring planning
- **Tasks requiring extensive multi-step planning and architectural thinking**

## User Request:
{prompt}

## Decision Process:
1. Is this a code writing task? → MODERATE (Sonnet)
2. Is this architectural/engineering/multi-step planning? → COMPLEX (Opus)
3. Is this a simple non-code task? → SIMPLE (Haiku)
4. When uncertain between SIMPLE and MODERATE → SIMPLE
5. When uncertain between MODERATE and COMPLEX → MODERATE (prefer Sonnet for code)

Respond with ONLY one word: SIMPLE, MODERATE, or COMPLEX

Classification:"""

# Request capture configuration (opt-in, bounded per request)
REQUEST_CAPTURE_ENABLED = os.environ.get("LITELLM_CAPTURE_REQUESTS", "false").lower() == "true"
REQUEST_CAPTURE_DIR = Path(os.environ.get("LITELLM_CAPTURE_DIR", "/tmp/litellm_requests"))

_CAPTURE_HISTORY_SIZE = 2048
_captured_request_ids = set()
_capture_order = deque()

# Cache for session -> repo context (ttl in seconds)
SESSION_CACHE_TTL_SECONDS = int(os.environ.get("LITELLM_REPO_SESSION_TTL", "7200"))
SESSION_FILE_DIR = Path(os.environ.get("LITELLM_SESSION_DIR", "/tmp/claude_sessions"))
SESSION_FILE_TTL_SECONDS = int(os.environ.get("LITELLM_SESSION_TTL", "10800"))
_session_repo_cache: Dict[str, Dict[str, Any]] = {}
_session_repo_history: Dict[str, Dict[str, str]] = {}

# ============================================================
# COMPLEXITY OVERRIDE (Session-Bound Model Override)
# ============================================================
# Allows users to temporarily override complexity routing for their session.
# Example: "use opus for the next 5 minutes" forces COMPLEX classification.

COMPLEXITY_OVERRIDE_DEFAULT_TTL_MINUTES = int(os.environ.get("LITELLM_OVERRIDE_DEFAULT_TTL", "5"))
COMPLEXITY_OVERRIDE_MAX_TTL_MINUTES = int(os.environ.get("LITELLM_OVERRIDE_MAX_TTL", "60"))

# In-memory cache: session_id -> {"model": "opus"|"sonnet"|"haiku", "expires": datetime}
_complexity_override_cache: Dict[str, Dict[str, Any]] = {}

# Context protection configuration (tokens are approximate)
CONTEXT_SOFT_LIMIT_TOKENS = int(os.environ.get("LITELLM_CONTEXT_SOFT_LIMIT", "180000"))
CONTEXT_HARD_LIMIT_TOKENS = int(os.environ.get("LITELLM_CONTEXT_HARD_LIMIT", "200000"))
CONTEXT_BLOCK_LIMIT_TOKENS = int(os.environ.get("LITELLM_CONTEXT_BLOCK_LIMIT", "12000"))
CONTEXT_DUPLICATE_MIN_TOKENS = int(os.environ.get("LITELLM_CONTEXT_DUP_MIN", "800"))
ENFORCEMENT_OVERHEAD_TOKENS = int(os.environ.get("LITELLM_ENFORCEMENT_OVERHEAD", "400"))

_ledger_repo_raw = os.environ.get("LITELLM_LEDGER_REPOS", "*")
LEDGER_ENFORCEMENT_APPLY_ALL = _ledger_repo_raw.strip() in ("", "*")
LEDGER_ENFORCEMENT_REPOS = (
    {
        repo.strip().lower()
        for repo in _ledger_repo_raw.split(",")
        if repo.strip() and repo.strip() != "*"
    }
    if not LEDGER_ENFORCEMENT_APPLY_ALL
    else set()
)


def _mark_request_captured(request_id: str) -> bool:
    """Deduplicate capture attempts and bound memory usage."""
    if request_id in _captured_request_ids:
        return False
    _captured_request_ids.add(request_id)
    _capture_order.append(request_id)
    if len(_capture_order) > _CAPTURE_HISTORY_SIZE:
        oldest = _capture_order.popleft()
        _captured_request_ids.discard(oldest)
    return True


def _extract_session_id(metadata: Optional[Dict[str, Any]]) -> Optional[str]:
    if not metadata:
        return None
    user_id = metadata.get("user_id")
    if user_id and "account__session_" in user_id:
        return user_id.split("account__session_", 1)[1]
    return None


def _store_session_repo_context(session_id: str, repo: str, repo_root: Optional[str]):
    if not session_id or not repo:
        return
    if isinstance(repo_root, Path):
        repo_root = str(repo_root)
    _session_repo_cache[session_id] = {
        "repo": repo,
        "repo_root": repo_root,
        "expires": datetime.utcnow() + timedelta(seconds=SESSION_CACHE_TTL_SECONDS),
    }
    _session_repo_history[session_id] = {"repo": repo, "repo_root": repo_root}
    _write_session_file(session_id, repo, repo_root)
    # opportunistic cleanup
    expired = [sid for sid, info in _session_repo_cache.items() if info.get("expires") and info["expires"] < datetime.utcnow()]
    for sid in expired:
        _session_repo_cache.pop(sid, None)


def _get_session_repo_context(session_id: Optional[str]) -> Optional[Dict[str, str]]:
    if not session_id:
        return None
    info = _session_repo_cache.get(session_id)
    if not info:
        return None
    if info.get("expires") and info["expires"] < datetime.utcnow():
        _session_repo_cache.pop(session_id, None)
        return None
    return info


def _load_repo_context_from_session_file(session_id: Optional[str]) -> Optional[Dict[str, str]]:
    """Resolve repo context from a disk-backed session file keyed by user_id."""
    if not session_id:
        logger.info("🪪 Session file lookup skipped (missing session_id)")
        return None

    safe_id = re.sub(r"[^a-zA-Z0-9_.-]", "", session_id)
    if not safe_id:
        logger.warning(f"⚠️ Session file lookup failed to sanitize id | raw={session_id}")
        return None

    session_path = SESSION_FILE_DIR / f"{safe_id}.json"
    if not session_path.exists():
        history = _session_repo_history.get(session_id)
        if history and history.get("repo") and history.get("repo_root"):
            logger.info(f"📂 Session file missing, rewriting from cache | session={session_id}")
            _write_session_file(session_id, history["repo"], history["repo_root"])
            return {"repo": history["repo"], "repo_root": history["repo_root"]}
        logger.info(f"📂 Session file not found | path={session_path}")
        return None

    try:
        with open(session_path, "r") as f:
            payload = json.load(f)

        repo = payload.get("repo")
        repo_root = payload.get("repo_root")
        if repo and repo_root:
            _session_repo_history[session_id] = {"repo": repo, "repo_root": repo_root}
            refresh_needed = False
            if SESSION_FILE_TTL_SECONDS > 0:
                mtime = datetime.utcfromtimestamp(session_path.stat().st_mtime)
                if datetime.utcnow() - mtime > timedelta(seconds=SESSION_FILE_TTL_SECONDS):
                    refresh_needed = True
            if refresh_needed:
                logger.info(f"♻️ Session file expired, rewriting | session={session_id}")
                _write_session_file(session_id, repo, repo_root)
            logger.info(
                f"📁 Session file resolved | session={session_id} | repo={repo} | root={repo_root}"
            )
            return {"repo": repo, "repo_root": repo_root}
        logger.warning(
            f"⚠️ Session file missing repo data | session={session_id} | payload_keys={list(payload.keys())}"
        )
    except Exception as exc:
        logger.warning(f"⚠️ Failed to load session file for {session_id}: {exc}")

    return None


def _write_session_file(session_id: str, repo: str, repo_root: Optional[str]):
    if not session_id or not repo or not repo_root:
        return
    safe_id = re.sub(r"[^a-zA-Z0-9_.-]", "", session_id)
    if not safe_id:
        return
    SESSION_FILE_DIR.mkdir(parents=True, exist_ok=True)
    session_path = SESSION_FILE_DIR / f"{safe_id}.json"
    payload = {
        "repo": repo,
        "repo_root": str(repo_root),
        "timestamp": datetime.utcnow().isoformat(),
    }
    try:
        with session_path.open("w") as fp:
            json.dump(payload, fp, indent=2)
    except Exception as exc:
        logger.warning(f"⚠️ Failed to refresh session file {session_path}: {exc}")


# ============================================================
# COMPLEXITY OVERRIDE FUNCTIONS
# ============================================================

# Patterns to detect override commands in user messages
# Matches phrases like:
#   "use opus for 5 minutes"
#   "use sonnet for the next 10 min"
#   "switch to haiku for 15 minutes"
#   "force opus for this task"
#   "use opus" (no duration = default TTL)
_OVERRIDE_PATTERN = re.compile(
    r"""
    (?:use|switch\s+to|force|set)\s+              # action verb
    (opus|sonnet|haiku)                            # model name (group 1)
    (?:\s+(?:for|during)\s+                        # optional duration clause
        (?:the\s+next\s+)?                         # optional "the next"
        (\d+)\s*                                   # number (group 2)
        (?:min(?:ute)?s?|m)\b                      # unit
    )?
    """,
    re.IGNORECASE | re.VERBOSE
)

# Pattern to cancel/clear override
_CANCEL_OVERRIDE_PATTERN = re.compile(
    r"""
    (?:cancel|clear|stop|remove|disable|reset)\s+
    (?:the\s+)?
    (?:model\s+)?
    (?:override|routing|complexity)
    """,
    re.IGNORECASE | re.VERBOSE
)

# Map user-friendly names to complexity levels
_MODEL_NAME_TO_COMPLEXITY = {
    "opus": "COMPLEX",
    "sonnet": "MODERATE",
    "haiku": "SIMPLE",
}


def _parse_override_command(message: str) -> Optional[Dict[str, Any]]:
    """
    Parse a user message for complexity override commands.
    
    Returns:
        Dict with 'model', 'complexity', 'ttl_minutes' if override detected
        Dict with 'cancel': True if cancel command detected
        None if no override command found
    """
    if not message:
        return None
    
    # Check for cancel command first
    if _CANCEL_OVERRIDE_PATTERN.search(message):
        return {"cancel": True}
    
    match = _OVERRIDE_PATTERN.search(message)
    if not match:
        return None
    
    model_name = match.group(1).lower()
    duration_str = match.group(2)
    
    complexity = _MODEL_NAME_TO_COMPLEXITY.get(model_name)
    if not complexity:
        return None
    
    # Parse duration or use default
    if duration_str:
        ttl_minutes = min(int(duration_str), COMPLEXITY_OVERRIDE_MAX_TTL_MINUTES)
    else:
        ttl_minutes = COMPLEXITY_OVERRIDE_DEFAULT_TTL_MINUTES
    
    return {
        "model": model_name,
        "complexity": complexity,
        "ttl_minutes": ttl_minutes,
    }


def _set_complexity_override(session_id: str, complexity: str, ttl_minutes: int) -> None:
    """Store a complexity override for a session with TTL."""
    if not session_id:
        logger.warning("⚠️ Cannot set override without session_id")
        return
    
    expires = datetime.utcnow() + timedelta(minutes=ttl_minutes)
    _complexity_override_cache[session_id] = {
        "complexity": complexity,
        "expires": expires,
        "created": datetime.utcnow(),
        "ttl_minutes": ttl_minutes,
    }
    logger.info(
        f"🎛️ Complexity override SET | session={session_id[:12]}... | "
        f"complexity={complexity} | ttl={ttl_minutes}min | expires={expires.isoformat()}"
    )
    
    # Opportunistic cleanup of expired overrides
    _cleanup_expired_overrides()


def _get_complexity_override(session_id: Optional[str]) -> Optional[str]:
    """
    Get active complexity override for a session.
    
    Returns:
        Complexity level ("SIMPLE", "MODERATE", "COMPLEX") if override active
        None if no override or expired
    """
    if not session_id:
        return None
    
    override = _complexity_override_cache.get(session_id)
    if not override:
        return None
    
    # Check expiration
    if override.get("expires") and override["expires"] < datetime.utcnow():
        _complexity_override_cache.pop(session_id, None)
        logger.info(f"🎛️ Complexity override EXPIRED | session={session_id[:12]}...")
        return None
    
    return override.get("complexity")


def _cancel_complexity_override(session_id: str) -> bool:
    """Cancel an active complexity override for a session."""
    if not session_id:
        return False
    
    if session_id in _complexity_override_cache:
        _complexity_override_cache.pop(session_id)
        logger.info(f"🎛️ Complexity override CANCELLED | session={session_id[:12]}...")
        return True
    return False


def _cleanup_expired_overrides() -> None:
    """Remove expired overrides from cache."""
    now = datetime.utcnow()
    expired = [
        sid for sid, info in _complexity_override_cache.items()
        if info.get("expires") and info["expires"] < now
    ]
    for sid in expired:
        _complexity_override_cache.pop(sid, None)
        logger.debug(f"🧹 Cleaned expired override | session={sid[:12]}...")


def _get_override_remaining_seconds(session_id: Optional[str]) -> Optional[int]:
    """Get remaining seconds for an active override, or None if not active."""
    if not session_id:
        return None
    
    override = _complexity_override_cache.get(session_id)
    if not override:
        return None
    
    expires = override.get("expires")
    if not expires:
        return None
    
    remaining = (expires - datetime.utcnow()).total_seconds()
    return max(0, int(remaining)) if remaining > 0 else None


def _estimate_tokens_from_text(text: Optional[str]) -> int:
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))  # rough heuristic suitable for budgeting


def _normalize_message_text(message: Dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_result":
                    parts.append(str(block.get("content", "")))
                else:
                    parts.append(str(block))
            else:
                parts.append(str(block))
        return "\n".join(parts)
    return str(content) if content is not None else ""


def _build_ledger_reminder(repo: Optional[str], metadata: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    if not repo or (
        not LEDGER_ENFORCEMENT_APPLY_ALL
        and repo.lower() not in LEDGER_ENFORCEMENT_REPOS
    ):
        return None, None
    trimmed_flag = str(metadata.get("context_trimmed", "false")).lower() == "true"
    trimmed_count = metadata.get("context_trimmed_count", 0)
    risk = metadata.get("exhaustion_risk", "low")
    duplicates = metadata.get("duplicate_blocks_detected", 0)
    large_blocks = metadata.get("large_blocks_suppressed", 0)

    lines = [
        "Before working, rehydrate from README.md → Session Recovery Ledger.",
        "After any plan change / major decision / checkpoint, update README and AGENTS immediately.",
    ]
    alert_reason = None
    if trimmed_flag or trimmed_count or duplicates or large_blocks or risk in ("medium", "high"):
        alert_reason = "context_guard"
        lines.append(
            "Context guard intervened on this request. Summarize current progress in README before continuing."
        )

    reminder = f"LEDGER REMINDER ({repo}):\n- " + "\n- ".join(lines)
    return reminder, alert_reason


def _apply_context_exhaustion_protection(data: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    messages = data.get("messages") or []
    total_tokens = ENFORCEMENT_OVERHEAD_TOKENS
    duplicates = 0
    large_blocks = 0
    trimmed = False
    trimmed_count = 0
    seen_hashes = set()
    duplicated_indices = []

    # Pass 1: detect duplicates / large blocks and compute tokens
    for idx, message in enumerate(messages):
        text = _normalize_message_text(message)
        block_tokens = _estimate_tokens_from_text(text)

        if text and block_tokens >= CONTEXT_DUPLICATE_MIN_TOKENS:
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if digest in seen_hashes:
                duplicates += 1
                duplicated_indices.append(idx)
                stub = "[[Duplicate context removed at proxy; reference earlier block]]"
                messages[idx]["content"] = stub
                text = stub
                block_tokens = _estimate_tokens_from_text(stub)
            else:
                seen_hashes.add(digest)

        if text and block_tokens > CONTEXT_BLOCK_LIMIT_TOKENS:
            large_blocks += 1
            stub = (
                f"[[Block suppressed: {block_tokens} tokens exceeded {CONTEXT_BLOCK_LIMIT_TOKENS}. "
                "Please summarize upstream.]]"
            )
            messages[idx]["content"] = stub
            text = stub
            block_tokens = _estimate_tokens_from_text(stub)

        total_tokens += block_tokens

    # Pass 2: trimming if exceeding soft limit
    removal_indices: List[int] = []
    if total_tokens > CONTEXT_SOFT_LIMIT_TOKENS:
        candidates = []
        last_user_idx = None
        for i, msg in enumerate(messages):
            if msg.get("role") == "user":
                last_user_idx = i
        for i, msg in enumerate(messages):
            if msg.get("role") == "system":
                continue
            if last_user_idx is not None and i == last_user_idx:
                continue
            candidates.append((i, _estimate_tokens_from_text(_normalize_message_text(msg))))
        for idx_value, token_cost in candidates:
            if total_tokens <= CONTEXT_SOFT_LIMIT_TOKENS:
                break
            removal_indices.append(idx_value)
            total_tokens -= token_cost
        if removal_indices:
            removal_set = set(removal_indices)
            messages[:] = [m for i, m in enumerate(messages) if i not in removal_set]
            trimmed = True
            trimmed_count = len(removal_set)

    # Fail-safe hard limit
    if total_tokens > CONTEXT_HARD_LIMIT_TOKENS:
        refusal_message = (
            "This request exceeds the proxy's context capacity even after automatic trimming. "
            "Please summarize earlier files or send smaller chunks before retrying."
        )
        data["response"] = {
            "id": "context_exhaustion",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": refusal_message},
                    "finish_reason": "context_exhaustion",
                }
            ],
        }
        data["skip_llm_call"] = True
        data["do_not_route"] = True
        metadata = data.setdefault("metadata", {})
        metadata["context_tokens_estimated"] = total_tokens
        metadata["context_trimmed"] = trimmed
        metadata["context_trimmed_count"] = trimmed_count
        metadata["duplicate_blocks_detected"] = duplicates
        metadata["exhaustion_risk"] = "fatal"
        return {"refused": True}

    risk_ratio = total_tokens / CONTEXT_SOFT_LIMIT_TOKENS if CONTEXT_SOFT_LIMIT_TOKENS else 0
    if risk_ratio >= 1:
        risk_level = "high"
    elif risk_ratio >= 0.8:
        risk_level = "medium"
    else:
        risk_level = "low"

    metadata = data.setdefault("metadata", {})
    metadata["context_tokens_estimated"] = total_tokens
    metadata["context_trimmed"] = trimmed
    metadata["context_trimmed_count"] = trimmed_count
    metadata["duplicate_blocks_detected"] = duplicates
    metadata["large_blocks_suppressed"] = large_blocks
    metadata["exhaustion_risk"] = risk_level
    metadata["context_tokens_estimated"] = total_tokens
    # NOTE: Do NOT set data["litellm_params"] - it gets passed to providers
    # and causes "litellm_params: Extra inputs are not permitted" errors

    logger.info(
        f"🧱 Context guard | id={request_id} | tokens={total_tokens} | trimmed={trimmed_count} "
        f"| duplicates={duplicates} | risk={risk_level}"
    )

    return {"refused": False}


# ============================================================
# HELPER: Request snapshot capture (for forensic inspection)
# ============================================================
def capture_request_snapshot(request_id: str, data: dict):
    if not _mark_request_captured(request_id):
        logger.debug(f"🧷 Request already captured | id={request_id}")
        return

    try:
        REQUEST_CAPTURE_DIR.mkdir(parents=True, exist_ok=True)

        snapshot = {
            "request_id": request_id,
            "model": data.get("model"),
            "call_type": data.get("call_type"),
            "metadata": data.get("metadata"),
            "headers": data.get("headers"),
            "system": data.get("system"),
            "messages": data.get("messages"),
            "litellm_params": data.get("litellm_params"),
        }

        # Redact secrets
        if snapshot.get("headers"):
            for k in list(snapshot["headers"].keys()):
                if "auth" in k.lower() or "key" in k.lower():
                    snapshot["headers"][k] = "***REDACTED***"

        path = REQUEST_CAPTURE_DIR / f"{request_id}.json"
        import json
        with open(path, "w") as f:
            json.dump(snapshot, f, indent=2, default=str)

        logger.info(f"📸 Request captured | id={request_id} | file={path}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to capture request {request_id}: {e}")

# Cache settings
CACHE_TTL_SECONDS = 3600  # Cache classifications for 1 hour
MAX_CACHE_SIZE = 1000

# ============================================================
# LANGFUSE DATASET MANAGEMENT (PHASE 2)
# ============================================================

# Observability backend toggles
def _parse_backends(raw: str) -> set:
    """Parse OBS_BACKEND env var into a set of backend names.
    
    Supports:
      - Comma-separated: "langfuse,coralogix"
      - Keyword "both" or "all": expands to {"langfuse", "coralogix"}
      - Single backend: "langfuse" or "coralogix"
    """
    raw = raw.strip().lower()
    if raw in ("both", "all"):
        return {"langfuse", "coralogix"}
    return {item.strip() for item in raw.split(",") if item.strip()}


OBS_BACKENDS = _parse_backends(os.environ.get("OBS_BACKEND", "langfuse")) or {"langfuse"}
LANGFUSE_ENABLED = "langfuse" in OBS_BACKENDS
CORALOGIX_ENABLED = "coralogix" in OBS_BACKENDS

# Dataset name for storing routing classification decisions
DATASET_NAME = "routing_classification_decisions"

# Feature flag to enable/disable routing evaluation
ENABLE_ROUTING_EVALUATION = (
    LANGFUSE_ENABLED and os.environ.get("ENABLE_ROUTING_EVALUATION", "true").lower() == "true"
)

# Sampling rate for evaluation (0.0-1.0, default 1.0 = 100%)
EVALUATION_SAMPLING_RATE = float(os.environ.get("EVALUATION_SAMPLING_RATE", "1.0"))

# Lazy-init Langfuse client (initialized on first use)
_langfuse_client: Optional[Langfuse] = None


def get_langfuse_client() -> Optional[Langfuse]:
    """
    Get or create Langfuse client for dataset operations.

    Lazily initializes the client using environment variables:
    - LANGFUSE_PUBLIC_KEY
    - LANGFUSE_SECRET_KEY
    - LANGFUSE_HOST

    Returns:
        Langfuse client instance, or None if initialization fails
    """
    global _langfuse_client

    if not LANGFUSE_ENABLED:
        return None

    if Langfuse is None:
        logger.warning("⚠️  Langfuse SDK not installed; Langfuse backend disabled")
        return None

    if _langfuse_client is None:
        try:
            # Initialize Langfuse client (uses env vars automatically)
            _langfuse_client = Langfuse()

            # Ensure dataset exists (idempotent - won't duplicate if exists)
            _langfuse_client.create_dataset(
                name=DATASET_NAME,
                description="Routing classification decisions for LLM-as-a-Judge evaluation. "
                           "Each item contains the user prompt, classification decision, and routing outcome."
            )

            logger.info(f"🗂️  Langfuse evaluation dataset '{DATASET_NAME}' ready (sampling rate: {EVALUATION_SAMPLING_RATE*100:.0f}%)")

        except Exception as e:
            logger.warning(f"⚠️  Could not initialize Langfuse for evaluation: {e}")
            logger.warning("    Routing evaluation will be disabled")
            return None

    return _langfuse_client


# ============================================================
# CORALOGIX TELEMETRY (TOGGLEABLE)
# ============================================================

CORALOGIX_SERVICE_NAME = os.environ.get("CORALOGIX_SERVICE_NAME", "litellm-proxy")
CORALOGIX_APPLICATION_NAME = os.environ.get("CX_APPLICATION_NAME") or os.environ.get("CORALOGIX_APPLICATION_NAME", "litellm-proxy")
CORALOGIX_SUBSYSTEM_NAME = os.environ.get("CX_SUBSYSTEM_NAME") or os.environ.get("CORALOGIX_SUBSYSTEM_NAME", "complexity-router")
CORALOGIX_SAMPLE_RATE = float(os.environ.get("CORALOGIX_SAMPLE_RATE", "1.0"))
def _get_coralogix_token() -> Optional[str]:
    return (
        os.environ.get("CX_AI_TOKEN")
        or os.environ.get("CX_TOKEN")
        or os.environ.get("CX_SEND_DATA_TOKEN")
        or os.environ.get("CORALOGIX_TOKEN")
    )


CORALOGIX_TOKEN = _get_coralogix_token()
CORALOGIX_ENDPOINT = os.environ.get("CX_ENDPOINT")
CORALOGIX_LITELLM_INSTRUMENT = os.environ.get("CORALOGIX_LITELLM_INSTRUMENT", "false").lower() == "true"
CORALOGIX_FAIL_FAST = os.environ.get("CORALOGIX_FAIL_FAST", "true").lower() == "true"
CORALOGIX_DEBUG_COLLECTOR_ENDPOINT = os.environ.get("CORALOGIX_DEBUG_COLLECTOR_ENDPOINT")
CORALOGIX_DEBUG_COLLECTOR_INSECURE = os.environ.get("CORALOGIX_DEBUG_COLLECTOR_INSECURE", "true").lower() == "true"

if (
    CORALOGIX_ENABLED
    and CORALOGIX_FAIL_FAST
    and (not CORALOGIX_TOKEN or not CORALOGIX_ENDPOINT)
):
    raise SystemExit(
        "OBS_BACKEND includes 'coralogix' but CX_TOKEN/CX_ENDPOINT are missing. "
        "Set CORALOGIX_FAIL_FAST=false to bypass (not recommended)."
    )

_coralogix_tracer = None
_coralogix_instrumented = False
_coralogix_debug_tee = False


def _format_otlp_endpoint(endpoint: str, secure: bool) -> str:
    endpoint = endpoint.strip()
    if not endpoint:
        return endpoint
    if "://" in endpoint:
        return endpoint
    # Accept bare host:port without injecting an HTTP scheme (needed for gRPC OTLP)
    if ":" in endpoint and endpoint.split(":", 1)[1].isdigit():
        return endpoint
    scheme = "https" if secure else "http"
    return f"{scheme}://{endpoint}"


def _attach_debug_collector_tee():
    """Mirror spans to a local OTLP collector when debugging."""

    global _coralogix_debug_tee

    if _coralogix_debug_tee:
        return

    if not CORALOGIX_DEBUG_COLLECTOR_ENDPOINT:
        return

    if not (BatchSpanProcessor and OTLPSpanExporter and ot_trace):
        logger.warning(
            "⚠️  CORALOGIX_DEBUG_COLLECTOR_ENDPOINT set but opentelemetry SDK extras missing; tee disabled."
        )
        return

    provider = ot_trace.get_tracer_provider()
    if provider is None:
        logger.warning("⚠️  No tracer provider available; cannot mirror spans to debug collector.")
        return
    if not hasattr(provider, "add_span_processor"):
        logger.warning(
            "⚠️  Tracer provider %s does not support add_span_processor; skipping debug collector tee",
            type(provider).__name__,
        )
        return

    try:
        exporter = OTLPSpanExporter(
            endpoint=_format_otlp_endpoint(
                CORALOGIX_DEBUG_COLLECTOR_ENDPOINT, not CORALOGIX_DEBUG_COLLECTOR_INSECURE
            ),
            insecure=CORALOGIX_DEBUG_COLLECTOR_INSECURE,
        )
        logger.info(
            "🛰️  Attaching OTLP tee → %s (insecure=%s)",
            _format_otlp_endpoint(
                CORALOGIX_DEBUG_COLLECTOR_ENDPOINT, not CORALOGIX_DEBUG_COLLECTOR_INSECURE
            ),
            CORALOGIX_DEBUG_COLLECTOR_INSECURE,
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))
        _coralogix_debug_tee = True
        logger.info(
            "🛰️  Mirroring Coralogix spans to local OTLP collector at %s",
            CORALOGIX_DEBUG_COLLECTOR_ENDPOINT,
        )
    except Exception as exc:  # pragma: no cover - defensive guard
        logger.warning(f"⚠️  Failed to attach debug OTLP tee: {exc}")


def _init_coralogix_tracer():
    global _coralogix_tracer

    if _coralogix_tracer is not None:
        return _coralogix_tracer

    if not CORALOGIX_ENABLED:
        return None

    if not (setup_export_to_coralogix and ot_trace):
        logger.warning(
            "⚠️  Coralogix backend requested but llm-tracekit/opentelemetry not installed."
        )
        return None

    if not (CORALOGIX_TOKEN and CORALOGIX_ENDPOINT):
        logger.warning(
            "⚠️  Coralogix backend requested but CX_TOKEN/CX_ENDPOINT environment variables are missing."
        )
        return None

    try:
        setup_export_to_coralogix(
            service_name=CORALOGIX_SERVICE_NAME,
            application_name=CORALOGIX_APPLICATION_NAME,
            subsystem_name=CORALOGIX_SUBSYSTEM_NAME,
            coralogix_token=CORALOGIX_TOKEN,
            coralogix_endpoint=CORALOGIX_ENDPOINT,
        )

        global _coralogix_instrumented
        if CORALOGIX_LITELLM_INSTRUMENT and not _coralogix_instrumented:
            if LiteLLMInstrumentor is None:
                logger.warning(
                    "⚠️  CORALOGIX_LITELLM_INSTRUMENT=true but LiteLLMInstrumentor missing; skipping instrumentation."
                )
            else:
                os.environ.setdefault("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "true")
                try:
                    LiteLLMInstrumentor(
                        coralogix_token=CORALOGIX_TOKEN,
                        coralogix_endpoint=CORALOGIX_ENDPOINT,
                        application_name=CORALOGIX_APPLICATION_NAME,
                        subsystem_name=CORALOGIX_SUBSYSTEM_NAME,
                    ).instrument()
                    _coralogix_instrumented = True
                    logger.info(
                        "📡 LiteLLM instrumentation enabled for Coralogix (note: acompletion calls are not instrumented per vendor docs)"
                    )
                except Exception as inst_exc:
                    logger.warning(f"⚠️  Failed to instrument LiteLLM for Coralogix: {inst_exc}")

        _attach_debug_collector_tee()
        _coralogix_tracer = ot_trace.get_tracer("litellm-proxy.coralogix")
        logger.info("📡 Coralogix telemetry sink enabled")
    except Exception as exc:
        logger.warning(f"⚠️  Failed to initialize Coralogix exporter: {exc}")
        _coralogix_tracer = None

    return _coralogix_tracer


def _should_sample_coralogix() -> bool:
    if CORALOGIX_SAMPLE_RATE >= 1.0:
        return True
    if CORALOGIX_SAMPLE_RATE <= 0:
        return False
    return random.random() < CORALOGIX_SAMPLE_RATE


def record_coralogix_trace(span_name: str, attributes: Dict[str, Any]):
    tracer = _init_coralogix_tracer()
    if not tracer or not _should_sample_coralogix():
        return

    try:
        import json
        safe_attrs = {k: v for k, v in attributes.items() if v is not None}
        logger.info(
            "📄 Coralogix payload | span=%s | data=%s",
            span_name,
            json.dumps(safe_attrs, default=str)[:2000],
        )
        logger.debug(
            "🛰️  Coralogix span start | span=%s | tracer=%s",
            span_name,
            getattr(tracer, "__class__", type(tracer)).__name__,
        )
        with tracer.start_as_current_span(span_name) as span:
            for key, value in safe_attrs.items():
                span.set_attribute(key, value)
        logger.debug("🛰️  Coralogix span end | span=%s", span_name)
    except Exception as exc:
        logger.warning(f"⚠️  Failed to record Coralogix trace: {exc}")


def _compute_latency_ms(start_time: Any, end_time: Any) -> Optional[float]:
    try:
        return (end_time - start_time).total_seconds() * 1000
    except Exception:
        try:
            return (float(end_time) - float(start_time)) * 1000
        except Exception:
            return None


def _extract_response_text(response_obj: Any) -> Optional[str]:
    try:
        if response_obj is None:
            return None
        # Dataclass-style object with .choices
        choices = getattr(response_obj, "choices", None)
        if choices:
            choice = choices[0]
            if isinstance(choice, dict):
                message = choice.get("message") or {}
            else:
                message = getattr(choice, "message", None)
            content = None
            if isinstance(message, dict):
                content = message.get("content")
            elif message is not None:
                content = getattr(message, "content", None)
            if isinstance(content, list):
                return " ".join(
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                ).strip()
            if isinstance(content, str):
                return content
        # Dict-style response
        if isinstance(response_obj, dict):
            choices = response_obj.get("choices") or []
            if choices:
                message = choices[0].get("message", {})
                content = message.get("content")
                if isinstance(content, str):
                    return content
        return None
    except Exception:
        return None


# ============================================================
# CACHING
# ============================================================

class ClassificationCache:
    """Simple TTL cache for classifications to avoid redundant API calls."""
    
    def __init__(self, max_size: int = MAX_CACHE_SIZE, ttl: int = CACHE_TTL_SECONDS):
        self.cache: Dict[str, Tuple[str, float]] = {}
        self.max_size = max_size
        self.ttl = ttl
    
    def _hash_prompt(self, prompt: str) -> str:
        """Create a hash of the prompt for cache key."""
        # Use first 500 chars to avoid hashing huge prompts
        truncated = prompt[:500]
        return hashlib.md5(truncated.encode()).hexdigest()
    
    def get(self, prompt: str) -> Optional[str]:
        """Get cached classification if valid."""
        key = self._hash_prompt(prompt)
        if key in self.cache:
            classification, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                logger.debug(f"Cache hit for prompt (classification: {classification})")
                return classification
            else:
                # Expired
                del self.cache[key]
        return None
    
    def set(self, prompt: str, classification: str):
        """Cache a classification."""
        # Evict oldest entries if at capacity
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
        
        key = self._hash_prompt(prompt)
        self.cache[key] = (classification, time.time())


# Global cache instance
_cache = ClassificationCache()

# ============================================================
# PROJECT DETECTION
# ============================================================

# ============================================================
# HELPER: Extract repo context from appended system prompt
# ============================================================
from typing import Tuple

def extract_repo_context_from_system(data: dict) -> Optional[Tuple[str, str]]:
    """
    Extract repo context from an appended system prompt like:
    <!-- LITELLM_CONTEXT repo=foo repo_root=/path -->
    Supports both top-level `system` and system-role messages.
    """
    candidates = []

    # Case 1: top-level system field (Vertex / Anthropic style)
    system_text = data.get("system")
    if isinstance(system_text, str):
        candidates.append(system_text)

    # Case 2: system OR user role messages (Claude Code --append-system-prompt arrives as user)
    for msg in data.get("messages", []) or []:
        if isinstance(msg, dict) and msg.get("role") in ("system", "user"):
            content = msg.get("content")
            if isinstance(content, str) and "LITELLM_CONTEXT" in content:
                candidates.append(content)

    for text in candidates:
        if "LITELLM_CONTEXT" not in text:
            continue

        # Strip comment markers and split
        cleaned = text.replace("<!--", "").replace("-->", "")
        parts = cleaned.split()

        repo = None
        repo_root = None
        for part in parts:
            if part.startswith("repo="):
                repo = part.split("=", 1)[1].strip()
            elif part.startswith("repo_root="):
                repo_root = part.split("=", 1)[1].strip()

        if repo and repo_root:
            return repo, repo_root
        # LITELLM_CONTEXT marker detected but parsing failed
        logger.debug("⚠️ LITELLM_CONTEXT marker detected but repo or repo_root missing")

    logger.debug("🔍 No LITELLM_CONTEXT found in system or user messages")
    return None



# ============================================================
# POLICY CONTRACT LOADING (Phase 1)
# ============================================================



# Helper to resolve repo root from proxy-injected request metadata
def get_repo_root_from_request(data: dict) -> Optional[Path]:
    """
    Resolve repo root using only explicit per-request metadata or headers.
    Returns None if not explicitly provided.
    """
    try:
        # Metadata may appear at top-level or under litellm_params depending on client
        top_metadata = data.get("metadata", {}) or {}
        lp_metadata = (data.get("litellm_params", {}) or {}).get("metadata", {}) or {}

        # Prefer top-level metadata, but fall back to litellm_params.metadata
        metadata = top_metadata if top_metadata else lp_metadata

        repo_name = metadata.get("repo")
        repo_root = metadata.get("repo_root")

        # API key helper fallback: "repo::actual_key"
        auth_header = None
        headers = data.get("headers") or {}
        if isinstance(headers, dict):
            auth_header = headers.get("authorization") or headers.get("Authorization")

        if auth_header:
            try:
                scheme, token = auth_header.split(" ", 1)
                scheme = scheme.strip()
            except Exception:
                scheme = None
                token = auth_header
            if token and "::" in token:
                potential_repo, real_token = token.split("::", 1)
                if potential_repo:
                    repo_name = repo_name or potential_repo
                    data.setdefault("metadata", {})["repo"] = repo_name
                if real_token:
                    cleaned = f"{scheme} {real_token}" if scheme else real_token
                    data.setdefault("headers", {})
                    data["headers"]["authorization"] = cleaned

        # 1) If repo + repo_root are both provided, implicitly register and use it
        if repo_name and repo_root:
            try:
                _repo_registry.register(repo_name, repo_root)
            except Exception as e:
                logger.warning(f"Repo registration failed for {repo_name}: {e}")
            return Path(repo_root).expanduser().resolve()

        # 2) If only repo_root is provided, use it (no registration possible)
        if repo_root:
            return Path(repo_root).expanduser().resolve()

        # 3) Resolve via repo registry only if BOTH repo and repo_root are provided
        if repo_name and repo_root:
            resolved = _repo_registry.resolve(repo_name)
            if resolved:
                return resolved

    except Exception as e:
        logger.warning(f"Failed to resolve repo context from metadata: {e}")

    # No inference, no fallback
    return None


# Registration helper for proxy server to call
def register_repo(repo: str, repo_root: str):
    """
    Register a repository with the proxy only when both repo and repo_root are provided.
    """
    if repo and repo_root:
        _repo_registry.register(repo, repo_root)


def load_policy_contract(repo_root: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load README.md and AGENTS.md from repo root and normalize into a contract object.
    If repo_root is not provided, contract is empty.
    """
    if not repo_root:
        logger.warning("⚠️  Could not find repo root, contract will be empty")
        return {
            "readme": "",
            "agents": "",
            "contract_text": "",
            "hash": ""
        }
    readme_path = repo_root / "README.md"
    agents_path = repo_root / "AGENTS.md"

    readme_content = ""
    agents_content = ""

    # Load README.md
    if readme_path.exists():
        try:
            with open(readme_path, 'r', encoding='utf-8') as f:
                readme_content = f.read()
        except Exception as e:
            logger.warning(f"Could not load README.md: {e}")
    else:
        logger.warning(f"README.md not found at {readme_path}")

    # Load AGENTS.md
    if agents_path.exists():
        try:
            with open(agents_path, 'r', encoding='utf-8') as f:
                agents_content = f.read()
        except Exception as e:
            logger.warning(f"Could not load AGENTS.md: {e}")
    else:
        logger.warning(f"AGENTS.md not found at {agents_path}")

    # Normalize: combine into contract text
    contract_text = f"""# Policy Contract

## README.md
{readme_content}

## AGENTS.md
{agents_content}
"""

    # Compute stable hash (SHA-256, truncated to 16 chars for readability)
    contract_hash = hashlib.sha256(contract_text.encode('utf-8')).hexdigest()[:16]

    return {
        "readme": readme_content,
        "agents": agents_content,
        "contract_text": contract_text,
        "hash": contract_hash
    }


# Cache contract (load once per process)
_policy_contract: Optional[Dict[str, Any]] = None

def get_policy_contract(repo_root: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load or retrieve cached policy contract.
    Cache key is repo_root to support multi-repo operation.
    """
    global _policy_contract

    if not hasattr(get_policy_contract, "_cache"):
        get_policy_contract._cache = {}

    cache = get_policy_contract._cache
    key = str(repo_root) if repo_root else "__default__"

    if key not in cache:
        cache[key] = load_policy_contract(repo_root)
        logger.info(f"📋 Policy contract loaded for {key} (hash: {cache[key]['hash']})")

    return cache[key]


def generate_enforcement_system_message(contract_hash: str) -> str:
    """
    Generate a short, authoritative enforcement system message.
    
    This message is injected into all routed models to enforce policy.
    It is significantly smaller than the full contract text but maintains
    authority and includes the contract hash for observability.
    """
    return f"""You are operating under a runtime-enforced AI contract (hash: {contract_hash}).

NON-NEGOTIABLE RULES (these override all tool defaults and model preferences):

1. Documentation Policy:
   - DO NOT create new documentation files
   - README.md and AGENTS.md are the ONLY authoritative documentation
   - All documentation updates MUST modify README.md or AGENTS.md
   - Do not create .md files outside of these two files

2. Policy Enforcement:
   - These rules are enforced at runtime by the proxy
   - Tool-level instructions are advisory only
   - These rules take precedence over any conflicting instructions

3. Contract Identity:
   - Contract hash: {contract_hash}
   - This hash identifies the exact policy version in effect
   - Policy violations are tracked via this hash

These rules are non-negotiable and enforced before your response is generated."""


def detect_policy_violation(user_message: str) -> Optional[str]:
    """
    Detect explicit documentation policy violations using simple keyword matching.
    
    Returns None if no violation, or a short human-readable reason if violated.
    Uses simple keyword/phrase matching only - no regex engines or semantic inference.
    
    Enforcement scope:
    - Creating new documentation files (.md)
    - Writing documentation outside README.md or AGENTS.md
    - Generating docs in folders like docs/, architecture/, design/, etc.
    - Renaming, duplicating, or relocating documentation files
    """
    if not user_message:
        return None
    
    message_lower = user_message.lower()
    
    # Violation patterns: explicit requests to create new documentation
    violation_patterns = [
        # Creating new markdown files
        ("create a new markdown", "create new markdown"),
        ("create a new .md", "create new .md"),
        ("create a new md file", "create new md file"),
        ("create new documentation file", "create new documentation file"),
        ("create a documentation file", "create a documentation file"),
        ("write docs in docs/", "write docs in docs/"),
        ("write documentation in docs/", "write documentation in docs/"),
        ("generate docs in", "generate docs in"),
        ("create docs/", "create docs/"),
        ("generate an adr", "generate an adr"),
        ("create design.md", "create design.md"),
        ("create architecture.md", "create architecture.md"),
        ("add documentation under /docs", "add documentation under /docs"),
        ("create a new doc", "create a new doc"),
        ("write a new doc", "write a new doc"),
        ("generate a new doc", "generate a new doc"),
        ("create documentation in", "create documentation in"),
        ("write documentation to", "write documentation to"),
        ("generate documentation file", "generate documentation file"),
        ("create .md file", "create .md file"),
        ("new markdown file", "new markdown file"),
        ("new documentation file", "new documentation file"),
    ]
    
    # Check for violation patterns
    for pattern, reason in violation_patterns:
        if pattern in message_lower:
            # Additional check: ensure it's not about README.md or AGENTS.md
            # If user explicitly mentions README.md or AGENTS.md, allow it
            if "readme.md" in message_lower or "agents.md" in message_lower:
                # User is explicitly referencing allowed files - not a violation
                continue
            return f"Request explicitly asks to {reason}"
    
    # Check for documentation folder patterns (docs/, architecture/, design/)
    folder_patterns = [
        "docs/",
        "architecture/",
        "design/",
        "documentation/",
    ]
    
    for folder in folder_patterns:
        if folder in message_lower:
            # Check if it's about creating/writing in these folders
            create_indicators = ["create", "write", "generate", "add", "new"]
            for indicator in create_indicators:
                # Look for pattern like "create in docs/" or "write to docs/"
                if indicator in message_lower and folder in message_lower:
                    # Check if it's about README.md or AGENTS.md (allowed)
                    if "readme.md" in message_lower or "agents.md" in message_lower:
                        continue
                    return f"Request asks to create documentation in {folder}"
    
    # No violation detected
    return None

# ============================================================
# CLASSIFICATION LOGIC
# ============================================================

def extract_user_message(data: dict) -> Optional[str]:
    """Extract the user's message from the request data."""
    messages = data.get("messages", [])
    if not messages:
        return None
    
    # Find the last user message
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            
            # Handle string content
            if isinstance(content, str):
                return content
            
            # Handle content blocks (Claude's format)
            if isinstance(content, list):
                text_parts = []
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                        elif block.get("type") == "tool_result":
                            # Include tool results for context
                            text_parts.append(str(block.get("content", "")))
                if text_parts:
                    return " ".join(text_parts)
            
            break
    
    return None


async def classify_with_haiku(prompt: str) -> str:
    """
    Use Haiku to classify the prompt complexity.
    
    Returns: "SIMPLE", "MODERATE", or "COMPLEX"
    """
    # Check cache first
    cached = _cache.get(prompt)
    if cached:
        logger.debug(f"📦 Cache hit: {cached}")
        return cached
    
    # Truncate very long prompts for classification
    # (we just need the gist, not the full code)
    truncated_prompt = prompt[:2000] if len(prompt) > 2000 else prompt
    
    classification_request = CLASSIFIER_PROMPT.format(prompt=truncated_prompt)
    
    try:
        # Make the classification call using LiteLLM
        # Tag with metadata so we can detect it deterministically in async_pre_call_hook
        response = await litellm.acompletion(
            model=f"vertex_ai/claude-haiku-4-5@20251001",
            messages=[{"role": "user", "content": classification_request}],
            max_tokens=10,  # We only need one word
            temperature=0,  # Deterministic
            # Use the same Vertex AI settings
            vertex_project="eci-global-it",
            vertex_location="global",
            # Tag as classification request for deterministic detection
            metadata={"request_type": "classification"}
        )
        
        # Extract the classification
        result = response.choices[0].message.content.strip().upper()
        
        # Validate the response
        if result not in ["SIMPLE", "MODERATE", "COMPLEX"]:
            # Try to extract if response contains the word
            for level in ["SIMPLE", "MODERATE", "COMPLEX"]:  # Check SIMPLE first (bias)
                if level in result:
                    result = level
                    break
            else:
                # Default to SIMPLE if unclear (bias toward cheap)
                logger.warning(f"Unclear classification '{result}', defaulting to SIMPLE")
                result = "SIMPLE"
        
        # Cache the result
        _cache.set(prompt, result)

        # ===== PHASE 3: Create dataset item for evaluation =====
        # TEMPORARY: Force dataset creation for testing (remove sampling check)
        if ENABLE_ROUTING_EVALUATION:  # Force all classifications to be captured for debugging
            try:
                client = get_langfuse_client()
                if client:
                    # Create dataset item with classification data
                    item = client.create_dataset_item(
                        dataset_name=DATASET_NAME,
                        input={"user_prompt": truncated_prompt[:2000]},
                        expected_output=None,  # No ground truth at classification time
                        metadata={
                            "classification": result,
                            "routed_model": MODEL_MAP.get(result, "unknown"),
                            "prompt_length": len(prompt),
                            "classifier_model": CLASSIFIER_MODEL,
                            "timestamp": str(time.time()),
                        }
                    )
                    logger.info(f"📊 Created dataset item ({result}) - ID: {item.id[:12] if item and hasattr(item, 'id') else 'N/A'}")
            except Exception as e:
                # Never break routing due to dataset creation failures
                logger.warning(f"⚠️  Failed to create dataset item: {e}")
                import traceback
                logger.warning(f"Traceback: {traceback.format_exc()[:200]}")
        # ===== END PHASE 3 =====

        return result

    except Exception as e:
        logger.error(f"Classification failed: {e}, defaulting to SIMPLE")
        return "SIMPLE"  # Default to cheapest on error


# ============================================================
# LITELLM HOOK
# ============================================================

class ComplexityRouter(CustomLogger):
    """
    LiteLLM CustomLogger class that routes requests based on complexity.
    
    This hook:
    1. Extracts the user's message
    2. Uses Haiku to classify complexity (SIMPLE/MODERATE/COMPLEX)
    3. Rewrites the model parameter to the appropriate tier
    4. Adds metadata for Langfuse tracking
    """
    def __init__(self):
        super().__init__()
        # Loaded per-request based on repo context
        self._contract = None  # Loaded per-request based on repo context
        logger.info("🚀 ComplexityRouter initialized (routes all requests: code→Sonnet, architecture→Opus, else→Haiku)")
        # Contract loaded per-request

    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: DualCache,
        data: dict,
        call_type: Literal[
            "completion",
            "text_completion",
            "embeddings",
            "image_generation",
            "moderation",
            "audio_transcription",
            "anthropic_messages",
        ]
    ) -> dict:
        # ====== Per-request ID and anchor log (very top) ======
        request_id = data.get("metadata", {}).get("request_id") or uuid.uuid4().hex[:12]
        data.setdefault("metadata", {})
        data["metadata"]["request_id"] = request_id
        logger.info(f"🆔 Request start | id={request_id} | call_type={call_type} | build={ROUTER_BUILD_ID}")
        # Store cache reference for use in async_log_success_event
        self._cache = cache

        data.setdefault("metadata", {})
        metadata = data["metadata"]
        metadata.setdefault("router_build_id", ROUTER_BUILD_ID)

        # Merge metadata forwarded via litellm_params (without overriding existing keys)
        litellm_metadata = (data.get("litellm_params", {}) or {}).get("metadata", {}) or {}
        if litellm_metadata:
            for key, value in litellm_metadata.items():
                metadata.setdefault(key, value)

        def apply_repo_context(source: str, repo: Optional[str], repo_root: Optional[str], override: bool = False) -> bool:
            """Normalize repo context injection with explicit precedence."""
            if not repo and not repo_root:
                return False
            applied = False
            if repo and (override or not metadata.get("repo")):
                metadata["repo"] = repo
                applied = True
            if repo_root and (override or not metadata.get("repo_root")):
                metadata["repo_root"] = repo_root
                applied = True
            if applied:
                logger.info(
                    f"🧭 Repo context from {source} | id={request_id} | repo={metadata.get('repo')} | root={metadata.get('repo_root')}"
                )
            return applied
        # ----------------------------------------------------------
        # Repo context via ANTHROPIC_CUSTOM_HEADERS (per-request) [highest priority]
        # ----------------------------------------------------------
        headers = data.get("headers", {}) or {}
        apply_repo_context(
            "headers",
            headers.get("x-litellm-repo"),
            headers.get("x-litellm-repo-root"),
            override=True,
        )
        # ----------------------------------------------------------
        # Repo context via metadata (already merged above)
        # ----------------------------------------------------------
        apply_repo_context("metadata", metadata.get("repo"), metadata.get("repo_root"))
        
        # ----------------------------------------------------------
        # Repo context via CLAUDE_METADATA (env var, Claude-compatible)
        # ----------------------------------------------------------
        import json

        claude_metadata_str = os.environ.get("CLAUDE_METADATA")
        if claude_metadata_str:
            try:
                claude_metadata = json.loads(claude_metadata_str)
                if isinstance(claude_metadata, dict):
                    for key, value in claude_metadata.items():
                        metadata.setdefault(key, value)
                    apply_repo_context(
                        "CLAUDE_METADATA",
                        claude_metadata.get("repo"),
                        claude_metadata.get("repo_root"),
                    )
            except Exception as e:
                logger.warning(f"Failed to parse CLAUDE_METADATA: {e}")

        # ----------------------------------------------------------
        # Repo context via appended system prompt (--append-system-prompt) [fallback]
        # ----------------------------------------------------------
        ctx = extract_repo_context_from_system(data)
        if ctx:
            repo, repo_root = ctx
            apply_repo_context("system_prompt", repo, repo_root)
        logger.info(
            f"🧾 Request metadata keys={list((metadata or {}).keys())} | has_request_type={'request_type' in (metadata or {})} | model={data.get('model','')}"
        )

        # Session cache context (ties metadata.user_id to repo)
        session_id = _extract_session_id(metadata)
        session_ctx = _get_session_repo_context(session_id)
        if session_ctx:
            apply_repo_context("session_cache", session_ctx.get("repo"), session_ctx.get("repo_root"))
        elif session_id:
            file_ctx = _load_repo_context_from_session_file(session_id)
            if file_ctx:
                applied = apply_repo_context("session_file", file_ctx.get("repo"), file_ctx.get("repo_root"))
                if applied:
                    _store_session_repo_context(session_id, file_ctx.get("repo"), file_ctx.get("repo_root"))

        guard_result = _apply_context_exhaustion_protection(data, request_id)
        if guard_result.get("refused"):
            return data
        ledger_reminder, ledger_alert = _build_ledger_reminder(metadata.get("repo"), metadata)
        if ledger_alert:
            metadata["ledger_alert"] = ledger_alert

        # ------------------------------------------------------------------
        # Disable token counting for Vertex AI Anthropic models
        # Vertex Anthropic partner models do NOT support count_tokens
        # This prevents LiteLLM from attempting unsupported endpoints
        # ------------------------------------------------------------------
        # NOTE: Token counting is disabled globally in litellm_config.yaml
        # Do NOT modify data["litellm_params"] here as it gets passed to the provider
        # and causes "litellm_params: Extra inputs are not permitted" errors

        # Fast-path: repo bootstrap request (register repo, no model call)
        if metadata.get("request_type") == "repo_bootstrap":
            logger.info(
                f"🧩 Repo bootstrap request received | id={request_id} | repo={metadata.get('repo')} | repo_root={metadata.get('repo_root')}"
            )

            # Ensure repo_root is resolved + injected (also triggers implicit registration)
            repo_root_boot = get_repo_root_from_request(data)
            if not data.get("model"):
                # Some clients omit model on bootstrap calls; set a safe default so the request parses consistently
                data["model"] = "claude-haiku-4-5"
            if repo_root_boot:
                data.setdefault("metadata", {})
                data["metadata"]["repo_root"] = str(repo_root_boot)

            # Cache session context for future requests
            session_id_boot = _extract_session_id(metadata)
            cached_repo_root = data.get("metadata", {}).get("repo_root") or metadata.get("repo_root")
            _store_session_repo_context(session_id_boot, metadata.get("repo"), cached_repo_root)

            # Return synthetic success response (no provider call)
            data["response"] = {
                "id": "repo_bootstrap",
                "object": "chat.completion",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Repository registered successfully."
                        },
                        "finish_reason": "stop"
                    }
                ],
            }

            # Prevent routing / retries / provider calls
            data["skip_llm_call"] = True
            data["do_not_route"] = True
            return data

        # Resolve repo root from proxy-injected metadata
        repo_root = get_repo_root_from_request(data)
        # One-line summary log AFTER repo resolution
        logger.info(
            f"🧭 Repo resolution summary | id={request_id} | repo={data.get('metadata', {}).get('repo')} | repo_root={repo_root}"
        )
        repo = None
        metadata = data.get("metadata", {}) or {}
        if not metadata:
            metadata = (data.get("litellm_params", {}) or {}).get("metadata", {}) or {}
        repo = metadata.get("repo")

        # Logging clarity for repo context
        if repo_root and repo:
            logger.info(
                f"📦 Scoped request | id={request_id} | repo={repo} | root={repo_root}"
            )
        else:
            logger.info(
                f"🧊 Unscoped request | id={request_id} | reason=no_repo_context"
            )

        # Only process chat completions and anthropic messages
        if call_type not in ["completion", "acompletion", "anthropic_messages"]:
            logger.debug(f"Skipping non-completion/anthropic call type: {call_type}")
            return data

        requested_model = data.get("model", "")
        requested_model_lower = requested_model.lower()
        original_model_for_refusal = requested_model

        # Extract the user's message for classification
        user_message = extract_user_message(data)

        # IMPORTANT: Skip policy enforcement for internal classification calls
        metadata = data.get("metadata", {})
        litellm_metadata = data.get("litellm_params", {}).get("metadata", {})
        is_classification_call = (
            metadata.get("request_type") == "classification" or
            litellm_metadata.get("request_type") == "classification"
        )
        if is_classification_call:
            logger.debug("🔬 Classification call detected via metadata, skipping policy enforcement")
            return data

        # ====== Request capture (targeted, opt-in, post-classification check) ======
        if REQUEST_CAPTURE_ENABLED:
            capture_request_snapshot(request_id, data)

        # Idempotency guard: if this request was already refused, do nothing
        if data.get("metadata", {}).get("policy_violation") == "true":
            logger.debug("🛑 Policy violation already handled for this request, skipping")
            return data

        # Gate policy enforcement and contract loading on explicit repo_root
        if not repo_root:
            logger.info("🧊 Unscoped request (no repo context provided)")
            # Do NOT load contracts, enforce policy, or inject enforcement system message
            # Proceed with routing and classification only
            contract = None
        else:
            # Load contract only if repo_root is present
            self._contract = get_policy_contract(repo_root)
            # Automatically inject resolved repo_root into metadata for downstream consistency
            data.setdefault("metadata", {})
            data["metadata"]["repo_root"] = str(repo_root)
            contract = self._contract

        logger.info(
            f"🧪 Enforcement check | call_type={call_type} | request_type={metadata.get('request_type')} | model={data.get('model')}"
        )

        # Phase 4: Minimal policy enforcement (before classification and routing)
        # Detect explicit documentation policy violations (only if scoped)
        if repo_root and contract and user_message:
            violation_reason = detect_policy_violation(user_message)
            if violation_reason:
                # Policy violation detected - refuse the request cleanly
                logger.info(f"🚫 Policy violation detected: {violation_reason}")

                refusal_message = f"""This request violates the documentation policy enforced by the runtime AI contract (hash: {contract['hash']}).

{violation_reason}

To comply with the policy, please update README.md or AGENTS.md instead of creating new documentation files."""

                # Attach metadata for observability before raising
                if "metadata" not in data:
                    data["metadata"] = {}
                data["metadata"]["policy_violation"] = "true"
                data["metadata"]["contract_hash"] = contract["hash"]
                data["metadata"]["violation_reason"] = violation_reason[:200]
                data["metadata"]["policy_violation"] = "true"
                data["metadata"]["contract_hash"] = contract["hash"]
                # NOTE: Do NOT set data["litellm_params"] - it causes provider errors

                # IMPORTANT: Return a terminal synthetic response and prevent any routing
                # DO NOT set data["model"] to a fake value — Anthropic validates model names eagerly
                data["response"] = {
                    "id": "policy_violation",
                    "object": "chat.completion",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": refusal_message
                            },
                            "finish_reason": "policy_violation"
                        }
                    ],
                }

                # Ensure model remains a valid, provider-known model
                data["model"] = original_model_for_refusal

                # Critical flags to stop LiteLLM from retrying or routing
                data["skip_llm_call"] = True
                data["do_not_route"] = True

                logger.info(
                    f"🛑 Policy refusal returned without provider call | model preserved={data['model']}"
                )
                return data

        # Phase 2: Inject short enforcement system message (before complexity classification)
        # This ensures all routed models receive the same policy enforcement
        # We use a short, authoritative message instead of the full contract text
        if repo_root and contract and contract.get("hash"):
            # All models in our config use Vertex AI, which requires top-level "system" parameter
            # NOT a system role in the messages array
            # Also remove any existing system messages from messages array (they cause errors)
            messages = data.get("messages", [])

            # Remove any system messages from the messages array (Vertex AI doesn't support them)
            filtered_messages = [
                msg for msg in messages
                if not (isinstance(msg, dict) and msg.get("role") == "system")
            ]

            if len(filtered_messages) != len(messages):
                # We removed system messages, update the array
                data["messages"] = filtered_messages
                logger.debug(f"📋 Removed system messages from messages array (Vertex AI requirement)")

            # Generate short enforcement system message (includes contract hash)
            enforcement_message = generate_enforcement_system_message(contract["hash"])
            if ledger_reminder:
                logger.info(f"📘 Ledger reminder injected | repo={metadata.get('repo')}")
                enforcement_message = f"{ledger_reminder}\n\n{enforcement_message}"

            # Use top-level "system" parameter (required for Vertex AI)
            existing_system = data.get("system", "")
            if existing_system:
                # Prepend enforcement message to existing system message (enforcement takes precedence)
                data["system"] = f"{enforcement_message}\n\n---\n\n{existing_system}"
            else:
                data["system"] = enforcement_message
            logger.debug(f"📋 Enforcement system message injected (hash: {contract['hash']})")

        # All requests go through complexity-based routing
        # No model respect - we route based on task complexity regardless of requested model

        # ============================================================
        # COMPLEXITY OVERRIDE: Check for user override commands
        # ============================================================
        override_applied = False
        override_remaining_seconds = None
        override_command = None
        
        # Extract session_id for override tracking
        session_id = _extract_session_id(metadata)
        
        # Check if user is issuing an override command
        if user_message:
            override_command = _parse_override_command(user_message)
            if override_command:
                if override_command.get("cancel"):
                    # User wants to cancel the override
                    if _cancel_complexity_override(session_id):
                        logger.info(f"🎛️ Override cancelled by user | session={session_id[:12] if session_id else 'none'}...")
                else:
                    # User wants to set an override
                    _set_complexity_override(
                        session_id,
                        override_command["complexity"],
                        override_command["ttl_minutes"]
                    )
        
        # Check for active override before classification
        active_override = _get_complexity_override(session_id)
        
        if active_override:
            # Override is active - use override classification instead of Haiku
            classification = active_override
            override_applied = True
            override_remaining_seconds = _get_override_remaining_seconds(session_id)
            logger.info(
                f"🎛️ Override ACTIVE | session={session_id[:12] if session_id else 'none'}... | "
                f"classification={classification} | remaining={override_remaining_seconds}s"
            )
        elif not user_message:
            logger.debug("No user message found, defaulting to SIMPLE")
            classification = "SIMPLE"
        else:
            message_length = len(user_message.strip())
            # Fast path: Very short messages are always SIMPLE
            if message_length < 20:
                classification = "SIMPLE"
                logger.debug(f"⚡ Fast path: Short message ({message_length} chars) → SIMPLE")
            else:
                # Classify with Haiku (no fast path for long messages anymore)
                classification = await classify_with_haiku(user_message)
                logger.debug(f"🎯 Classified: {classification} (prompt: {message_length} chars)")

        # Map to model
        selected_model = MODEL_MAP.get(classification, "claude-haiku-4-5")

        # Update the request
        original_model = data.get("model", "unknown")
        data["model"] = selected_model

        metadata = data.setdefault("metadata", metadata if isinstance(metadata, dict) else {})

        # Set environment for Langfuse tracking (per-request, supports multiple projects)
        # Set environment to repo if present, else "unscoped"
        environment_value = metadata.get("repo")
        if not environment_value:
            repo_root_meta = metadata.get("repo_root")
            if repo_root_meta:
                try:
                    environment_value = Path(repo_root_meta).name or "unscoped"
                except Exception:
                    environment_value = "unscoped"
            else:
                environment_value = "unscoped"

        # Add metadata for Langfuse tracking
        # According to LiteLLM docs, metadata should be at top-level for Langfuse callback
        # We set it in both places to ensure compatibility
        if "metadata" not in data:
            data["metadata"] = {}

        # Create metadata dict - CRITICAL: Set in litellm_params.metadata
        # LiteLLM's Langfuse callback reads from kwargs["litellm_params"]["metadata"]
        # NOT from data["metadata"] directly
        contract = self._contract if repo_root else None
        repo_value = metadata.get("repo", "unscoped")
        repo_root_value = metadata.get("repo_root", "")

        custom_metadata = {
            "environment": environment_value,
            "complexity_classification": classification,
            "original_model_requested": original_model,
            "routed_to_model": selected_model,
            "router": "complexity_router_v2",
            "prompt_length": len(user_message) if user_message else 0,
            "repo": repo_value or "unscoped",
            "repo_root": repo_root_value,
            "gen_ai_system": "anthropic",
            "gen_ai_operation": "chat",
            # Phase 3: Policy contract observability
            "contract_hash": contract.get("hash", "") if contract else "",
            "policy_enforced": "true" if contract and contract.get("hash") else "false",
            # Propagate request_id for traceability
            "request_id": request_id,
            "trace_environment": environment_value,
            "ledger_alert": ledger_alert or "none",
            "ledger_reminder_active": str(bool(ledger_reminder)).lower(),
            # Complexity override tracking
            "complexity_override_active": str(override_applied).lower(),
            "complexity_override_remaining_seconds": str(override_remaining_seconds or 0),
        }

        # Validate and sanitize metadata values (truncate if > 200 chars)
        sanitized_metadata = {}
        for key, value in custom_metadata.items():
            sanitized_key = ''.join(c for c in key if c.isalnum() or c == '_')
            if sanitized_key != key:
                logger.warning(f"⚠️  Metadata key '{key}' sanitized to '{sanitized_key}'")
            str_value = str(value)
            if len(str_value) > 200:
                logger.warning(f"⚠️  Metadata value for '{key}' truncated from {len(str_value)} to 200 chars")
                str_value = str_value[:200]
            sanitized_metadata[sanitized_key] = str_value
        if LANGFUSE_ENABLED and environment_value not in (None, "unscoped"):
            logger.info(f"Langfuse trace environment set to {environment_value}")

        # Set metadata at top-level of data dict (required for LiteLLM proxy)
        # NOTE: Do NOT add litellm_params to data dict - it gets passed to providers
        # and causes "litellm_params: Extra inputs are not permitted" errors
        if "metadata" not in data:
            data["metadata"] = {}
        data["metadata"].update(sanitized_metadata)

        # Store in cache for async_log_success_event to inject into kwargs
        import hashlib
        messages = data.get("messages", [])
        user_message_for_key = None
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    user_message_for_key = content
                    break
                if isinstance(content, list):
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif block.get("type") == "tool_result":
                                text_parts.append(str(block.get("content", "")))
                    if text_parts:
                        user_message_for_key = " ".join(text_parts)
                        break
        if not user_message_for_key:
            logger.warning("⚠️  No user message found for cache key generation")
            return data
        key_string = user_message_for_key[:200]
        request_key = hashlib.md5(key_string.encode()).hexdigest()[:16]
        cache_key = f"router_metadata:{request_key}"
        await cache.async_set_cache(cache_key, sanitized_metadata, ttl=300)

        # Log routing decision in a single, cleaner line
        emoji = self._get_emoji(classification)
        color = self._get_color(classification)
        reset = "\033[0m"  # Reset color
        model_short = selected_model.replace("@20251001", "").replace("@20250929", "").replace("-20251001", "").replace("-20250929", "")
        prompt_preview = (user_message[:50] + "...") if user_message and len(user_message) > 50 else (user_message or "")
        logger.info(f"{color}{emoji} {classification} → {model_short} | id={request_id} | {prompt_preview}{reset}")
        return data

    def _get_emoji(self, classification: str) -> str:
        if classification == "SIMPLE":
            return "🐇"
        elif classification == "MODERATE":
            return "🦊"
        elif classification == "COMPLEX":
            return "🦁"
        return "❓"
    
    def _get_color(self, classification: str) -> str:
        """Get ANSI color code for classification."""
        # ANSI color codes
        RESET = "\033[0m"
        BOLD = "\033[1m"
        
        if classification == "SIMPLE":
            # Green for Haiku (fast, cheap)
            return f"{BOLD}\033[32m"  # Bold green
        elif classification == "MODERATE":
            # Yellow for Sonnet (balanced)
            return f"{BOLD}\033[33m"  # Bold yellow
        elif classification == "COMPLEX":
            # Magenta for Opus (powerful)
            return f"{BOLD}\033[35m"  # Bold magenta
        return RESET

    async def async_log_success_event(
        self,
        kwargs: dict,
        response_obj: Any,
        start_time: Any,
        end_time: Any,
    ) -> None:
        """
        Inject metadata into kwargs so Langfuse callback can read it.
        This runs AFTER the LLM call but BEFORE Langfuse callback processes kwargs.
        We retrieve metadata from cache (set in async_pre_call_hook) and inject it.
        """
        # Retrieve metadata we stored in async_pre_call_hook
        # CRITICAL: Use same message extraction logic as async_pre_call_hook
        import hashlib

        usage_info = getattr(response_obj, "usage", None)
        prompt_tokens = None
        response_tokens = None
        token_usage = None

        if usage_info:
            try:
                if isinstance(usage_info, dict):
                    prompt_tokens = (
                        usage_info.get("prompt_tokens")
                        or usage_info.get("input_tokens")
                    )
                    response_tokens = (
                        usage_info.get("completion_tokens")
                        or usage_info.get("output_tokens")
                    )
                    token_usage = usage_info.get("total_tokens")
                else:
                    prompt_tokens = getattr(usage_info, "prompt_tokens", None)
                    if prompt_tokens is None:
                        prompt_tokens = getattr(usage_info, "input_tokens", None)
                    response_tokens = getattr(usage_info, "completion_tokens", None)
                    if response_tokens is None:
                        response_tokens = getattr(usage_info, "output_tokens", None)
                    token_usage = getattr(usage_info, "total_tokens", None)
            except Exception:
                pass

        if token_usage is None and None not in (prompt_tokens, response_tokens):
            token_usage = (prompt_tokens or 0) + (response_tokens or 0)

        # Use same extraction logic as async_pre_call_hook (extract_user_message)
        # This ensures we get the same message content for cache key generation
        messages = kwargs.get("messages", [])
        user_message = None

        # Find the last user message (same as extract_user_message)
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = msg.get("content", "")

                # Handle string content
                if isinstance(content, str):
                    user_message = content
                    break

                # Handle content blocks (Claude's format)
                if isinstance(content, list):
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif block.get("type") == "tool_result":
                                text_parts.append(str(block.get("content", "")))
                    if text_parts:
                        user_message = " ".join(text_parts)
                        break

        if not user_message:
            logger.warning("⚠️  No user message found in kwargs for cache lookup")
            return

        # Create key from user message (same as async_pre_call_hook)
        # Use first 200 chars for consistency
        key_string = user_message[:200]
        request_key = hashlib.md5(key_string.encode()).hexdigest()[:16]
        cache_key = f"router_metadata:{request_key}"

        stored_metadata = None
        if hasattr(self, '_cache') and self._cache:
            stored_metadata = await self._cache.async_get_cache(cache_key)

        # Ensure metadata structure exists
        if "litellm_params" not in kwargs:
            kwargs["litellm_params"] = {}
        if "metadata" not in kwargs["litellm_params"]:
            kwargs["litellm_params"]["metadata"] = {}
        if "metadata" not in kwargs:
            kwargs["metadata"] = {}

        litellm_metadata = kwargs["litellm_params"]["metadata"]
        top_level_metadata = kwargs["metadata"]

        logger.info(
            "📡 async_log_success_event invoked | request_id=%s | model=%s",
            top_level_metadata.get("request_id"),
            kwargs.get("model"),
        )

        # First check if our metadata is already present (from async_pre_call_hook)
        has_our_metadata = any(key in litellm_metadata for key in ["router", "complexity_classification", "environment"])
        token_usage = None  # populated later if Langfuse routing evaluation runs

        # Always ensure contract metadata is present (Phase 3)
        contract = self._contract
        contract_metadata = {}
        # Propagate request_id from kwargs if available
        request_id = (
            top_level_metadata.get("request_id")
            or litellm_metadata.get("request_id")
            or None
        )
        if contract and contract.get("hash"):
            contract_metadata = {
                "contract_hash": contract["hash"],
                "policy_enforced": "true",
                "request_id": request_id,
            }
        else:
            contract_metadata = {
                "contract_hash": "",
                "policy_enforced": "false",
                "request_id": request_id,
            }

        if has_our_metadata:
            litellm_metadata.update(contract_metadata)
            top_level_metadata.update(contract_metadata)

        if stored_metadata:
            litellm_metadata.update(stored_metadata)
            top_level_metadata.update(stored_metadata)
            litellm_metadata.update(contract_metadata)
            top_level_metadata.update(contract_metadata)
        else:
            # Set environment to repo if present, else "unscoped"
            repo = kwargs.get("metadata", {}).get("repo", "unscoped")
            fallback_metadata = {
                "environment": repo,
                "router": "complexity_router_v2",
                **contract_metadata
            }
            litellm_metadata.update(fallback_metadata)
            top_level_metadata.update(fallback_metadata)

        # ===== PHASE 4: Create dataset item with routing outcome =====
        # TEMPORARY: Force dataset creation for testing (remove sampling check)
        if ENABLE_ROUTING_EVALUATION:  # Force all outcomes to be captured for debugging
            try:
                client = get_langfuse_client()
                if client and user_message:
                    # Extract routing metadata from kwargs
                    classification = kwargs.get("metadata", {}).get("complexity_classification", "unknown")
                    routed_model = kwargs.get("model", "unknown")

                    # Extract token usage from response
                    token_usage = None
                    if hasattr(response_obj, 'usage') and response_obj.usage:
                        if hasattr(response_obj.usage, 'total_tokens'):
                            token_usage = response_obj.usage.total_tokens

                    # Create dataset item with routing outcome
                    item = client.create_dataset_item(
                        dataset_name=DATASET_NAME,
                        input={"user_prompt": user_message[:2000]},
                        expected_output=None,  # No ground truth - evaluator will judge
                        metadata={
                            "classification": classification,
                            "routed_model": routed_model,
                            "response_success": True,  # If we're here, response succeeded
                            "token_usage": token_usage,
                            "timestamp": str(time.time()),
                            "phase": "routing_outcome",  # Distinguish from classification-time items
                            "request_id": request_id,
                        }
                    )
                    logger.info(f"📊 Created routing outcome dataset item - model: {routed_model}, tokens: {token_usage}")
            except Exception as e:
                # Never break routing due to dataset creation failures
                logger.warning(f"⚠️  Failed to create routing outcome dataset item: {e}")
        # ===== END PHASE 4 =====

        # ===== CORALOGIX TRACE EMISSION =====
        response_text = _extract_response_text(response_obj)
        repo_meta = kwargs.get("metadata", {})
        coralogix_attrs = {
            "litellm.repo": repo_meta.get("repo"),
            "litellm.environment": repo_meta.get("environment"),
            "litellm.request_id": request_id,
            "litellm.classification": repo_meta.get("complexity_classification"),
            "litellm.router.model": kwargs.get("model"),
            "litellm.router.original_model": repo_meta.get("original_model_requested"),
            "litellm.ledger_alert": repo_meta.get("ledger_alert"),
            "litellm.ledger_reminder_active": repo_meta.get("ledger_reminder_active"),
            "llm.response.total_tokens": token_usage,
            "litellm.latency_ms": _compute_latency_ms(start_time, end_time),
            "gen_ai.operation.name": repo_meta.get("gen_ai_operation", "chat"),
            "gen_ai.system": repo_meta.get("gen_ai_system", "anthropic"),
            "gen_ai.request.model": repo_meta.get("routed_to_model"),
            "gen_ai.response.model": repo_meta.get("routed_to_model"),
            "gen_ai.usage.input_tokens": prompt_tokens,
            "gen_ai.usage.output_tokens": response_tokens,
            "gen_ai.prompt.0.role": "user" if user_message else None,
            "gen_ai.prompt.0.content": (user_message[:500] if user_message else None),
            "gen_ai.completion.0.role": "assistant" if response_text else None,
            "gen_ai.completion.0.content": (response_text[:500] if response_text else None),
        }
        try:
            logger.info(
                "📄 Coralogix payload | %s",
                json.dumps({k: v for k, v in coralogix_attrs.items() if v is not None})[:2000],
            )
        except Exception as log_exc:  # pragma: no cover - defensive logging
            logger.debug(f"Failed to serialize Coralogix payload: {log_exc}")
        logger.info(
            "📡 Emitting Coralogix span | request_id=%s | model=%s",
            request_id,
            kwargs.get("model"),
        )
        record_coralogix_trace("litellm.request", coralogix_attrs)


# Create the singleton instance for LiteLLM to use
proxy_handler_instance = ComplexityRouter()


# ============================================================
# TESTING / STANDALONE MODE
# ============================================================

async def test_classification():
    """Test the classifier with sample prompts."""
    
    test_cases = [
        # SIMPLE - should route to Haiku
        ("What is 2+2?", "SIMPLE"),
        ("Hello!", "SIMPLE"),
        ("Thanks for your help", "SIMPLE"),
        ("What does this error mean?", "SIMPLE"),
        ("Read the file at src/main.py", "SIMPLE"),
        ("Add a comment to this function", "SIMPLE"),
        ("Format this code", "SIMPLE"),
        # Long but simple
        ("I have this very long error message from my build process that I need you to look at and tell me what's wrong. The error says 'undefined variable foo' on line 42.", "SIMPLE"),
        
        # MODERATE - should route to Sonnet
        ("Refactor this function to use async/await", "MODERATE"),
        ("Write a unit test for the UserService class", "MODERATE"),
        ("Debug this TypeError in my React component", "MODERATE"),
        ("Explain how this authentication flow works", "MODERATE"),
        
        # COMPLEX - should route to Opus
        ("Design a distributed caching system for a high-traffic e-commerce platform", "COMPLEX"),
        ("Plan a migration strategy from Django to FastAPI for our 50,000 line codebase", "COMPLEX"),
        ("Analyze the trade-offs between microservices and monolithic architecture", "COMPLEX"),
    ]
    
    print("\n" + "="*60)
    print("Testing Complexity Classifier (Haiku-biased)")
    print("="*60 + "\n")
    
    correct = 0
    total = len(test_cases)
    
    for prompt, expected in test_cases:
        result = await classify_with_haiku(prompt)
        status = "✅" if result == expected else "❌"
        if result == expected:
            correct += 1
        
        print(f"{status} Expected: {expected:8} | Got: {result:8} | {prompt[:50]}...")
    
    print(f"\n{'='*60}")
    print(f"Accuracy: {correct}/{total} ({100*correct/total:.1f}%)")
    print("="*60 + "\n")


if __name__ == "__main__":
    # Run tests when executed directly
    asyncio.run(test_classification())
