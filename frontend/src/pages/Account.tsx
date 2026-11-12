import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { beneficiaries } from '../../mocks/scenarios.ts'
import { Icon } from '../components/Icon.tsx'
import { languages } from '../locales/messages.ts'
import type { Locale } from '../locales/messages.ts'
import { accountApi } from '../services/accountApi.ts'
import { decimalRupees, toPaise } from '../services/demoSession.ts'
import { accountCategories, demoContact, demoName } from '../types/account.ts'
import type { AccountCategory, DemoProfile, ProfileUpdate } from '../types/account.ts'

export function Account({ profile, token, saved }: { profile: DemoProfile; token: string; saved: (next: DemoProfile) => void }) {
  const [fields, setFields] = useState(profile)
  const [threshold, setThreshold] = useState(profile.thresholdPaise === null ? '' : decimalRupees(profile.thresholdPaise))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>()
  const sending = useRef(false)
  const payer = profile.role === 'payer'

  function update<K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) {
    setFields((before) => ({ ...before, [key]: value }))
    setNotice(undefined)
  }

  async function persist(changes: ProfileUpdate) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setNotice(undefined)
    try {
      const next = await accountApi.save(token, changes)
      setFields((previous) => 'safeLock' in changes ? { ...previous, safeLock: next.safeLock } : next)
      saved(next)
      setNotice({ message: 'Settings saved.' })
    } catch (failure) {
      setNotice({ error: true, message: failure instanceof Error ? failure.message : 'Settings could not be saved.' })
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const thresholdPaise = payer && threshold.trim() ? toPaise(threshold) : null
    if (!demoName(fields.name) || !demoContact(fields.contact) || (payer && threshold.trim() && thresholdPaise === null)) {
      setNotice({ error: true, message: 'Check the fictional name, demo contact and payment alert threshold.' })
      return
    }
    const details = { name: fields.name, contact: fields.contact, language: fields.language, largeText: fields.largeText }
    void persist(payer ? {
      ...details, category: fields.category, organization: fields.organization, recurringSupplier: fields.recurringSupplier,
      thresholdPaise, notifications: fields.notifications, quietStart: fields.quietStart, quietEnd: fields.quietEnd,
      callConsent: fields.callConsent,
    } : details)
  }

  return (
    <section className="card account-card profile-settings-card">
      <div className="card-header">
        <div className="symbol mint"><Icon name="sliders" /></div>
        <div>
          <p className="eyebrow">Account Settings</p>
          <h2>Profile</h2>
        </div>
      </div>
      <p className="form-note">Use fictional or realistic details. Account categories, suppliers and threshold settings are self-declared.</p>

      {/* Safe-Lock Hero Panel (for Payers) */}
      {payer && (
        <div className={`safety-setting safelock-card ${profile.safeLock ? 'safelock-on' : 'safelock-off'}`}>
          <div className="safelock-header">
            <div className="safelock-icon-symbol">
              <Icon name={profile.safeLock ? 'lock' : 'unlock'} size={24} />
            </div>
            <div>
              <h3><Icon name="lock" size={19} /> Safe-Lock is {profile.safeLock ? 'on' : 'off'}</h3>
              <p className="field-help">Safe-Lock blocks simulated outgoing payments, including requests awaiting your final confirmation.</p>
            </div>
          </div>
          <button
            className={`secondary safelock-action-btn ${profile.safeLock ? 'btn-unlock' : 'btn-lock'}`}
            disabled={busy}
            type="button"
            onClick={() => void persist({ safeLock: !profile.safeLock })}
          >
            {profile.safeLock ? 'Turn off Safe-Lock' : 'Turn on Safe-Lock'}
          </button>
        </div>
      )}

      <form className="account-form" onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <legend>About you</legend>
          <div className="account-fields">
            <label>Full name
              <input required maxLength={64} value={fields.name} onChange={(e) => update('name', e.target.value)} />
            </label>
            <label>Email or mobile
              <input
                required
                maxLength={90}
                value={fields.contact}
                placeholder="name@gmail.com or 9876543210"
                aria-describedby="contact-verification-status"
                onChange={(e) => update('contact', e.target.value)}
              />
            </label>
            <label>Preferred language
              <select value={fields.language} onChange={(e) => update('language', e.target.value as Locale)}>
                {Object.entries(languages).map(([key, value]) => <option key={key} value={key} lang={key}>{value.label}</option>)}
              </select>
            </label>
            {payer && (
              <label>Account type
                <select value={fields.category} onChange={(e) => update('category', e.target.value as AccountCategory)}>
                  {Object.entries(accountCategories).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select>
              </label>
            )}
          </div>
          <p id="contact-verification-status" className="field-help">
            <span className="pill neutral">Demo Sandbox</span> Contact ownership is unverified. Real OTP and email verification will connect to production IAM.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={fields.largeText} onChange={(e) => update('largeText', e.target.checked)} />
            Use larger text
          </label>
        </fieldset>

        {payer && fields.category !== 'personal' && (
          <fieldset disabled={busy}>
            <legend>Professional and business preferences</legend>
            <div className="account-fields">
              <label>Organization (optional)
                <input maxLength={80} value={fields.organization} onChange={(e) => update('organization', e.target.value)} />
              </label>
              <label>Recurring supplier (optional)
                <select value={fields.recurringSupplier} onChange={(e) => update('recurringSupplier', e.target.value)}>
                  <option value="">Choose later</option>
                  {Object.entries(beneficiaries).filter(([key]) => key !== 'recipient_flagged').map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="field-help">Payment safety checks still apply to recurring suppliers.</p>
          </fieldset>
        )}

        {payer && (
          <fieldset disabled={busy}>
            <legend>Notifications and consent</legend>
            <label>Personal payment alert threshold (INR, optional)
              <input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </label>
            <p className="field-help">The threshold affects your alert preferences. Payment safety policy is evaluated separately.</p>
            <label className="check-row">
              <input type="checkbox" checked={fields.notifications} onChange={(e) => update('notifications', e.target.checked)} />
              Allow optional notifications
            </label>
            <div className="account-fields">
              <label>Quiet hours start (optional)
                <input type="time" value={fields.quietStart} onChange={(e) => update('quietStart', e.target.value)} />
              </label>
              <label>Quiet hours end (optional)
                <input type="time" value={fields.quietEnd} onChange={(e) => update('quietEnd', e.target.value)} />
              </label>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={fields.callConsent} onChange={(e) => update('callConsent', e.target.checked)} />
              I opt in to simulated guardian call preferences
            </label>
            <p className="field-help">Delivery and quiet-hours scheduling are planned provider integrations.</p>
          </fieldset>
        )}

        <button className="primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      {notice && <p className={notice.error ? 'notice' : 'form-note'} role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
    </section>
  )
}
