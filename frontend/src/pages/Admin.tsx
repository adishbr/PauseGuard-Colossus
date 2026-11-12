import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { defaultReviewDuration } from '../../mocks/reviewPreference.ts'
import { beneficiaries, purposes, scenarios } from '../../mocks/scenarios.ts'
import { Icon } from '../components/Icon.tsx'
import { PaymentStatus } from '../components/PaymentStatus.tsx'
import { accountApi, AccountError } from '../services/accountApi.ts'
import { adminCreatePayment, adminMockApi, paymentError } from '../services/adminApi.ts'
import { decimalRupees, formatRupees, toPaise } from '../services/demoSession.ts'
import type { DemoSession } from '../types/account.ts'
import { razorpayRequiredEndpoints } from '../types/admin.ts'
import type { AdminAuditEntry, AdminTestMode, AuditVerifyResult } from '../types/admin.ts'
import type { PayerPayment } from '../types/payment.ts'

type DemoScenario = (typeof scenarios)[number]

const scenarioTitles: Record<DemoScenario['title'], string> = {
  everyday: 'Everyday purchase',
  unfamiliar: 'Unfamiliar supplier',
  coerced: 'Coerced KYC transfer',
  flagged: 'Flagged recipient',
}

// ─── Admin Login (/admin/login) ───────────────────────────────────────────────

export function AdminLogin({ onSession, expired, registrationBlocked = false }: {
  onSession: (session: DemoSession) => void
  expired: boolean
  registrationBlocked?: boolean
}) {
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const session = await accountApi.login('admin', contact.trim())
      onSession(session)
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not sign in. Check the demo service and retry.')
    } finally {
      setBusy(false)
    }
  }

  async function trySample() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const session = await accountApi.login('admin', '', true)
      onSession(session)
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not load sample admin. Check the demo service and retry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card workspace-card admin-login-card" aria-labelledby="admin-login-heading">
      <div className="admin-login-header">
        <div className="symbol caution">
          <Icon name="shieldAlert" />
        </div>
        <div>
          <p className="eyebrow">Admin access only · No public registration</p>
          <h1 id="admin-login-heading">Admin Payment Testing Portal</h1>
          <p className="card-lead">
            Sign in with a provisioned demo admin identity to test Mock UPI interventions and preview the Razorpay sandbox integration.
          </p>
        </div>
      </div>

      {registrationBlocked && (
        <div className="notice" role="alert">
          <p>Public admin registration is disabled. Use the provisioned demo admin credentials to sign in.</p>
        </div>
      )}

      {expired && (
        <div className="notice" role="alert">
          <p>Your admin session expired. Sign in again to continue.</p>
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} className="admin-login-form">
        <div className="form-field">
          <label>
            Provisioned admin email
            <input
              type="text"
              autoComplete="username"
              placeholder="admin@pauseguard.test"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={busy}
              required
            />
          </label>
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !contact.trim()}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Signing in…</> : <><Icon name="shield" size={16} /> Sign in as admin</>}
          </button>
          <button className="secondary" type="button" disabled={busy} onClick={() => void trySample()}>
            Open sample admin
          </button>
          <a className="text-button" href="/">Return to homepage</a>
        </div>
      </form>

      <div className="admin-login-meta">
        <span className="pill neutral"><Icon name="lock" size={13} /> Provisioned demo identity: <code>admin@pauseguard.test</code></span>
        <span className="pill neutral">Server-enforced role boundary</span>
      </div>
    </section>
  )
}

// ─── Mode A — Mock UPI Testing Panel ──────────────────────────────────────────

type MockUpiPhase = 'configure' | 'running'

function MockUpiPanel({ token, accountId }: { token: string; accountId: string }) {
  const [phase, setPhase] = useState<MockUpiPhase>('configure')
  const [paymentId, setPaymentId] = useState<string>()
  const [syntheticSession, setSyntheticSession] = useState<DemoSession>()
  const [syntheticSafeLock, setSyntheticSafeLock] = useState(false)
  const [contextBusy, setContextBusy] = useState(false)

  // Test payment builder state
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(scenarios[2])
  const [beneficiary, setBeneficiary] = useState<string>(scenarios[2].beneficiary)
  const [amount, setAmount] = useState<string>(scenarios[2].amount)
  const [purpose, setPurpose] = useState<string>(scenarios[2].purpose)
  const [invalidAmount, setInvalidAmount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runError, setRunError] = useState('')

  // Audit evidence state
  const [auditPayment, setAuditPayment] = useState<PayerPayment | null>(null)
  const [auditEvents, setAuditEvents] = useState<AdminAuditEntry[]>([])
  const [auditVerify, setAuditVerify] = useState<AuditVerifyResult | null>(null)
  const [auditError, setAuditError] = useState('')
  const [recentTests, setRecentTests] = useState<PayerPayment[]>([])

  const fetchAuditData = useCallback(async (targetPaymentId?: string) => {
    const [auditRes, verifyRes] = await Promise.all([
      adminMockApi.getAudit(token, targetPaymentId),
      adminMockApi.verifyAuditChain(token),
    ])
    return { auditRes, verifyRes }
  }, [token])

  const loadAudit = useCallback(async (targetPaymentId?: string) => {
    try {
      setAuditError('')
      const { auditRes, verifyRes } = await fetchAuditData(targetPaymentId)
      setAuditVerify(verifyRes)
      if (targetPaymentId) {
        setAuditPayment(auditRes.payments[0] ?? null)
        setAuditEvents(auditRes.events)
      } else {
        setRecentTests(auditRes.payments)
      }
    } catch (err) {
      setAuditError(err instanceof AccountError ? err.message : 'Unable to load mock audit evidence.')
    }
  }, [fetchAuditData])

  useEffect(() => {
    let active = true
    void fetchAuditData().then(
      ({ auditRes, verifyRes }) => {
        if (!active) return
        setAuditError('')
        setAuditVerify(verifyRes)
        setRecentTests(auditRes.payments)
      },
      (err: unknown) => {
        if (!active) return
        setAuditError(err instanceof AccountError ? err.message : 'Unable to load mock audit evidence.')
      },
    )
    return () => { active = false }
  }, [fetchAuditData])

  async function toggleSafeLock(nextValue: boolean) {
    if (contextBusy) return
    setContextBusy(true)
    setRunError('')
    try {
      const nextSession = await adminMockApi.getSyntheticPayerSession(token, nextValue)
      setSyntheticSession(nextSession)
      setSyntheticSafeLock(nextSession.profile.safeLock)
    } catch (err) {
      setRunError(err instanceof AccountError ? err.message : 'Could not update synthetic payer Safe-Lock.')
    } finally {
      setContextBusy(false)
    }
  }

  function applyScenario(scenario: DemoScenario) {
    setSelectedScenario(scenario)
    setBeneficiary(scenario.beneficiary)
    setAmount(scenario.amount)
    setPurpose(scenario.purpose)
    setInvalidAmount(false)
    setRunError('')
  }

  async function runTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const paise = toPaise(amount)
    if (!paise) {
      setInvalidAmount(true)
      return
    }
    setInvalidAmount(false)
    setBusy(true)
    setRunError('')
    try {
      // Obtain or refresh an explicitly authorized synthetic payer session.
      // Admin tokens cannot call /api/v2/payments directly.
      const payerCtx = syntheticSession && syntheticSession.expiresAt > Date.now() + 30_000
        ? syntheticSession
        : await adminMockApi.getSyntheticPayerSession(token, syntheticSafeLock)
      setSyntheticSession(payerCtx)

      const idempotency_key = `admin-test:${accountId}:${Date.now()}`
      const result = await adminCreatePayment(
        payerCtx.token,
        { beneficiary_id: beneficiary, amount_paise: paise, purpose, idempotency_key },
        defaultReviewDuration,
      )
      setPaymentId(result.payment.id)
      setPhase('running')
      await loadAudit(result.payment.id)
    } catch (err) {
      if (err instanceof AccountError) {
        setRunError(err.message)
      } else {
        const key = paymentError(err).key
        setRunError(key === 'accessError'
          ? 'Synthetic payer context was rejected. Check that the local mock service is running.'
          : `Test payment failed (${key}). Check the inputs and retry.`)
      }
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setPaymentId(undefined)
    setAuditPayment(null)
    setAuditEvents([])
    setPhase('configure')
    setRunError('')
    void loadAudit()
  }

  const parsedPaise = toPaise(amount) ?? 0

  if (phase === 'running' && paymentId && syntheticSession) {
    return (
      <div className="admin-test-running">
        <div className="admin-section-label">
          <span className="pill mint"><Icon name="activity" size={13} /> Canonical Mock UPI State</span>
          <span className="pill neutral">Synthetic Payer Context · {syntheticSession.profile.id}</span>
          {syntheticSafeLock && <span className="pill danger"><Icon name="lock" size={13} /> Safe-Lock ON</span>}
        </div>

        <PaymentStatus
          role="payer"
          token={syntheticSession.token}
          id={paymentId}
          locale="en"
          onClose={reset}
        />

        {/* Audit & Risk Evidence Card */}
        <section className="admin-audit-card" aria-label="Mock audit evidence and risk evaluation">
          <div className="admin-audit-header">
            <div>
              <p className="eyebrow">Mock audit evidence · Synthetic</p>
              <h3>Risk Evaluation &amp; State Transitions</h3>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => void loadAudit(paymentId)}
            >
              Refresh evidence
            </button>
          </div>

          {auditError && <p className="field-error" role="alert">{auditError}</p>}

          {auditPayment && (
            <dl className="payment-details admin-audit-metrics">
              <div>
                <dt>Authoritative Status</dt>
                <dd><code>{auditPayment.status}</code></dd>
              </div>
              <div>
                <dt>Tier &amp; Risk Score</dt>
                <dd>Tier {auditPayment.tier} · Score {auditPayment.risk_score}/100</dd>
              </div>
              <div>
                <dt>Version &amp; Amount</dt>
                <dd>v{auditPayment.version} · {auditPayment.amount_paise} paise</dd>
              </div>
            </dl>
          )}

          {auditPayment && (
            <div className="admin-reason-row">
              <span className="admin-reason-label">Reason codes:</span>
              {auditPayment.reason_codes.length > 0 ? (
                auditPayment.reason_codes.map((code) => (
                  <code key={code} className="admin-code-chip">{code}</code>
                ))
              ) : (
                <span className="field-help">None triggered</span>
              )}
            </div>
          )}

          {auditVerify && (
            <div className="admin-hash-status">
              <span className={`pill ${auditVerify.valid ? 'mint' : 'danger'}`}>
                <Icon name={auditVerify.valid ? 'checkCircle' : 'alertTriangle'} size={13} />
                {auditVerify.valid ? 'Hash chain verified' : 'Hash mismatch'}
              </span>
              <span className="field-help">
                {auditVerify.total_events} total mock events · Head: <code>{auditVerify.head_hash.slice(0, 12)}…</code>
              </span>
            </div>
          )}

          {auditEvents.length > 0 && (
            <ol className="admin-audit-timeline">
              {auditEvents.map((ev) => (
                <li key={ev.seq} className="admin-audit-event">
                  <div className="admin-event-top">
                    <span className="pill neutral">#{ev.seq} · {ev.event}</span>
                    <code>{ev.fromStatus ?? 'INIT'} → {ev.toStatus} (v{ev.version})</code>
                  </div>
                  <div className="admin-event-meta">
                    <span>Actor: {ev.actorRole}</span>
                    <span>Hash: <code>{ev.hash.slice(0, 14)}…</code></span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="actions">
          <button className="secondary" type="button" onClick={reset}>
            <Icon name="zap" size={16} /> Back to test builder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-mode-panel">
      <div className="admin-section-label">
        <p className="admin-mode-desc">
          Run synthetic payments through PauseGuard's canonical <code>/api/v2/payments</code> engine using an isolated synthetic payer context.
          Guardian review, Safe-Lock, warnings, and separate payer confirmation rules remain enforced.
        </p>
      </div>

      {/* Synthetic Payer Isolation & Safe-Lock Toggle */}
      <div className="admin-context-bar">
        <div className="admin-context-info">
          <span className="pill neutral"><Icon name="shield" size={13} /> Context: <code>admin-synthetic-payer</code></span>
          <span className="field-help">Admin token cannot call payer endpoints directly or view other users' payments.</span>
        </div>
        <button
          type="button"
          className={syntheticSafeLock ? 'reject' : 'secondary'}
          aria-pressed={syntheticSafeLock}
          disabled={contextBusy}
          onClick={() => void toggleSafeLock(!syntheticSafeLock)}
        >
          <Icon name={syntheticSafeLock ? 'lock' : 'unlock'} size={15} />
          <span>Safe-Lock: {syntheticSafeLock ? 'ON (Blocks test)' : 'OFF'}</span>
        </button>
      </div>

      {/* Scenario selector */}
      <div className="scenarios">
        <h2>Quick risk scenarios</h2>
        <div className="scenario-list">
          {scenarios.map((scenario) => (
            <button
              key={scenario.title}
              type="button"
              className="scenario"
              aria-pressed={selectedScenario?.title === scenario.title}
              onClick={() => applyScenario(scenario)}
            >
              <span className={`pill ${scenario.tag === 'blocked' ? 'danger' : scenario.tag === 'guardianReview' || scenario.tag === 'warning' ? 'caution' : 'mint'}`}>
                {scenario.tag}
              </span>
              <strong>{scenarioTitles[scenario.title]}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* Custom configuration form */}
      <form onSubmit={(e) => void runTest(e)} className="admin-test-form">
        <div className="form-fields">
          <div className="form-field">
            <label>
              Beneficiary
              <select
                value={beneficiary}
                onChange={(e) => { setBeneficiary(e.target.value); setSelectedScenario(null) }}
              >
                {Object.entries(beneficiaries).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-field">
            <label>
              Purpose
              <select
                value={purpose}
                onChange={(e) => { setPurpose(e.target.value); setSelectedScenario(null) }}
              >
                {Object.entries(purposes).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-field full">
            <label htmlFor="admin-amount-input">Amount (INR)</label>
            <div className={`amount-field${invalidAmount ? ' field-invalid' : ''}`}>
              <span aria-hidden="true">₹</span>
              <input
                id="admin-amount-input"
                type="text"
                inputMode="decimal"
                aria-invalid={invalidAmount}
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setInvalidAmount(false); setSelectedScenario(null) }}
                disabled={busy}
              />
            </div>
            {invalidAmount && (
              <span className="field-error" role="alert">
                Enter a positive rupee amount with up to two decimal places.
              </span>
            )}
          </div>
        </div>

        {runError && <p className="field-error" role="alert">{runError}</p>}

        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? <><span className="spinner" aria-hidden="true" /> Creating synthetic payment…</>
              : <><Icon name="zap" size={16} /> Create synthetic test payment</>}
          </button>
        </div>
      </form>

      {/* Payload preview */}
      <dl className="payment-details admin-preview-summary">
        <div>
          <dt>Amount (integer paise)</dt>
          <dd>{parsedPaise > 0 ? `${formatRupees(parsedPaise)} (${parsedPaise})` : `₹${decimalRupees(0)} (0)`}</dd>
        </div>
        <div>
          <dt>Beneficiary ID</dt>
          <dd>{beneficiaries[beneficiary as keyof typeof beneficiaries] ?? beneficiary}</dd>
        </div>
        <div>
          <dt>Purpose</dt>
          <dd>{purposes[purpose as keyof typeof purposes] ?? purpose}</dd>
        </div>
      </dl>

      {/* Recent synthetic tests table */}
      {recentTests.length > 0 && (
        <section className="admin-recent-section" aria-label="Recent synthetic test runs">
          <h3>Recent synthetic test runs ({recentTests.length})</h3>
          <ul className="admin-recent-list">
            {recentTests.slice(0, 5).map((item) => (
              <li key={item.id} className="admin-recent-item">
                <div>
                  <code>{item.id}</code>
                  <span className="field-help">
                    {formatRupees(item.amount_paise)} · Tier {item.tier} · Score {item.risk_score}
                  </span>
                </div>
                <span className={`pill ${item.status === 'EXECUTED' ? 'mint' : item.status === 'REJECTED' || item.status === 'CANCELLED' ? 'danger' : 'caution'}`}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ─── Mode B — Razorpay Test Mode Panel (Disabled Preview) ─────────────────────

function RazorpayPanel() {
  return (
    <div className="admin-mode-panel">
      <div className="admin-razorpay-unavailable">
        <div className="admin-section-label">
          <span className="pill caution"><Icon name="alertTriangle" size={13} /> TEST ONLY · Backend Not Available</span>
          <span className="pill neutral">SANDBOX / DISABLED</span>
        </div>
        <p className="admin-mode-desc">
          Razorpay Test Mode requires Komal's FastAPI backend endpoints for order creation and HMAC signature verification.
          Checkout remains disabled until backend integration is completed. No real money is transferred.
        </p>
      </div>

      {/* Disabled checkout & reconciliation preview */}
      <div className="card admin-razorpay-preview">
        <div className="card-header">
          <div className="symbol caution"><Icon name="zap" /></div>
          <div className="grow">
            <p className="eyebrow">Sandbox checkout preview · TEST ONLY</p>
            <h2>Razorpay Merchant Test Checkout</h2>
          </div>
          <span className="pill caution">DISABLED</span>
        </div>

        <dl className="payment-details admin-razorpay-fields">
          <div>
            <dt>Razorpay Order ID</dt>
            <dd>— (pending backend)</dd>
          </div>
          <div>
            <dt>Razorpay Payment ID</dt>
            <dd>— (pending callback)</dd>
          </div>
          <div>
            <dt>Amount &amp; Currency</dt>
            <dd>₹0.00 · INR (0 paise)</dd>
          </div>
          <div>
            <dt>Signature Verification</dt>
            <dd>Server-side HMAC required</dd>
          </div>
          <div>
            <dt>Reconciliation Status</dt>
            <dd>Unavailable</dd>
          </div>
          <div>
            <dt>Public Test Key</dt>
            <dd>Not configured</dd>
          </div>
        </dl>

        <div className="actions">
          <button
            className="primary admin-disabled-btn"
            type="button"
            disabled
            aria-disabled="true"
          >
            <Icon name="lock" size={16} /> Open Razorpay Test Checkout (Disabled)
          </button>
          <span className="pill neutral">Awaiting FastAPI backend</span>
        </div>

        <p className="form-note">
          Security invariant: checkout can never mark a payment complete from client-side callbacks alone.
          <code>key_secret</code> stays strictly on the backend.
        </p>
      </div>

      {/* Required backend endpoints */}
      <div className="card admin-endpoints-card">
        <div className="card-header">
          <div className="symbol"><Icon name="fileText" /></div>
          <div>
            <p className="eyebrow">Backend dependencies (Komal)</p>
            <h2>Required FastAPI Endpoints</h2>
          </div>
        </div>
        <ul className="admin-endpoint-list">
          {razorpayRequiredEndpoints.map((ep) => (
            <li key={ep.path} className="admin-endpoint-item">
              <span className={`pill ${ep.method === 'POST' ? 'caution' : 'mint'} admin-method-pill`}>{ep.method}</span>
              <code className="admin-endpoint-path">{ep.path}</code>
              <span className="admin-endpoint-note">{ep.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export function Admin({ token, accountId }: {
  token: string
  accountId: string
}) {
  const [mode, setMode] = useState<AdminTestMode>('mock-upi')

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header-copy">
          <p className="eyebrow"><span className="line" /> Admin testing workspace</p>
          <h1>Payment Testing <em>Dashboard</em></h1>
          <p>Isolated sandbox to verify Mock UPI interventions and inspect planned Razorpay test checkout contracts.</p>
        </div>
        <div className="admin-header-badges">
          <span className="pill neutral"><Icon name="shield" size={13} /> Admin Role Enforced</span>
          <span className="demo-badge"><span />Synthetic Only · No Real Money</span>
        </div>
      </div>

      <div className="admin-mode-tabs" role="tablist" aria-label="Payment testing mode">
        <button
          role="tab"
          id="tab-mock-upi"
          type="button"
          aria-selected={mode === 'mock-upi'}
          aria-controls="panel-admin-mode"
          className={`admin-tab${mode === 'mock-upi' ? ' admin-tab-active' : ''}`}
          onClick={() => setMode('mock-upi')}
        >
          <Icon name="activity" size={16} />
          <span>Mode A — Mock UPI</span>
          <span className="pill mint">Ready</span>
        </button>
        <button
          role="tab"
          id="tab-razorpay"
          type="button"
          aria-selected={mode === 'razorpay'}
          aria-controls="panel-admin-mode"
          className={`admin-tab${mode === 'razorpay' ? ' admin-tab-active' : ''}`}
          onClick={() => setMode('razorpay')}
        >
          <Icon name="zap" size={16} />
          <span>Mode B — Razorpay Test Mode</span>
          <span className="pill caution">TEST ONLY · Disabled</span>
        </button>
      </div>

      <div
        id="panel-admin-mode"
        className="card workspace-card admin-panel-card"
        role="tabpanel"
        aria-labelledby={mode === 'mock-upi' ? 'tab-mock-upi' : 'tab-razorpay'}
      >
        {mode === 'mock-upi'
          ? <MockUpiPanel token={token} accountId={accountId} />
          : <RazorpayPanel />}
      </div>
    </div>
  )
}
