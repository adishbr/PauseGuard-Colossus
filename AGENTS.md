# PauseGuard — universal agent instructions (V2)
## Member identification / first turn
If the human hasn't already identified their member in the current session, ask exactly:
**Which team member are you? 1 — Komal; 2 — Adish (Atish); 3 — Gowtham (Gautam); 4 — Jeevan (Jivan)?**
Wait for the answer before accepting implementation tasks. If their member is already known, acknowledge the role and read the appropriate `prompts/MEMBER_*.md`.

## Teach the teammate one step at a time
All fresh users should consult `docs/TEAM_MEMBER_ONBOARDING.md`, `docs/BEGINNER_ZERO_TO_ADVANCED.md`, and `prompts/SESSION_COACH_BEGINNER.md`. When the person identifies as member 1/2/3/4, first explain their assigned responsibilities and project flow simply. For environment setup, give only **one action per response**, expected result and screenshot/output check. Do not dump the entire process, skip successful setup, or assume a legacy prompt means OpenCode is absent. If model becomes unavailable, read `docs/MODEL_FALLBACK.md` and never select a paid model without consent.

## Read before implementation
`README_START_HERE.md`, `docs/PRODUCT_WORKFLOW.md`, `docs/ARCHITECTURE_V2.md`, `docs/PAYMENT_STATES_V2.md`, `docs/API_CONTRACT_V2.md`, `docs/POLICY_MATRIX_V2.md`, `docs/PRIVACY_SECURITY.md`, `docs/TEAM_ROLES.md`, `docs/DECISIONS.md`, then the member prompt. If any file unavailable, state that plainly rather than guessing. Keep a short architecture summary and list of specific files to change.

## Scope and security invariants
- PauseGuard is a **mock-rail UPI APP-fraud intervention prototype**; a payment gateway is a separate optional *merchant* checkout. No claim of bank-wide interception, DPIP access or recovering arbitrary completed UPI transfers.
- Canonical API base is `/api/v2`, currency `amount_paise` integer; names and statuses strictly follow V2 files. Do not quietly retrofit V1 (`PENDING_REVIEW`, `/api/v1`, etc.).
- Payer, guardian, analyst and admin roles are independently authenticated/authorized server-side. Ignore client-supplied actor IDs and role claims.
- AI provides *advisory signals*, never direct payment approvals, balances, hard-block overrides or execution. Human guardian unavailable for 30s **never** causes automatic execution.
- Only backend-authorized, idempotent state machine transitions can execute a mock payment; recheck hard risks and Safe-Lock at final confirmation. Terminal statuses never transition.
- User-configured payment alert threshold and self-selected business category cannot override independent policy or confirmed fraud indicators.
- Guardian alerts contain no full payment details by default; guardian enrollment is opt-in, device location requires informed consent; phone number cannot locate third parties.
- Consent and provenance are required for any call audio/transcript. Voice tone is not a lie detector; AI hallucination/false reassurance must not authorize payment.
- Real UPI, bank accounts, real money, deployment and production data are OUT of scope without explicit legal/provider approval. No API secrets in source or prompts; `.env` and local credentials ignored.
- Never claim impossible security, RBI certification, model accuracy from synthetic data, actual tests not run, or code implemented by another teammate.

## Collaboration rules
- Root docs are the contract; only Komal + Adish jointly approve core API/payment-state modifications; other role owners must propose changes via PR.
- Work only in your assigned directory by default; shared files require a reviewed proposal.
- No silent destructive commands, global tool installs, secrets exposure, `git push --force`, changing branch protections, modifying billing or production settings. These require explicit human review and approval.
- External GitHub repos in docs are **approved candidates for evaluation**, NOT blanket approval to clone/install/execute. When a task explicitly requires one, name the repo, justify it, obtain approval for network fetch, inspect license/commit/security, log the version, and only then copy or adapt suitable licensed code. Do not blindly run external install scripts.
- Give a small plan and acceptance tests before editing. After edits: changes, APIs, tests actually run, failures, security considerations and handoff notes. Never invent test outcomes.

## ChatGPT session onboarding
When this specification is pasted in a ChatGPT continuation, ask for member number if missing; explain that each teammate needs the **current repo docs** as context; the shared chat link alone does not provide cross-chat shared memory or GitHub permission.
