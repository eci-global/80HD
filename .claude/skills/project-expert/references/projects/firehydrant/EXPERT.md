# FireHydrant Project Expert Knowledge

## Identity

**What**: Enterprise Terraform IaC managing the FireHydrant incident response platform across ECI Solutions. Replaces PagerDuty.

**Who uses it**: SRE teams across ~38 product teams. Travis (Platform Enablement Team Lead) is the primary developer (69% of 648 commits). SRE teams are learning IaC/GitOps/CI/CD through this project.

**The mission**: Teach SRE teams to manage their own incident automation through Infrastructure as Code instead of clicking through the FireHydrant UI. This is a cultural shift as much as a technical one — from "ops by hand" to "ops as code."

**Scale**: ~1,300 FireHydrant API resources managed across 34 Terraform state files, 38 products, 18 reusable modules.

## Architecture

### The Pipeline: CSV → YAML → Terraform

This is the most important concept in the entire project. Everything flows through this three-stage pipeline:

```
data/teams/*.csv          →  scripts/generate_configs.py  →  data/products/*.yaml  →  terraform/products/*/
(human-editable input)       (Python transformation)          (generated config)        (Terraform resources)
```

**Stage 1: CSVs** (`data/teams/`)
Team configuration in spreadsheet format. This is where SRE teams make changes. CSVs are approachable — anyone can edit a CSV. Fields include team members, escalation policies, service ownership, notification rules.

**Stage 2: Generated YAMLs** (`data/products/`)
Python scripts transform CSVs into structured YAML configs that Terraform can consume. These are GENERATED — never edit them directly. The generation step validates data, applies defaults, resolves cross-references between teams and services.

**Stage 3: Terraform** (`terraform/products/*/`)
Each product gets its own directory with Terraform configs that reference the YAML data and use shared modules. State is isolated per product.

**WHY this pipeline exists**: SRE teams aren't Terraform experts. Asking them to write HCL is a non-starter. But asking them to edit a CSV? That's approachable. The pipeline bridges the gap between "SRE team updates a spreadsheet" and "infrastructure changes deploy safely through CI/CD."

### State Isolation

34 separate Terraform state files, roughly one per product or logical group.

**WHY**: If all resources shared one state file, a plan/apply for Product A would lock out Product B. With isolated state, teams can work in parallel. A failed deployment of Product A doesn't block Product B's changes. Blast radius is contained.

**Common misconception**: "We should consolidate state files for simplicity." No — isolation IS the simplicity. Consolidated state means consolidated risk.

### Module System

18 reusable modules in `terraform/modules/`:

Core modules handle: services, teams, escalation policies, runbooks, alerts, integrations, notification rules, incident types, and more.

**WHY modules**: Every product needs roughly the same resources (services, teams, escalation policies). Without modules, you'd copy-paste Terraform across 38 product directories. One bug = 38 fixes. Modules mean one fix propagates everywhere.

**Pattern**: Products compose modules. A product directory contains:
```hcl
module "services" {
  source = "../../modules/services"
  config = local.product_config.services
}
module "teams" {
  source = "../../modules/teams"
  config = local.product_config.teams
}
```

The product's YAML config feeds into modules as variables. Modules handle the actual FireHydrant API resource creation.

### CI/CD: Wave-Based Deployments

Deployments use a wave system through GitHub Actions:

```
Wave 1: Core infrastructure (shared across all products)
Wave 2: Low-risk products (small, well-tested)
Wave 3: Medium-risk products
Wave 4: High-risk products (large, critical)
Wave 5: Final validation and smoke tests
```

**WHY waves**: If you deploy all 38 products at once and something breaks, you don't know what caused it. Waves provide progressive rollout — catch problems early with low-risk products before they hit critical ones.

**The safe-deploy tooling** (`scripts/safe-deploy/`): Python-based deployment orchestration (~112K+ lines across modules). Handles:
- Wave assignment and ordering
- Pre-flight checks (state lock status, plan validation)
- Terraform plan → human approval → apply
- Rollback capability per wave
- Deployment logging and audit trail

### Provider Configuration

The project uses the FireHydrant Terraform provider to manage API resources. Authentication via API token stored in GitHub Secrets and injected at CI/CD runtime. Local development uses `.env` files (gitignored).

## Key Decisions

### Decision: Terraform Over UI Configuration

**Why**: FireHydrant has a UI for managing everything. Why Terraform?
- **Auditability**: Every change is a git commit with author, reviewer, timestamp
- **Reproducibility**: Disaster recovery = `terraform apply`, not "click through 200 screens"
- **Review process**: PR-based workflow means changes get reviewed before deployment
- **Scale**: 38 products × dozens of resources each = thousands of clicks vs one pipeline

**What this means for SRE teams**: They need to stop thinking "I'll just change it in the UI" and start thinking "I'll update the config and open a PR." This is the hardest cultural shift.

### Decision: CSV as Input Format (Not HCL, Not JSON)

**Why**: The audience is SRE engineers who may not know Terraform. CSVs are:
- Editable in Excel, Google Sheets, or any text editor
- Diffable in PRs (unlike binary formats)
- Parseable by any language
- Familiar to everyone

The trade-off is that CSVs can't express nested data well. The Python generation step handles that translation.

### Decision: One State File Per Product (Not One Big State)

**Why**: Isolation. See "State Isolation" above. The operational cost of 34 state files (slightly more complex CI/CD) is far less than the risk cost of shared state (one bad apply affects everyone).

### Decision: Wave-Based Deployment (Not All-At-Once)

**Why**: Blast radius control. The incident automation platform is critical infrastructure — if it goes down because of a bad deployment, teams can't manage incidents. Waves ensure problems surface early.

### Decision: Python safe-deploy (Not Raw Terraform CLI)

**Why**: Raw `terraform plan && terraform apply` doesn't handle:
- Wave ordering and dependencies
- Pre-flight validation (is state locked? is another deploy running?)
- Progressive rollout with human gates between waves
- Audit logging
- Rollback orchestration

safe-deploy wraps Terraform with operational safety.

## Common Misconceptions

### "I can just change this in the FireHydrant UI"

**Reality**: Any change made in the UI will be **overwritten** on the next Terraform apply. Terraform manages state — if the real resource doesn't match Terraform's state, Terraform "fixes" it back to what the config says.

**What to do instead**: Update the CSV → regenerate YAML → update Terraform → open PR → merge → CI/CD deploys.

**Exception**: Investigating or debugging in the UI is fine. Just don't make persistent config changes there.

### "I can edit the YAML files in data/products/ directly"

**Reality**: Those YAMLs are GENERATED by `scripts/generate_configs.py` from the CSVs in `data/teams/`. If you edit a YAML directly, your change will be overwritten the next time someone runs the generator.

**What to do instead**: Edit the CSV source, then run the generator.

### "Terraform state files are backup files"

**Reality**: State files are Terraform's source of truth about what exists in the real world. They're not backups — they're the mapping between your config and real API resources. If you delete or corrupt a state file, Terraform loses track of what it manages and may try to recreate resources that already exist (causing duplicates or conflicts).

**Never**: Manually edit state files. Use `terraform state` commands if state surgery is needed, and only with Travis's involvement.

### "I need to run terraform apply locally to test my changes"

**Reality**: Local apply against production resources is dangerous. The CI/CD pipeline exists for a reason — it runs plans in isolated environments, validates changes, and deploys through waves.

**What to do instead**: Run `terraform plan` locally to validate syntax and see what would change. Let CI/CD handle the actual apply.

**For true local testing**: Use the development environment configuration (if available) or request a sandbox product from Travis.

### "All products are configured the same way"

**Reality**: Products share modules, but each product's YAML config determines which modules activate and with what parameters. Product A might have 3 services and 2 escalation policies. Product B might have 15 services, 5 teams, and custom runbooks. The module system handles this variability.

### "The CI/CD pipeline is just `terraform apply`"

**Reality**: The pipeline is orchestrated by safe-deploy which handles wave ordering, pre-flight checks, human approval gates, rollback capability, and audit logging. `terraform apply` is one step in a much larger operational workflow.

### "I need to review all the generated YAML to validate my changes"

**Reality**: You do NOT need to review 8,000 lines of generated YAML. The CSV is your review surface. The pipeline validates YAML correctness automatically. Your job is to:
1. Make your CSV change
2. Run the generator
3. Check the PR diff for your specific changes
4. Validate the output in FireHydrant after merge + deploy

The generated YAML is an intermediate artifact. Trust the pipeline to validate it. Review YOUR changes, not the entire output.

### "My changes should be visible in FireHydrant as soon as I push my PR"

**Reality**: The sequence is: CSV change → PR → review → merge → CI/CD deploy → changes appear in FH. If your PR isn't merged, nothing changes in FireHydrant. If it's merged but CI/CD hasn't run, nothing changes yet. Don't check FireHydrant until after the full pipeline completes.

**Common mistake**: Checking FH before the PR is even merged and reporting things as "broken."

### "The staff schedule and the 24x7 on-call schedule are the same thing"

**Reality**: FireHydrant shows two different schedule views:
- **Staff schedule**: Governed by time zone and work hours. Shows who's available during business hours.
- **24x7 on-call schedule**: The actual rotation for after-hours coverage. Order controlled by CSV row position.

To check on-call rotation order: Click the **...** next to the team name → look at **responders**. Don't use the main schedule view — that shows the staff schedule, not the 24x7 rotation.

### "Setting on_call to 'no' changes my position in the rotation"

**Reality**: The `on_call` column in the CSV is a binary in/out toggle — it controls whether someone is in the rotation at ALL, not their position. To change rotation **order**, reorder the rows in the CSV. The system places engineers in CSV row order, then managers after all engineers.

### "Shared Teams channels work for webhooks"

**Reality**: MS Teams shared channels do NOT support webhook workflows. You need a standard (non-shared) channel to set up the incoming webhook via the Workflows menu (...→ Workflows → "Send webhook alerts to a channel"). If you don't see the Workflows option, check that: (1) the channel isn't shared, and (2) you're an owner of the channel.

### "I broke something, I should revert my commit"

**Reality**: Reverting the git commit doesn't revert the Terraform state. If your change was already applied:
1. Open a new PR that undoes the config change
2. Let CI/CD plan and apply the rollback
3. Verify the rollback in FireHydrant UI

If the change was NOT yet applied (still in PR or CI/CD), then simply closing the PR or reverting the commit is fine.

## Learning Path

### Phase 1: Understand Why (Day 1)

Read:
- `README.md` — Project overview and getting started
- `CLAUDE.md` — How to work in this repo

**Verify**: Can you explain why we use Terraform instead of the FireHydrant UI? Can you explain what "cave mode" means in the context of SRE adoption? (Hint: teams resist IaC because they don't understand it, creating a knowledge gap that Travis bridges manually — which is the same pattern as cave mode.)

### Phase 2: Understand the Data Flow (Days 2-3)

Read:
- A CSV file in `data/teams/`
- The corresponding YAML in `data/products/`
- The Terraform directory in `terraform/products/`

Walk through:
1. Change a value in the CSV
2. Run `scripts/generate_configs.py`
3. See the YAML update
4. Run `terraform plan` to see what Terraform would change

**Verify**: Can you trace a single field from CSV through YAML to Terraform resource? Can you explain why the YAML is generated and not hand-written?

### Phase 3: Understand the Modules (Days 4-5)

Read:
- 2-3 modules in `terraform/modules/`
- See how products reference them

**Verify**: If you needed to add a new field to all services across all products, where would you change it? (Answer: the services module, which propagates to all 38 products.)

### Phase 4: Understand CI/CD (Days 6-7)

Read:
- `.github/workflows/` — GitHub Actions configuration
- `scripts/safe-deploy/` — Deployment orchestration (start with the entry point, not the full 112K lines)

**Verify**: Can you explain the wave system? Can you explain what happens if Wave 2 fails? (Answer: Waves 3-5 don't run. You investigate, fix, and re-run from Wave 2.)

### Phase 5: Self-Serve (Week 2+)

At this point you should be able to:
- Add a new service to an existing product (CSV → YAML → PR → merge)
- Add a new product (create CSV, generate YAML, create Terraform directory using existing product as template)
- Debug a failed deployment (check CI/CD logs, identify which wave and product, check Terraform plan output)
- Review PRs from other SRE team members

## Operations

### Adding a New Service to an Existing Product

1. Edit the appropriate CSV in `data/teams/` — add the service row
2. Run `python scripts/generate_configs.py` — regenerates YAML
3. Verify the YAML diff looks correct
4. Run `terraform plan` from the product directory — verify expected changes
5. Open PR, get review, merge
6. CI/CD deploys through waves

### Onboarding a New Product

Use the `/onboard-product` Claude Code skill which automates:
1. Creating the CSV template
2. Generating initial YAML
3. Scaffolding the Terraform product directory
4. Creating the state file configuration
5. Generating the initial plan for review

### Debugging a Failed Deployment

1. Check GitHub Actions logs — which wave failed?
2. Identify the product and resource that failed
3. Common causes:
   - API rate limiting (wait and retry)
   - Resource dependency not met (check wave ordering)
   - State drift (someone changed something in UI — import or reconcile)
   - Invalid config value (check YAML against module variable definitions)
4. Fix the root cause, push fix, CI/CD reruns

### State Drift Recovery

When the real FireHydrant config doesn't match Terraform state:
1. Run `terraform plan` to see the drift
2. Decide: should Terraform's config win (apply) or should the real state win (import)?
3. If importing: `terraform import <resource_type>.<name> <id>`
4. Verify with another plan — should show no changes
5. Investigate why drift happened (UI change? failed apply?)

## Decision Trees

### "Someone needs to change something in FireHydrant"

```
Is it a one-time investigation/debug? → Use the UI, no code needed
Is it a persistent config change?
  ├── Is it for an existing product?
  │   ├── Is it adding/modifying a service? → Edit CSV, regenerate, PR
  │   ├── Is it changing an escalation policy? → Edit CSV, regenerate, PR
  │   └── Is it something modules don't support? → Ask Travis to extend the module
  └── Is it a new product?
      └── Use /onboard-product skill or follow onboarding runbook
```

### "The CI/CD pipeline failed"

```
Which wave?
├── Wave 1 (core) → All subsequent waves blocked. Fix immediately.
├── Wave 2-4 (products) → Only that wave and later blocked.
│   ├── Is it a plan error? → Config issue, fix and re-push
│   ├── Is it an apply error?
│   │   ├── Rate limiting? → Wait, re-run
│   │   ├── State conflict? → Check for drift, reconcile
│   │   └── API error? → Check FireHydrant status page, contact support if needed
└── Wave 5 (validation) → Deployment succeeded but validation caught something. Investigate.
```

### "I need to understand what Terraform manages for Product X"

```
1. Read data/products/<product>.yaml — the full config
2. Read terraform/products/<product>/main.tf — the Terraform composition
3. Run terraform state list from the product directory — everything Terraform tracks
4. Cross-reference with FireHydrant UI to verify alignment
```

## Repository Structure

```
firehydrant/
├── CLAUDE.md                    ← How to work in this repo
├── AGENTS.md                    ← Coding standards (24K+)
├── README.md                    ← Project overview (27K+)
├── terraform/
│   ├── core/                    ← Shared infrastructure (state file #1)
│   ├── products/                ← 38 product directories
│   │   ├── product-a/
│   │   ├── product-b/
│   │   └── ...
│   └── modules/                 ← 18 reusable modules
│       ├── services/
│       ├── teams/
│       ├── escalation-policies/
│       ├── runbooks/
│       └── ...
├── data/
│   ├── teams/                   ← Source CSVs (human-editable)
│   └── products/                ← Generated YAMLs (DO NOT EDIT)
├── scripts/
│   ├── generate_configs.py      ← CSV → YAML transformer
│   └── safe-deploy/             ← Deployment orchestration (Python)
├── .github/workflows/           ← CI/CD (GitHub Actions)
├── .claude/
│   └── skills/
│       ├── onboard-product/     ← New product scaffolding
│       └── two-claude-review/   ← Plan review
└── .mcp.json                    ← MCP: Atlassian, Firecrawl, Playwright
```

## Known Issues & Operational Context

### FireHydrant API 504 Timeouts

The FireHydrant API intermittently returns 504 Gateway Timeout errors during Terraform operations, especially when managing many resources in a single run. This affects both local `terraform plan/apply` and the CI/CD pipeline.

**Workarounds**: Run operations sequentially (not parallel). If 504s occur in CI/CD, push what you have to the PR and work through failures iteratively. FH support has been engaged on the platform side.

**SRE teams should know**: 504s are NOT caused by your changes. They're an upstream API issue. If you see a 504 in your pipeline, don't assume your code is broken.

### GitHub SSO Migration

SSO was enabled for the ECI-global GitHub org. This requires all users to re-authenticate via Okta. Common issues:
- Users not added to the GitHub Okta app (need Okta admin to add them)
- Existing git credentials stop working (need `gh auth login` to re-auth)
- Users see "repo not found" when they actually lack SSO authorization

**Fix**: Log in to GitHub via the Okta chicklet. Then `gh auth login` to re-authorize CLI access. If that doesn't work, confirm with Sean Wilson or Travis that your account has repo access.

### On-Call Rotation Ordering

CSV row order determines 24x7 on-call rotation order. The system places engineers in CSV order, then managers after all engineers. **This is the single most confusing aspect of the system for SRE teams.**

Key points:
- Handoffs (cover me / shift swaps) are NOT managed by IaC — use FH UI directly
- If rotation order needs to change frequently (e.g., weekly), the current PR process may be too slow. Custom tooling for fast-rotating teams is being considered.
- The `on_call` column is yes/no only — it controls whether someone is IN the rotation, not their position

### PagerDuty vs FireHydrant Escalation Differences

The current FH escalation policies differ from PagerDuty:

| Step | PagerDuty | FireHydrant |
|------|-----------|-------------|
| 0 | — | MS Teams channel notification |
| 1 | Office Hours | Office Hours |
| 2 | Alert other teams (optional) | On-call |
| 3 | On-call | Escalation to manager |
| 4 | Daytime notification | — |
| 5 | Ping everyone | — |
| 6 | Repeat process 1x | — |

**Known gaps**: No director+ escalation in FH yet. FH uses 15min between escalations vs PD's 30min. Both are being addressed.

### Product Naming / Slug Convention

Product slugs are based on Nexus (Salesforce) product codes where possible. This means product names in the repo may not match the "Product Registered Long Name" or internal product codes that SRE teams use. If you can't find a product, check `data/products/<slug>.yaml` filenames or ask your IDE.

### Team Structure (as of onboarding)

| Manager | Team | Sub-teams / Products |
|---------|------|---------------------|
| Blaze Lewis | Distribution | ROW (~9 products), EU (~5 products), LBMH (~4 products) |
| Sean Wilson | Applications | Applications team products |
| Rick Clemens | Manufacturing | M1, JB2, DataInv, JobBOSS |
| Brett Welschmeyer | UTR | Unified Technology Resources |
| Jeremy Larsen | Network/Infra | Network and Infrastructure teams |

## Vocabulary

- **Product**: A logical grouping in FireHydrant (maps to a business product/service)
- **State file**: Terraform's record of what resources it manages. One per product.
- **Wave**: A deployment group. Products are assigned to waves based on risk.
- **safe-deploy**: Python tooling that orchestrates multi-wave Terraform deployments
- **Config generation**: The CSV → YAML → Terraform pipeline
- **State drift**: When real resources don't match what Terraform expects
- **Module**: Reusable Terraform code that multiple products share
- **Onboarding**: Adding a new product to the Terraform management system
