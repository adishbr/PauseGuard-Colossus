import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon.tsx'
import { languages } from '../locales/messages.ts'
import type { Locale } from '../locales/messages.ts'
import { reviewDurations } from '../../mocks/reviewPreference.ts'
import type { ReviewDuration } from '../../mocks/reviewPreference.ts'
import { accountApi } from '../services/accountApi.ts'
import { storageWrite, toPaise } from '../services/demoSession.ts'
import { accountCategories, demoContact, demoName, isEmailContact, isMobileContact } from '../types/account.ts'
import type { AccountCategory, DemoSession } from '../types/account.ts'
import type { Role } from '../types/payment.ts'

export function Auth({ path, role, locale, onSession, expired }: {
  path: string; role: Role; locale: Locale; onSession: (session: DemoSession) => void; expired: boolean
}) {
  const guardian = role === 'guardian'
  const base = guardian ? '/guardian' : '/payer'
  const signup = path.endsWith('/signup')
  const form = signup || path.endsWith('/login')
  const enrollmentReturn = guardian && (path === '/guardian/enrollment' ||
    new URLSearchParams(window.location.search).get('next') === '/guardian/enrollment')
  const authLink = (mode: 'signup' | 'login') => `${base}/${mode}${enrollmentReturn ? '?next=/guardian/enrollment' : ''}`

  const [stage, setStage] = useState(1)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [language, setLanguage] = useState(locale)
  const [category, setCategory] = useState<AccountCategory>('personal')
  const [organization, setOrganization] = useState('')
  const [largeText, setLargeText] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')
  const [chosenDuration, setChosenDuration] = useState<ReviewDuration>(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'name' | 'contact'>()
  const sending = useRef(false)
  const nameInput = useRef<HTMLInputElement>(null)
  const contactInput = useRef<HTMLInputElement>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const isEmail = isEmailContact(contact)
  const isMobile = isMobileContact(contact)

  async function submit(event?: FormEvent, sample = false) {
    event?.preventDefault()
    if (sending.current) return
    setError('')
    setInvalid(undefined)
    if (!sample) {
      if (signup && !demoName(name)) {
        setInvalid('name')
        setError('Enter a fictional full name with at least two letters.')
        nameInput.current?.focus()
        return
      }
      if (!demoContact(contact)) {
        setInvalid('contact')
        setError('Enter a valid email address or 10-digit Indian mobile number.')
        contactInput.current?.focus()
        return
      }
      if (signup && stage === 1) {
        setStage(2)
        requestAnimationFrame(() => stepHeading.current?.focus())
        return
      }
    }
    sending.current = true
    setBusy(true)
    try {
      let session: DemoSession
      if (signup && !sample) {
        const thresholdPaise = thresholdInput.trim() ? toPaise(thresholdInput) : null
        session = await accountApi.register(role, {
          name, contact, language, category, organization,
          largeText, thresholdPaise: thresholdPaise ?? undefined,
        })
        if (!guardian && session.profile.id) {
          storageWrite('localStorage', `pauseguard:demo:review-seconds:${session.profile.id}`, String(chosenDuration))
        }
      } else {
        session = await accountApi.login(role, contact, sample)
      }
      onSession(session)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The demo could not sign you in.')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth-stage">
      <section className="card account-card auth-card" aria-labelledby="auth-heading">
        <div className="card-header-block">
          <p className="eyebrow">{guardian ? 'Guardian portal' : 'Payer workspace'}</p>
          <h1 id="auth-heading">{signup ? 'Create your preview account' : form ? 'Sign in' : 'Continue to PauseGuard'}</h1>
          <p className="form-note">Use fictional details in this preview. No verification messages are sent.</p>
        </div>

        {expired && <p role="alert" className="notice">Your demo session expired. Sign in again to continue.</p>}
        {error && <p id="auth-error" role="alert" className="notice">{error}</p>}

        {form ? (
          <form className="account-form" noValidate onSubmit={(event) => void submit(event)}>
            {signup && (
              <div className="onboarding-stepper">
                <div className="stepper-bar">
                  <div className="stepper-progress" style={{ width: stage === 1 ? '50%' : '100%' }} />
                </div>
                <p className="account-step">
                  Step {stage} of 2 · {stage === 1 ? 'Account details' : 'Preferences & Protection'}
                </p>
              </div>
            )}

            {/* STAGE 1: DEMO IDENTITY */}
            <fieldset hidden={signup && stage === 2} disabled={busy}>
              {signup && (
                <label>
                  Full name
                  <input
                    ref={nameInput}
                    value={name}
                    maxLength={64}
                    required
                    autoComplete="off"
                    aria-invalid={invalid === 'name' || undefined}
                    aria-describedby={invalid === 'name' ? 'auth-error' : undefined}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Asha Sharma"
                  />
                </label>
              )}

              <label>
                Email or mobile
                <input
                  ref={contactInput}
                  value={contact}
                  maxLength={90}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid === 'contact' || undefined}
                  aria-describedby={invalid === 'contact' ? 'contact-help auth-error' : 'contact-help'}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="asha@example.test"
                />
              </label>

              <p className="field-help" id="contact-help">
                {contact && (isEmail || isMobile) ? 'Format looks right. Contact details are not verified in this preview.' :
                  'Use a fictional email such as asha@example.test.'}
              </p>
            </fieldset>

            {/* STAGE 2: ONBOARDING PREFERENCES & PROTECTION */}
            {signup && stage === 2 && (
              <fieldset disabled={busy}>
                <h3 tabIndex={-1} ref={stepHeading}>Set your preferences</h3>

                {!guardian && (
                  <label>
                    Account type
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as AccountCategory)}
                    >
                      {Object.entries(accountCategories).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                      ))}
                    </select>
                  </label>
                )}

                {!guardian && category !== 'personal' && (
                  <label>
                    Organization (optional)
                    <input
                      value={organization}
                      onChange={(event) => setOrganization(event.target.value)}
                      maxLength={80}
                      autoComplete="off"
                      placeholder="e.g. Acme Innovations Studio"
                    />
                  </label>
                )}

                <div className="account-fields">
                  <label>
                    Preferred language
                    <select value={language} onChange={(event) => setLanguage(event.target.value as Locale)}>
                      {Object.entries(languages).map(([code, value]) => (
                        <option key={code} value={code} lang={code}>{value.label}</option>
                      ))}
                    </select>
                  </label>

                  {!guardian && (
                    <label>
                      Review duration
                      <select
                        value={chosenDuration}
                        onChange={(event) => setChosenDuration(Number(event.target.value) as ReviewDuration)}
                      >
                        {reviewDurations.map((seconds) => (
                          <option key={seconds} value={seconds}>{seconds} seconds</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                {!guardian && (
                  <label>
                    Payment alert threshold (INR, optional)
                    <input
                      inputMode="decimal"
                      value={thresholdInput}
                      onChange={(event) => setThresholdInput(event.target.value)}
                      placeholder="e.g. 50000"
                    />
                  </label>
                )}

                <div className="onboarding-checkboxes">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={largeText}
                      onChange={(event) => setLargeText(event.target.checked)}
                    />
                    Use larger text for enhanced accessibility
                  </label>

                </div>
              </fieldset>
            )}

            <div className="actions">
              {signup && stage === 2 && (
                <button className="secondary" type="button" disabled={busy} onClick={() => setStage(1)}>
                  Back
                </button>
              )}
              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : signup ? stage === 1 ? 'Continue' : 'Create account' : 'Sign in to preview'}
              </button>
            </div>
          </form>
        ) : (
          <div className="actions auth-landing-actions">
            <a className="primary" href={authLink('signup')}>Sign up</a>
            <a className="secondary" href={authLink('login')}>Sign in</a>
          </div>
        )}

        {form && (
          <div className="auth-mode-switch">
            <a className="text-button" href={authLink(signup ? 'login' : 'signup')}>
              {signup ? 'Already registered? Sign in' : 'Create an account'}
            </a>
          </div>
        )}

        {!signup && !enrollmentReturn && (
          <div className="sample-access">
            <button className="text-button" type="button" disabled={busy} onClick={() => void submit(undefined, true)}>
              {guardian ? 'Open sample guardian' : 'Open sample payer'} <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
