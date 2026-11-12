# PauseGuard VantaWard — Share This First (All Four Members)

**Package revision:** V4.1 team handoff (product architecture V2) · 9 November 2026
**Audience:** Member 1 Komal; Member 2 Adish (Atish); Member 3 Gowtham (Gautam); Member 4 Jeevan (Jivan).
**Status:** Documentation/instructions only. No GitHub repository or local software was automatically installed, configured or deployed.

## 1. What we are building
PauseGuard is an anti-scam payment intervention prototype for fraudulently induced UPI-style transactions. The primary P2P transaction rail uses **synthetic money and simulated accounts**; an actual merchant gateway may be evaluated separately, later. An advisory risk model and behavioral context produce signals. The deterministic backend picks a protection tier. Legitimate low-risk payments proceed without a guardian. If required, a *previously enrolled* guardian or eligible business checker can review. The optional 30/45/60-second guardian response timer does **not** imply approval on timeout; AI analysis can run alongside the timer but only provides advice. If independent evidence is insufficient, high-risk payment remains unexecuted. We support privacy, account-specific business baselines, Safe-Lock, anti-smurfing, audit and fraud-reporting assistance.

**Invariant:** Only authenticated backend commands may authorize and execute a simulated transfer, and only once; neither an LLM nor a guardian UI can directly move money. Read `docs/PRODUCT_WORKFLOW.md`, `docs/ARCHITECTURE_V2.md`, `docs/PAYMENT_STATES_V2.md`, and `docs/PRIVACY_SECURITY.md` before coding.

## 2. Share correctly
- One team member creates a single private GitHub repo **only if it does not already exist**. Do not invent an actual org/repo URL. The owner invites the other three using their *own* GitHub accounts.
- Copy the contents of **this ZIP's root folder** into the repository root; do not accidentally nest the project inside itself. If project files already exist, compare and merge them in a reviewed branch; never blindly overwrite.
- Each teammate clones the same repository into an independent directory on their own PC. `.vscode/extensions.json` *recommends* extensions, but does not actually install them.
- A shared ChatGPT conversation link is a snapshot/reference, **not** automatically synchronized context or a connected Git repo. Every member needs the latest shared ZIP/repo documents and must clearly state their identity in their own session.
- Do not commit `.env`, tokens, keys, account credentials, personal folder names, real transaction history, real call audio or private user records.

## 3. Member routing — first response from any AI
If the person has NOT explicitly identified their membership in the current chat, ask exactly:

> Which member are you? **1 — Komal, 2 — Adish (Atish), 3 — Gowtham (Gautam), or 4 — Jeevan (Jivan)?**

Then read `AGENTS.md`, `docs/TEAM_MEMBER_ONBOARDING.md`, `prompts/FIRST_SESSION_INSTALL_ALL_FOUR.md` and `prompts/MEMBER_<number>_*.md`. First orient the teammate to the whole workflow and their responsibility; then coach them from their *own actual* environment. **One instruction at a time**; ask for screenshots/command output with secrets hidden and confirm success before the next step. Never re-ask the member question if answered.

## 4. Every person completes the same IDE setup (not only Adish)
| Check / utility | Komal | Adish | Gowtham | Jeevan |
|---|---|---|---|---|
| Google Antigravity IDE, current project open | Verify | Verify | Verify | Verify |
| Windows PowerShell terminal, Git, Node.js/npm, Python | Verify | Verify | Verify | Verify |
| `ms-python.python` Python | Verify | Verify | Verify | Verify |
| `dbaeumer.vscode-eslint` ESLint | Verify | Verify | Verify | Verify |
| `esbenp.prettier-vscode` Prettier | Verify | Verify | Verify | Verify |
| `bradlc.vscode-tailwindcss` Tailwind CSS IntelliSense | Verify | Verify | Verify | Verify |
| `github.vscode-pull-request-github` GitHub Pull Requests | Verify | Verify | Verify | Verify |
| `ms-playwright.playwright` Playwright Test | Verify | Verify | Verify | Verify |
| GitHub signed in with individual account, collaboration invite accepted | Verify | Verify | Verify | Verify |
| `AGENTS.md` and V2 docs load in IDE | Verify | Verify | Verify | Verify |

"Verify" does not claim installed. Each member opens Antigravity, `Ctrl+Shift+X` → searches exact ID → confirms publisher and installs if missing. An unavailable extension must be recorded as **UNSUPPORTED**, not falsely marked installed. See `docs/ALL_FOUR_SETUP_TRACKER.md` and `docs/ALL_FOUR_INSTALLATION.md`.

## 5. Prerequisite checks (PowerShell, run in each person's own terminal)
```powershell
git --version
node --version
npm --version
python --version
opencode --version
```
Missing OpenCode is fine for the *editor baseline*; install it separately only if that person chooses a free-model terminal workflow. Run `opencode --version` before reinstalling. The official OpenCode guide (https://opencode.ai/docs/) currently lists `npm install -g @opencode/cli` for the latest CLI; confirm the current official page before using it, as older videos mention `opencode-ai`. OpenCode lives **inside the IDE terminal**, not as an Antigravity model slot. No WSL is required if the native Windows CLI works.

## 6. Optional project/AI tooling and access
- **Everything Claude Code (ECC) Minimal:** install/merge **once into the shared repository on a reviewed branch**, not four independent installs into the same project. The other three receive approved `.agents/` rules/skills via Git. Official source: https://github.com/affaan-m/ECC ; inspect official Antigravity adapter and its target option before execution.
- **OpenCode providers:** each person creates their own provider account and authenticates locally using `/connect`; choose model with `/models`, test an actual response, verify the `:free` variant and its account limits. Never assume a model is free by its display name.
- **GSD, Ralph Loop:** optional alternatives/experiments, not baseline. Do not stack autonomous frameworks in the payment engine.
- **CodeRabbit:** optional GitHub pull-request app, with separately verified billing/access. **Not** an Antigravity editor requirement.
- **External reference GitHub repos:** these are candidate sources, not pre-approved executable software. Agent proposes one, user approves fetch, agent checks LICENSE/commit/security before reuse. See `docs/APPROVED_GITHUB_REFERENCES.md` and `scripts/fetch_reference.ps1`.
- **Sensitive provider access:** sandbox/test only if needed; never grant unrestricted production bank, telephony, Supabase service-role, email, payment-gateway or deployment credentials to a general coding agent.

## 7. Who owns what (fixed, unless all four approve a revision)
| Member | Primary role | First bounded milestone |
|---|---|---|
| 1 **Komal** | Core backend, state machine, policy, auth, database, API | `/api/v2/payments` transaction flow + state tests |
| 2 **Adish** | Core frontend, payer/guardian experience, consent, live UI | Two browser windows using agreed payment API/mocks |
| 3 **Gowtham** | Advisory ML signals, behavior baseline, graph, Policy Lab | Deterministic `RiskSignals` result and synthetic test fixtures |
| 4 **Jeevan** | Anti-smurfing, Safe-Lock, privacy, audit, recovery, QA | Safety scenario tests + Safe-Lock and velocity logic |

Komal and Adish own core integration; shared V2 contracts may change only after joint review. Read `docs/TEAM_ROLES.md` and role prompt for exact file boundaries.

## 8. The development path for every member
1. Confirm identity, IDE, GitHub and existing installed tools; don't reinstall proven working software.
2. Learn complete product workflow and role boundaries.
3. Clone latest repo; check branch and docs are current; verify read-only agent can summarize architecture.
4. Get first small scoped task approved; list files it may edit and contract inputs/outputs.
5. Write tests and implement one feature; run tests and capture actual results.
6. Push a **feature** branch; request cross-module review; merge only after relevant tests pass.
7. Update `docs/PROGRESS.md` with completed/pending/tested/blocked, and repeat for next milestone.

## 9. Permission guardrails and free-model fallback
Default to **ask/review** for AI shell commands and edits, not unrestricted auto-execution. Allow read of the project folder; GitHub collaborator access must use each person's own credentials. Check changes before applying; never execute an arbitrary downloaded shell script blindly. No `git push --force`, global installs, paid billing, deploy, database wipes, or production modifications without explicit approval.

Free model candidates include OpenRouter `:free` Nemotron, NVIDIA Build prototype models, Groq free-plan GPT-OSS, and eligible Antigravity built-in options. **Model names, availability, quotas and terms change**; check the current provider listing instead of copying IDs blindly. Do not upload private code or real financial/customer data to a free provider without verifying its data policy. See `docs/MODEL_FALLBACK.md` and `docs/VERIFIED_FREE_MODEL_MATRIX_2026-11-09.md`.

## 10. Handoff test — before development starts
Every teammate's AI should answer correctly: (a) We simulate UPI-style P2P initially; (b) no guardian review on ordinary low-risk payments; (c) AI never authorizes a critical transfer; (d) guardian timeout is never approval; (e) only backend changes payment state; (f) their own member's files only; (g) external repos require permission, license and commit review; (h) test results cannot be invented.

**If any answer is wrong, stop and reread the V2 contracts.**
