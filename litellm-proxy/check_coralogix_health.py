#!/usr/bin/env python3
"""Health check script for Coralogix DataPrime ingest.

The script issues a DataPrime query against the spans dataset looking for
recent litellm-proxy traces. If at least one result is returned, observability
is considered healthy. Otherwise, it prints diagnostics and exits non-zero.

When invoked with ``--emit-test-span`` the script will also emit a synthetic
span using the same OTLP exporter configuration as the proxy. This is useful
for verifying that the ingest credentials (``CX_AI_TOKEN`` / ``CX_ENDPOINT``)
are valid even if normal proxy traffic is idle.

Environment variables:
  CORALOGIX_HEALTH_API_KEY   API key that has DataQuerying permissions.
  CORALOGIX_HEALTH_DOMAIN    API host (e.g. api.us2.coralogix.com).
  CX_TOKEN / CX_ENDPOINT     Fallbacks if dedicated vars are not provided.
  CX_APPLICATION_NAME        (Optional) service filter override.
  CORALOGIX_DEBUG_COLLECTOR_ENDPOINT  Hints that a local OTEL collector is running.

Returns zero on success, non-zero when connectivity fails or no spans are found.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import base64
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple

try:  # pragma: no cover - optional convenience
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:  # pragma: no cover
    pass

import requests

try:  # Optional dependency when emitting a test span
    from opentelemetry import trace  # type: ignore
    from llm_tracekit import setup_export_to_coralogix  # type: ignore
except Exception:  # pragma: no cover - allow query-only usage without OTEL deps
    trace = None  # type: ignore
    setup_export_to_coralogix = None  # type: ignore


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def _infer_api_host(explicit: Optional[str], cx_endpoint: Optional[str]) -> str:
    if explicit:
        return explicit.strip()
    if cx_endpoint:
        host = cx_endpoint.split(":", 1)[0].strip()
        if host.startswith("ingress."):
            host = host.replace("ingress.", "api.", 1)
        return host
    raise SystemExit("Missing CORALOGIX_HEALTH_DOMAIN or CX_ENDPOINT env vars")


def run_health_check(
    api_key: str,
    api_host: str,
    minutes: int,
    service_filter: Optional[str] = None,
) -> int:
    end_time = _now()
    start_time = end_time - timedelta(minutes=minutes)
    query = "source spans | limit 200"

    payload = {
        "query": base64.b64encode(query.encode()).decode("ascii"),
        "metadata": {
            "syntax": "QUERY_SYNTAX_DATAPRIME_UTF8_BASE64",
            "startDate": _iso(start_time),
            "endDate": _iso(end_time),
            "defaultSource": "spans",
            "limit": 200,
        },
    }

    url = f"https://{api_host}/api/v1/dataprime/query"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as exc:
        print(f"❌ Request to {url} failed: {exc}")
        return 2

    if resp.status_code != 200:
        if resp.status_code == 403:
            print(
                "❌ Coralogix returned 403. Ensure the provided API key has DataQuerying permissions."
            )
        else:
            print(f"❌ Coralogix responded with {resp.status_code}: {resp.text[:200]}")
        return 3

    results = []
    warning = None
    for line in resp.text.strip().splitlines():
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "result" in obj:
            results.extend(obj["result"].get("results", []))
        if "warning" in obj:
            warning = obj["warning"]
        if "error" in obj:
            warning = obj["error"]

    matches = []
    normalized_filter = (service_filter or "").strip().lower()
    filter_enabled = bool(normalized_filter and normalized_filter != "*")
    for item in results:
        user_data = item.get("userData")
        if not user_data:
            continue
        try:
            data = json.loads(user_data)
        except json.JSONDecodeError:
            continue
        tags = data.get("tags", {})
        service = data.get("serviceName")
        if filter_enabled:
            service_name = (service or "").lower()
            repo_name = (tags.get("litellm.repo") or "").lower()
            if normalized_filter not in {service_name, repo_name}:
                continue
        if tags.get("litellm.repo") or service in {"litellm-proxy", "complexity-router"} or not filter_enabled:
            matches.append(
                {
                    "service": service,
                    "repo": tags.get("litellm.repo"),
                    "timestamp": data.get("startTime"),
                }
            )

    if matches:
        print("✅ Coralogix spans detected", json.dumps(matches[0], indent=2))
        print(f"Total matching spans: {len(matches)}")
        return 0

    print("⚠️  No spans found in the requested window.")
    if warning:
        print(json.dumps(warning, indent=2))
    debug_collector = os.environ.get("CORALOGIX_DEBUG_COLLECTOR_ENDPOINT")
    if debug_collector:
        print(
            "ℹ️  CORALOGIX_DEBUG_COLLECTOR_ENDPOINT is set (" + debug_collector + \
            "). Check the local collector logs to confirm spans are emitted."
        )
    return 4


def _require_otlp_support() -> Tuple[Any, Any]:
    if setup_export_to_coralogix is None or trace is None:
        raise RuntimeError(
            "opentelemetry/llm-tracekit not installed; run inside an env with llm-tracekit[litellm]"
        )
    return setup_export_to_coralogix, trace


def emit_test_span(
    service_name: str,
    application_name: str,
    subsystem_name: str,
    wait_seconds: float,
    span_name: str = "litellm.healthcheck",
    extra_attrs: Optional[Dict[str, Any]] = None,
) -> int:
    """Send a synthetic OTLP span directly to Coralogix."""

    try:
        setup_fn, trace_mod = _require_otlp_support()
    except RuntimeError as exc:
        print(f"❌ {exc}")
        return 5

    token = (
        os.environ.get("CX_AI_TOKEN")
        or os.environ.get("CX_TOKEN")
        or os.environ.get("CX_SEND_DATA_TOKEN")
    )
    endpoint = os.environ.get("CX_ENDPOINT")

    if not token or not endpoint:
        print(
            "❌ --emit-test-span requires CX_ENDPOINT and one of CX_AI_TOKEN/CX_TOKEN/CX_SEND_DATA_TOKEN."
        )
        return 6

    try:
        os.environ.setdefault("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "true")

        setup_fn(
            service_name=service_name,
            coralogix_token=token,
            coralogix_endpoint=endpoint,
            application_name=application_name,
            subsystem_name=subsystem_name,
        )
        tracer = trace_mod.get_tracer("coralogix.healthcheck")
        now = _now()
        attrs: Dict[str, Any] = {}
        if span_name == "litellm.healthcheck":
            attrs.update(
                {
                    "litellm.healthcheck": True,
                    "litellm.healthcheck.timestamp": now.isoformat(),
                    "litellm.healthcheck.script": __file__,
                }
            )
            repo_name = os.environ.get("LITELLM_REPO")
            if repo_name:
                attrs["litellm.healthcheck.repo"] = repo_name
        if extra_attrs:
            attrs.update(extra_attrs)

        with tracer.start_as_current_span(span_name) as span:
            for key, value in attrs.items():
                span.set_attribute(key, value)
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        print(
            f"✅ Emitted synthetic span '{span_name}' to Coralogix (waited {wait_seconds}s before querying)."
        )
        return 0
    except Exception as exc:  # pragma: no cover - network/env failures
        print(f"❌ Failed to emit test span: {exc}")
        return 7


def emit_request_span(
    service_name: str,
    application_name: str,
    subsystem_name: str,
    repo: str,
    model: str,
    original_model: str,
    classification: str,
    request_id: str,
    prompt_tokens: int,
    response_tokens: int,
    latency_ms: float,
    ledger_alert: Optional[str],
    ledger_active: str,
    genai_system: str,
    genai_operation: str,
    prompt_text: str,
    response_text: str,
    wait_seconds: float,
) -> int:
    extra = {
        "litellm.repo": repo,
        "litellm.environment": repo,
        "litellm.request_id": request_id,
        "litellm.classification": classification,
        "litellm.router.model": model,
        "litellm.router.original_model": original_model,
        "litellm.ledger_alert": ledger_alert or "none",  # OTEL requires non-None values
        "litellm.ledger_reminder_active": ledger_active,
        "llm.response.total_tokens": prompt_tokens + response_tokens,
        "gen_ai.operation.name": genai_operation,
        "gen_ai.system": genai_system,
        "gen_ai.request.model": model,
        "gen_ai.response.model": original_model,
        "gen_ai.usage.input_tokens": prompt_tokens,
        "gen_ai.usage.output_tokens": response_tokens,
        "gen_ai.prompt.0.role": "user",
        "gen_ai.prompt.0.content": prompt_text,
        "gen_ai.completion.0.role": "assistant",
        "gen_ai.completion.0.content": response_text,
        "litellm.latency_ms": latency_ms,
    }
    return emit_test_span(
        service_name,
        application_name,
        subsystem_name,
        wait_seconds,
        span_name="litellm.request",
        extra_attrs=extra,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--minutes",
        type=int,
        default=15,
        help="Look back this many minutes for litellm-proxy spans (default: 15)",
    )
    parser.add_argument(
        "--emit-test-span",
        action="store_true",
        help="Send a synthetic span to Coralogix before querying spans",
    )
    parser.add_argument(
        "--emit-request-span",
        action="store_true",
        help="Emit a synthetic litellm.request span with repo/model metadata",
    )
    parser.add_argument(
        "--service",
        default="litellm-proxy",
        help="Service or repo tag to filter for (use '*' to disable filtering)",
    )
    parser.add_argument(
        "--service-name",
        default=os.environ.get("CORALOGIX_SERVICE_NAME", "litellm-proxy"),
        help="Service name to use when emitting a test span",
    )
    parser.add_argument(
        "--application-name",
        default=os.environ.get("CX_APPLICATION_NAME", "litellm-proxy"),
        help="Application name for the test span",
    )
    parser.add_argument(
        "--subsystem-name",
        default=os.environ.get("CX_SUBSYSTEM_NAME", "complexity-router"),
        help="Subsystem name for the test span",
    )
    parser.add_argument(
        "--emit-wait",
        type=float,
        default=2.0,
        help="Seconds to wait after emitting a test span before querying",
    )
    parser.add_argument(
        "--repo",
        default=os.environ.get("LITELLM_REPO", "firehydrant"),
        help="Repo tag to include when emitting request spans",
    )
    parser.add_argument(
        "--classification",
        default="SIMPLE",
        help="Classification label for synthetic request spans",
    )
    parser.add_argument(
        "--model-name",
        default="claude-haiku-4-5@20251001",
        help="Model name stored on synthetic request spans",
    )
    parser.add_argument(
        "--original-model",
        default="claude-sonnet-4-5-20250929",
        help="Original requested model stored in synthetic request spans",
    )
    parser.add_argument(
        "--request-id",
        default="test-request",
        help="Request ID attribute for synthetic request spans",
    )
    parser.add_argument(
        "--prompt-tokens",
        type=int,
        default=50,
        help="Input token count for synthetic request spans",
    )
    parser.add_argument(
        "--response-tokens",
        type=int,
        default=50,
        help="Output token count for synthetic request spans",
    )
    parser.add_argument(
        "--latency-ms",
        type=float,
        default=50.0,
        help="Latency (ms) attribute for synthetic request spans",
    )
    parser.add_argument(
        "--ledger-alert",
        default="",
        help="Ledger alert message for synthetic request spans",
    )
    parser.add_argument(
        "--ledger-reminder-active",
        default="false",
        help="Set litellm.ledger_reminder_active attribute",
    )
    parser.add_argument(
        "--genai-system",
        default="anthropic",
        help="gen_ai.system attribute value",
    )
    parser.add_argument(
        "--genai-operation",
        default="chat",
        help="gen_ai.operation.name attribute value",
    )
    parser.add_argument(
        "--prompt-text",
        default="Quick health check",
        help="Prompt text stored in gen_ai.prompt.0.content",
    )
    parser.add_argument(
        "--response-text",
        default="Synthetic response",
        help="Response text stored in gen_ai.completion.0.content",
    )
    args = parser.parse_args()

    api_key = (
        os.environ.get("CORALOGIX_HEALTH_API_KEY")
        or os.environ.get("CX_READ_DATA_TOKEN")
        or os.environ.get("CX_TOKEN")
        or os.environ.get("CX_SEND_DATA_TOKEN")
    )
    if not api_key:
        print("❌ Missing CORALOGIX_HEALTH_API_KEY or CX_TOKEN environment variable")
        return 1

    api_host = _infer_api_host(
        os.environ.get("CORALOGIX_HEALTH_DOMAIN"), os.environ.get("CX_ENDPOINT")
    )

    if args.emit_test_span or args.emit_request_span:
        if args.emit_request_span:
            emit_rc = emit_request_span(
                service_name=args.service_name,
                application_name=args.application_name,
                subsystem_name=args.subsystem_name,
                repo=args.repo,
                model=args.model_name,
                original_model=args.original_model,
                classification=args.classification,
                request_id=args.request_id,
                prompt_tokens=args.prompt_tokens,
                response_tokens=args.response_tokens,
                latency_ms=args.latency_ms,
                ledger_alert=args.ledger_alert or None,
                ledger_active=args.ledger_reminder_active,
                genai_system=args.genai_system,
                genai_operation=args.genai_operation,
                prompt_text=args.prompt_text,
                response_text=args.response_text,
                wait_seconds=args.emit_wait,
            )
        else:
            emit_rc = emit_test_span(
                service_name=args.service_name,
                application_name=args.application_name,
                subsystem_name=args.subsystem_name,
                wait_seconds=args.emit_wait,
            )
        if emit_rc != 0:
            return emit_rc

    return run_health_check(api_key, api_host, args.minutes, service_filter=args.service)


if __name__ == "__main__":
    sys.exit(main())
