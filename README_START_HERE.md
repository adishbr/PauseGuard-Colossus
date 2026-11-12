> **START WITH `TEAM_HANDOFF_SHARE_THIS_FIRST.md` — This is the complete shareable guide for all four teammates.** Current installation clarification: `docs/INSTALLATION_VERIFICATION_AND_PERMISSIONS.md`.

> **FOUR-MEMBER BASELINE — NEW IN V4:** Everyone independently verifies Antigravity, Git/Node/Python, the same six editor extensions and GitHub access. **Do not assume anyone else already installed them.** See `docs/ALL_FOUR_INSTALLATION.md`, `docs/ALL_FOUR_SETUP_TRACKER.md`, and `prompts/FIRST_SESSION_INSTALL_ALL_FOUR.md`.

> **START HERE for beginners:** `docs/TEAM_MEMBER_ONBOARDING.md` + `docs/BEGINNER_ZERO_TO_ADVANCED.md`; use `prompts/SESSION_COACH_BEGINNER.md` in a fresh ChatGPT/Antigravity/OpenCode session. The AI must ask the member number, then teach **one verified step at a time**.
> **Free-model fallback:** `docs/VERIFIED_FREE_MODEL_MATRIX_2026-11-09.md`, `docs/MODEL_FALLBACK.md`, `docs/PROVIDER_SETUP_PLAYBOOK.md`. The original Google Doc link was **not retrievable**; screenshots were supplied later but not fully verified word-for-word. See `docs/GOOGLE_DOC_SCREENSHOTS_RESEARCH_STATUS.md`.

# PauseGuard V2 — Complete Antigravity + Free-Model Team Kit (V4 docs)
**VantaWard | Updated 9 November 2026 | Docs V4 (product architecture still V2) | No automatic installations**

> FIRST STEP IN ANY AI SESSION: ask **"Which team member are you? 1 — Komal, 2 — Adish (also Atish), 3 — Gowtham (also Gautam), or 4 — Jeevan (also Jivan)?"** If a member already identifies themselves, do not ask again. Read `prompts/START_FOR_EVERY_AI.md` and that member's prompt. Do not automatically choose an owner from a pasted chat history.

## What this kit is
A portable set of Markdown specifications, AI instructions, Antigravity extension recommendations, curated external GitHub reference links, and team working rules. It does **not** install software, connect GitHub, grant permissions, or build the app automatically. Each member controls and reviews their own AI/tool actions.

## Project status and boundaries
- Canonical architecture: **V2** in `docs/ARCHITECTURE_V2.md`, `docs/PAYMENT_STATES_V2.md`, `docs/API_CONTRACT_V2.md`.
- **Do not merge V1 enums/endpoints with V2.** The root documents in this kit take priority over earlier AI prompt packs.
- Earlier local V2 demonstration backend exists separately; this kit deliberately does not distribute that demo or claim it is merged into your team's repository. The prototype has *mock* accounts and local demo authentication, not production-grade identity/UPI integration.
- Financial safety invariant: **AI never unilaterally executes a payment**, and a 30-second unanswered guardian call is not approval.
- Before pre-hackathon implementation, check organizer rules on permitted pre-built code; preserve authentic development history.

## How to begin (project owner)
1. Create one **private** GitHub repository using a neutral name such as `VantaWard/PauseGuard`. Do not assume this URL already exists.
2. Open an empty/new project folder in Antigravity. Extract/copy this kit into the root **without overwriting existing code or project rules**. In an existing project, inspect differences and resolve the conflicts in a reviewed PR.
3. Have all four read `docs/PRODUCT_WORKFLOW.md`, `docs/TEAM_ROLES.md` and `docs/GIT_WORKFLOW.md`.
4. Install editor extensions following `docs/IDE_SETUP_AND_PERMISSIONS.md`. Configure PowerShell as default terminal on Windows if WSL prompts are unwanted.
5. Decide whether to install **ECC Minimal** via official, reviewed installer; do not stack GSD/Ralph and multiple agent frameworks by default.
6. Record decisions in `docs/DECISIONS.md`; Komal and Adish own changes to core API/state contracts via joint review.
7. Each member opens a fresh AI session, supplies this repo path, identifies their member number, and uses `prompts/START_FOR_EVERY_AI.md` + role prompt.
8. Work in small branches. Any third-party GitHub source must be reviewed and explicitly approved before fetching/using it; see `docs/APPROVED_GITHUB_REFERENCES.md` and `scripts/fetch_reference.ps1`.

## Source of truth priority
Safety invariants in `AGENTS.md` > canonical V2 contracts > approved documented decisions > assigned member prompt > task prompt > external AI-generated suggestions. If documents conflict, stop and propose a contract change rather than silently pick a version.

## Files guide
- `docs/PRODUCT_WORKFLOW.md`: teach all four members the full system.
- `docs/IDE_SETUP_AND_PERMISSIONS.md`: extensions, access, optional ECC installation.
- `docs/APPROVED_GITHUB_REFERENCES.md`: curated GitHub resources and reference-fetch process.
- `docs/TEAM_ROLES.md`, `docs/GIT_WORKFLOW.md`, `docs/PHASES_AND_GATES.md`: team plan.
- `docs/PRD_V2.md`: scope, acceptance criteria, product caveats.
- `docs/ARCHITECTURE_V2.md`, `docs/API_CONTRACT_V2.md`, `docs/PAYMENT_STATES_V2.md`, `docs/POLICY_MATRIX_V2.md`: frozen V2 specs.
- `docs/INTEGRATIONS_AND_REGULATION.md`, `docs/PRIVACY_SECURITY.md`: domain boundaries.
- `docs/EXTERNAL_REFERENCE_LOCK.md`: fill with reviewed external SHAs and licenses.
- `docs/TEAM_CHAT_SHARING.md`: how each teammate can use ChatGPT shared projects or individual shared links without losing the source of truth.
- `prompts/`: start prompt, roles, reviewer/handoff.
- `.agents/rules/pauseguard-safety.md`: Antigravity project-level safety guidance.
- `.agents/skills/pauseguard-role/SKILL.md`: portable role selection skill.
- `.vscode/extensions.json`: recommended editor extensions (no automatic install).
- `scripts/fetch_reference.ps1`: optional *read-only reference* Git clone helper; manual approval required.

## Sharing the conversation with teammates
A shared ChatGPT conversation can show earlier project decisions, but it does **not** automatically update everyone with future messages or grant access to their private computers or GitHub accounts. The actual shared GitHub repository and its versioned documents—not a static chat link—are the team's reliable reference.

## Additional documents in V3 (beyond earlier V2 pack)
- `docs/BEGINNER_ZERO_TO_ADVANCED.md`, `docs/TEAM_MEMBER_ONBOARDING.md`: teach all four from basics, with evidence gates.
- `docs/INSTALL_OPENCODE_WINDOWS.md`, `docs/PROVIDER_SETUP_PLAYBOOK.md`, `docs/VERIFIED_FREE_MODEL_MATRIX_2026-11-09.md`, `docs/MODEL_FALLBACK.md`: model setup without paid upgrades.
- `docs/PLUGIN_DECISION_MATRIX.md`, `docs/API_COST_PRIVACY_GUARDS.md`, `docs/THIRD_PARTY_REPO_EVALUATION.md`: extension choice and safe GitHub fetching.
- `docs/GITHUB_AND_REPO_SETUP.md`, `docs/TROUBLESHOOTING_AND_RECOVERY.md`, `docs/LOCAL_DEVELOPMENT_RUNBOOK.md`: repo, Windows and terminal recovery.
- `docs/PAYMENT_SECURITY_TESTS.md`, `docs/REVIEW_PRIVACY_AUDIO.md`, `docs/DEMO_VS_PRODUCTION.md`, `docs/UI_EXPERIENCE_SPEC.md`, `docs/EXPERIMENT_PLAN_AND_METRICS.md`: security, scope and UX checks.
- `docs/EXTERNAL_DOC_AND_RESEARCH_STATUS.md`: user external Google Doc awaiting export before content can be assessed.
- `prompts/SESSION_COACH_BEGINNER.md`, `prompts/MODEL_SWITCH_CHECK.md`, `prompts/GITHUB_REFERENCE_EVALUATOR.md`.

**V3 extends V2 without replacing V2 payment contracts. Do not mix V1 contract enums or infer that documents automatically implement code.**
