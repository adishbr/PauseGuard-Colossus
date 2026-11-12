import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { defaultReviewDuration, parseReviewDuration } from '../../mocks/reviewPreference.ts'
import type { ReviewDuration } from '../../mocks/reviewPreference.ts'
import { beneficiaries, purposes, scenarios } from '../../mocks/scenarios.ts'
import { Icon } from '../components/Icon.tsx'
import { PaymentStatus } from '../components/PaymentStatus.tsx'
import { PaymentSteps } from '../components/PaymentSteps.tsx'
import type { MessageKey } from '../locales/en.ts'
import { translator } from '../locales/messages.ts'
import type { Locale } from '../locales/messages.ts'
import { createPayment, paymentError } from '../services/paymentApi.ts'
import { decimalRupees, isReference, payerKey, reviewKey, saveDraft, savedDraft, storageRead, storageWrite, toPaise } from '../services/demoSession.ts'
import type { CreatePayment } from '../types/payment.ts'

const defaultScenario = scenarios[2]
type DemoPaymentDraft = CreatePayment & { reviewDuration: ReviewDuration }

function restoredDraft(accountId: string): DemoPaymentDraft | undefined {
  const draft = savedDraft(accountId)
  if (!draft) return undefined
  try {
    const parsed = JSON.parse(draft) as Partial<DemoPaymentDraft>
    if (parsed && typeof parsed.idempotency_key === 'string' && parsed.idempotency_key.trim() &&
      typeof parsed.amount_paise === 'number' && Number.isSafeInteger(parsed.amount_paise) && parsed.amount_paise > 0 &&
      typeof parsed.beneficiary_id === 'string' && Object.hasOwn(beneficiaries, parsed.beneficiary_id) &&
      typeof parsed.purpose === 'string' && Object.hasOwn(purposes, parsed.purpose)) {
      return {
        idempotency_key: parsed.idempotency_key,
        amount_paise: parsed.amount_paise,
        beneficiary_id: parsed.beneficiary_id,
        purpose: parsed.purpose,
        reviewDuration: parseReviewDuration(parsed.reviewDuration) ?? defaultReviewDuration,
      }
    }
  } catch {
    // Ignore invalid local demo drafts.
  }
}

function PaymentForm({ locale, onCreated, focusHeading, reviewDuration, accountId, token }: {
  locale: Locale; onCreated: (id: string) => void; focusHeading: boolean; reviewDuration: ReviewDuration; accountId: string; token: string
}) {
  const t = translator(locale)
  const [pending, setPending] = useState(() => restoredDraft(accountId))
  const [beneficiary, setBeneficiary] = useState<string>(pending?.beneficiary_id ?? defaultScenario.beneficiary)
  const [amount, setAmount] = useState(pending ? decimalRupees(pending.amount_paise) : defaultScenario.amount)
  const [purpose, setPurpose] = useState<string>(pending?.purpose ?? defaultScenario.purpose)
  const [error, setError] = useState<MessageKey>()
  const [invalidAmount, setInvalidAmount] = useState(false)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const amountInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusHeading) heading.current?.focus()
  }, [focusHeading])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    const paise = toPaise(amount)
    if (paise === null) {
      setInvalidAmount(true)
      amountInput.current?.focus()
      return
    }
    if (!navigator.onLine) {
      setError('offline')
      return
    }
    const draft = pending ?? {
      amount_paise: paise,
      beneficiary_id: beneficiary,
      purpose,
      idempotency_key: crypto.randomUUID(),
      reviewDuration,
    }
    sending.current = true
    setBusy(true)
    setError(undefined)
    setPending(draft)
    saveDraft(accountId, JSON.stringify(draft))
    const { reviewDuration: requestedDuration, ...input } = draft
    try {
      const { payment } = await createPayment(token, input, requestedDuration)
      if (payment.guardian_deadline && payment.status === 'AWAITING_GUARDIAN') {
        storageWrite('localStorage', reviewKey, payment.id)
      }
      onCreated(payment.id)
      saveDraft(accountId, '')
    } catch (failure) {
      const problem = paymentError(failure)
      if ([400, 413, 422].includes(problem.status)) {
        setPending(undefined)
        saveDraft(accountId, '')
      }
      setError(problem.key)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  // Real-time policy forecast calculation
  const isFlagged = beneficiary === 'recipient_flagged'
  const isCoercion = purpose === 'kyc_verification'
  const isSupplierNew = beneficiary === 'supplier_new'

  const forecastTier = isFlagged ? 3 : isCoercion ? 3 : isSupplierNew ? 1 : 0
  const forecastTone = isFlagged ? 'danger' : forecastTier > 0 ? 'caution' : 'neutral'
  const forecastLabel = isFlagged
    ? 'Flagged recipient'
    : isCoercion
      ? 'Possible coercion risk'
      : isSupplierNew
        ? 'Unfamiliar recipient'
        : 'Routine payment details'

  const quickAmounts = ['100.00', '5000.00', '50000.00', '55000.00']

  return (
    <>
      <PaymentSteps current={0} t={t} />
      <section className="card workspace-card payment-engine-card" aria-labelledby="payment-heading">
        <div className="card-header">
          <div className="symbol mint"><Icon name="activity" /></div>
          <div>
            <p className="eyebrow">{t('payerWorkspace')}</p>
            <h2 id="payment-heading" ref={heading} tabIndex={-1}>{t('preparePayment')}</h2>
          </div>
          <span className="pill neutral header-tag">
            <Icon name="shieldCheck" size={14} /> Payment preview
          </span>
        </div>
        <p className="card-lead">{t('formHint')}</p>

        {/* Real-time Dynamic Policy Forecast Banner */}
        <div className={`policy-forecast-banner forecast-${forecastTone}`}>
          <div className="forecast-icon">
            <Icon name={forecastTier === 3 ? 'shieldAlert' : forecastTier === 1 ? 'alertTriangle' : 'shieldCheck'} size={18} />
          </div>
          <div className="forecast-copy">
            <span className="forecast-badge">What to expect</span>
            <strong>{forecastLabel}</strong>
            <p className="field-help">
              {forecastTier === 3
                ? isFlagged
                  ? 'Checking this example should show a blocked payment.'
                  : `A review may be needed. Your selected response window is ${reviewDuration} seconds.`
                : forecastTier === 1
                  ? 'You may see a warning and steps to check the recipient.'
                  : 'Check the payment to see the outcome before you confirm.'}
            </p>
          </div>
        </div>

        <form noValidate onSubmit={(event) => void submit(event)}>
          <fieldset disabled={Boolean(pending)} className="form-fields">
            {/* Amount input with preset quick chips */}
            <div className="full form-field amount-block">
              <label htmlFor="amount">{t('amountInput')}</label>
              <div className="amount-input-wrapper">
                <span className={invalidAmount ? 'amount-field field-invalid' : 'amount-field'}>
                  <span aria-hidden="true">₹</span>
                  <input
                    id="amount"
                    ref={amountInput}
                    name="amount"
                    inputMode="decimal"
                    value={amount}
                    aria-invalid={invalidAmount || undefined}
                    aria-describedby="amount-help"
                    onChange={(event) => {
                      setAmount(event.target.value)
                      setInvalidAmount(false)
                    }}
                    required
                  />
                </span>
                <div className="quick-amount-chips" role="group" aria-label="Preset amount shortcuts">
                  {quickAmounts.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`chip ${toPaise(amount) === toPaise(preset) ? 'active' : ''}`}
                      onClick={() => {
                        setAmount(preset)
                        setInvalidAmount(false)
                      }}
                    >
                      ₹{Number(preset).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
              <p id="amount-help" className={invalidAmount ? 'field-error' : 'field-help'} role={invalidAmount ? 'alert' : undefined}>
                {t(invalidAmount ? 'amountInvalid' : 'amountHint')}
              </p>
            </div>

            {/* Recipient Selection */}
            <div className="form-field">
              <label htmlFor="beneficiary-select">{t('demoRecipient')}</label>
              <select
                id="beneficiary-select"
                name="beneficiary"
                value={beneficiary}
                onChange={(event) => setBeneficiary(event.target.value)}
              >
                {Object.entries(beneficiaries).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Purpose Selection */}
            <div className="form-field">
              <label htmlFor="purpose-select">{t('paymentPurpose')}</label>
              <select
                id="purpose-select"
                name="purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                {Object.keys(purposes).map((value) => (
                  <option key={value} value={value}>{t(value as keyof typeof purposes)}</option>
                ))}
              </select>
            </div>
          </fieldset>

          {error && <p className="notice" role="alert">{t(error)}</p>}
          {pending && !busy && <p className="form-note">{t('retryDraft')}</p>}

          <div className="actions">
            <button type="submit" className="primary submit-payment-btn" disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {t(busy ? 'checkingPayment' : pending ? 'retryRequest' : 'checkPayment')}
              {!busy && <Icon name="arrow" size={18} />}
            </button>
          </div>
          <div className="sr-only" role="status">{busy ? t('checkingPayment') : ''}</div>
        </form>
      </section>

      {/* Redesigned Interactive Scenario Explorer */}
      <section className="scenarios" aria-labelledby="scenarios-heading">
        <div className="scenarios-header">
          <h2 id="scenarios-heading">{t('tryScenario')}</h2>
          <span className="field-help">Click any real-world APP fraud pattern to test PauseGuard’s response</span>
        </div>
        <div className="scenario-list">
          {scenarios.map((scenario) => {
            const selected = beneficiary === scenario.beneficiary &&
              toPaise(amount) === toPaise(scenario.amount) &&
              purpose === scenario.purpose
            return (
              <button
                className={`scenario ${selected ? 'scenario-active' : ''}`}
                type="button"
                key={scenario.title}
                aria-pressed={selected}
                disabled={Boolean(pending)}
                onClick={() => {
                  setBeneficiary(scenario.beneficiary)
                  setAmount(scenario.amount)
                  setPurpose(scenario.purpose)
                  setError(undefined)
                  setInvalidAmount(false)
                }}
              >
                <div className="scenario-meta">
                  <span className="scenario-tag">{t(scenario.tag)}</span>
                  <span className="scenario-amount">₹{Number(scenario.amount).toLocaleString('en-IN')}</span>
                </div>
                <strong>{t(scenario.title)}</strong>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function Payer({ locale, reviewDuration, accountId, token }: {
  locale: Locale; reviewDuration: ReviewDuration; accountId: string; token: string
}) {
  const [id, setId] = useState(() => {
    const previous = storageRead('sessionStorage', `${payerKey}:${accountId}`)
    return isReference(previous) ? previous : ''
  })
  const [returning, setReturning] = useState(false)

  function selectPayment(next: string) {
    storageWrite('sessionStorage', `${payerKey}:${accountId}`, next)
    setReturning(!next)
    setId(next)
  }

  return id ? (
    <PaymentStatus
      key={id}
      role="payer"
      token={token}
      id={id}
      locale={locale}
      onClose={() => selectPayment('')}
    />
  ) : (
    <PaymentForm
      locale={locale}
      onCreated={selectPayment}
      focusHeading={returning}
      reviewDuration={reviewDuration}
      accountId={accountId}
      token={token}
    />
  )
}
