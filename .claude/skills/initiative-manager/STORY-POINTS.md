# Story Point Estimation

## Overview

When syncing Linear milestones to JIRA Tasks, the skill automatically estimates story points based on the work's complexity, risk, and effort. This enables JIRA workflow transitions that require story points (like transitioning to Done).

## Fibonacci Scale

ECI uses the Fibonacci scale for story points:

| Points | Complexity | Risk | Effort | Description |
|--------|------------|------|--------|-------------|
| **1** | Trivial | None | Hours | Simple change, no unknowns, straightforward implementation |
| **2** | Low | Low | 1-2 days | Well-understood work, minimal dependencies, clear path |
| **3** | Medium-Low | Low | 2-3 days | Some complexity, few unknowns, mostly familiar territory |
| **5** | Medium | Medium | 3-5 days | Notable complexity, some unknowns, may need investigation |
| **8** | Medium-High | Medium-High | 1-2 weeks | Significant complexity, multiple unknowns, cross-team coordination |
| **13** | High | High | 2-3 weeks | High complexity, many unknowns, significant risk, major feature |
| **21** | Very High | Very High | 3+ weeks | Epic-level work, should likely be broken down further |

## Estimation Heuristics

The skill analyzes these signals to estimate story points:

### From Milestone Name

| Pattern | Points Adjustment | Rationale |
|---------|-------------------|-----------|
| Contains "M1" (first milestone) | +2 | Discovery/setup work has unknowns |
| Contains "Inventory" or "Audit" | Base 3 | Data gathering is well-scoped |
| Contains "Automation" | Base 5 | Scripting has moderate complexity |
| Contains "Batch" or "Bulk" | +2 | Scale adds risk |
| Contains "Validation" or "Sign-off" | Base 2 | Verification is straightforward |
| Contains "Setup" or "Configuration" | Base 3 | Setup work is usually predictable |
| Contains "Integration" | +3 | External systems add complexity |
| Contains "Migration" | +3 | Data migrations are risky |

### From Milestone Description

| Signal | Points Adjustment | Rationale |
|--------|-------------------|-----------|
| External dependency mentioned | +2 | Waiting on others adds risk |
| Multiple systems mentioned | +2 | Cross-system work is complex |
| "Manual" or "by hand" | -1 | Manual work is predictable |
| "Automated" or "scripted" | +1 | Automation has edge cases |
| Numbered list with 5+ items | +2 | Many steps = more complexity |
| Contains "blocked" or "waiting" | +1 | Blockers indicate risk |

### From Project Context

| Signal | Points Adjustment | Rationale |
|--------|-------------------|-----------|
| First project in initiative | +1 | Initial work has more unknowns |
| Has 5+ milestones in project | -1 per milestone | Work is broken down smaller |
| Target date < 1 week away | +2 | Time pressure increases risk |
| Target date > 1 month away | -1 | More buffer = less risk |

### From Linear Status

| Status | Base Points | Rationale |
|--------|-------------|-----------|
| Done | Keep estimate | Already completed, use historical estimate |
| In Progress | Keep estimate | Work is understood |
| Todo | Estimate normally | Ready to start |
| Backlog | +1 | Less refined, more unknowns |

## Default Estimates by Milestone Type

When signals are ambiguous, use these defaults:

| Milestone Type | Default Points | Example |
|----------------|----------------|---------|
| **Inventory/Discovery** | 3 | "M1: Tenant Inventory" |
| **Assessment/Analysis** | 3 | "M2: Automation Assessment" |
| **Wave 1 Execution** | 5 | "M3: Batch Onboarding - Wave 1" |
| **Wave 2+ Execution** | 5 | "M4: Batch Onboarding - Wave 2-3" |
| **Validation/Sign-off** | 2 | "M5: Validation & Commitment Execution" |
| **Setup/Configuration** | 3 | "M2: Infrastructure Manager Setup" |
| **Deployment** | 5 | "M3: Archera Deployment" |
| **Data Export** | 3 | "M2: GCP FOCUS Export Setup" |
| **Integration** | 8 | "API Integration with External System" |
| **Migration** | 8 | "Database Migration" |

## Algorithm

```python
def estimate_story_points(milestone, project, initiative):
    """
    Estimate story points for a Linear milestone.
    Returns Fibonacci number: 1, 2, 3, 5, 8, 13, or 21
    """
    name = milestone.name.lower()
    desc = (milestone.description or "").lower()

    # Start with base estimate from milestone type
    if "inventory" in name or "audit" in name:
        points = 3
    elif "assessment" in name or "analysis" in name:
        points = 3
    elif "validation" in name or "sign-off" in name:
        points = 2
    elif "setup" in name or "configuration" in name:
        points = 3
    elif "deployment" in name:
        points = 5
    elif "batch" in name or "bulk" in name:
        points = 5
    elif "integration" in name:
        points = 8
    elif "migration" in name:
        points = 8
    else:
        points = 3  # Default

    # Adjust for M1 (first milestone) - discovery work
    if "m1:" in name or "m1 " in name:
        points += 1

    # Adjust for external dependencies
    if "blocked" in desc or "waiting" in desc or "depends on" in desc:
        points += 2

    # Adjust for multiple systems
    systems = ["azure", "gcp", "aws", "jira", "github", "archera", "confluence"]
    system_count = sum(1 for s in systems if s in desc or s in name)
    if system_count >= 2:
        points += 1
    if system_count >= 3:
        points += 1

    # Adjust for automation vs manual
    if "automat" in name or "script" in name:
        points += 1
    elif "manual" in desc:
        points -= 1

    # Adjust based on Linear status
    if milestone.state == "backlog":
        points += 1

    # Clamp to valid Fibonacci values
    fibonacci = [1, 2, 3, 5, 8, 13, 21]
    return min(fibonacci, key=lambda x: abs(x - points))

def to_fibonacci(points):
    """Round to nearest Fibonacci number."""
    fibonacci = [1, 2, 3, 5, 8, 13, 21]
    return min(fibonacci, key=lambda x: abs(x - points))
```

## JIRA Field Configuration

**Field ID:** `customfield_10041` (Story Points - required for Done transition)

> **Note:** ECI JIRA has two story point fields:
> - `customfield_10041` - "Story Points" - **Used by workflow validators** (required for Done)
> - `customfield_10016` - "Story point estimate" - JIRA Software native (optional)
>
> Always set `customfield_10041` to ensure transitions work.

**Setting story points during task creation:**
```
jira_create_issue(
    project_key="ITPLAT01",
    issue_type="Task",
    summary="M1: Tenant Inventory & Archera Handoff",
    additional_fields={
        "customfield_10041": 3,  # Story points (required for Done transition)
        "duedate": "2026-02-14"
    }
)
```

**Updating story points on existing task:**
```
jira_update_issue(
    issue_key="ITPLAT01-1777",
    fields={},
    additional_fields={
        "customfield_10041": 5  # Story points
    }
)
```

## Sync Workflow Update

When syncing milestones to JIRA tasks:

1. **Estimate story points** using the algorithm above
2. **Create/update JIRA task** with `customfield_10016` set
3. **Log the estimate** for transparency:
   ```
   Estimated 3 story points for "M1: Tenant Inventory" (inventory task, first milestone)
   ```

## Override Hints

If the automatic estimate is wrong, add hints to the Linear milestone description:

| Hint Pattern | Effect |
|--------------|--------|
| `[SP:5]` | Force 5 story points |
| `[SP:HIGH]` | Use 8 points |
| `[SP:LOW]` | Use 2 points |
| `[SP:XS]` | Use 1 point |
| `[SP:XL]` | Use 13 points |
| `[SP:XXL]` | Use 21 points |

**Example:**
```
M3: Batch Onboarding - Wave 1 [SP:8]

This is more complex than usual due to CSP reseller complications.
```

## Examples

### Example 1: Azure Archera Milestones

| Milestone | Signals | Estimate |
|-----------|---------|----------|
| M1: Tenant Inventory & Archera Handoff | inventory, M1, external handoff | **5** |
| M2: Automation Assessment | assessment, scripting context | **3** |
| M3: Batch Onboarding - Wave 1 | batch, wave 1 (new), automation | **5** |
| M4: Batch Onboarding - Wave 2-3 | batch, subsequent waves | **5** |
| M5: Validation & Commitment Execution | validation, sign-off | **2** |

### Example 2: GCP Archera Milestones

| Milestone | Signals | Estimate |
|-----------|---------|----------|
| M1: GCP Inventory & Prerequisites | inventory, M1, GCP complexity | **5** |
| M2: Infrastructure Manager Setup | setup, cloud infrastructure | **5** |
| M3: Archera Deployment | deployment, integration | **5** |
| M4: Marketplace Subscription & Validation | setup, validation | **3** |

### Example 3: FOCUS Data Milestones

| Milestone | Signals | Estimate |
|-----------|---------|----------|
| M1: FOCUS Data Inventory | inventory, M1, multi-cloud | **5** |
| M2: GCP FOCUS Export Setup | setup, data export | **3** |
| M3: Commitment Coverage Assessment | assessment, analysis | **3** |
| M4: Validation Sign-off | validation only | **2** |

## Backfilling Existing Issues

To add story points to existing JIRA issues that are missing them:

```bash
/initiative-manager sync initiative "Archera" --backfill-story-points
```

This will:
1. Find all JIRA tasks without story points
2. Estimate based on the algorithm
3. Update each task with the estimate
4. Report what was updated

## Transition Requirements

Some JIRA workflows require story points to transition to certain statuses:

| Transition | Requirement | Solution |
|------------|-------------|----------|
| → Done | Story points required | Set `customfield_10016` before transition |
| → In Review | None | No action needed |
| → In Progress | None | No action needed |

If a transition fails due to missing story points:
1. Estimate story points using this algorithm
2. Update the issue with `customfield_10016`
3. Retry the transition
