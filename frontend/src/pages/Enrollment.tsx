import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon.tsx'
import { accountApi } from '../services/accountApi.ts'
import { demoContact, demoName, relationships } from '../types/account.ts'
import type { DemoProfile, EnrollmentView, Relationship } from '../types/account.ts'

export function Enrollment({ profile, token }: { profile: DemoProfile; token: string }) {
  const payer = profile.role === 'payer'
  const [items, setItems] = useState<EnrollmentView[]>()
  const [enabled, setEnabled] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [relationship, setRelationship] = useState<Relationship | ''>('')
  const [consent, setConsent] = useState(false)
  const [acceptance, setAcceptance] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const acting = useRef(false)

  useEffect(() => {
    let active = true
    void accountApi.enrollments(token).then(
      (data) => { if (active) setItems(data) },
      (failure) => { if (active) setError(failure.message) },
    )
    return () => { active = false }
  }, [token])

  async function change(body?: object, success?: string) {
    if (acting.current) return
    acting.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setItems(body ? await accountApi.enrollmentAction(token, body) : await accountApi.enrollments(token))
      if (success) setMessage(success)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enrollment could not be updated.')
    } finally {
      acting.current = false
      setBusy(false)
    }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!demoName(name) || !demoContact(contact) || !relationship || !consent) {
      setError('Enter a fictional name, demo contact and relationship, then confirm sharing consent.')
      return
    }
    void change({ action: 'invite', name, contact, relationship, consent }, 'Simulated invitation created.')
  }

  const current = items?.[0]
  const occupied = current?.status === 'Pending' || current?.status === 'Accepted'

  return (
    <section className="card account-card enrollment-card">
      <div className="card-header">
        <div className="symbol mint"><Icon name="users" /></div>
        <div>
          <p className="eyebrow">{payer ? 'Payment protection' : 'Guardian consent'}</p>
          <h2>{payer ? 'Guardian enrollment' : 'Guardian invitations'}</h2>
        </div>
      </div>
      <p className="form-note">
        Guardians can see an assigned request reference, risk tier, deadline and status. Amounts, recipients, payment purposes and payer transaction history stay private.
      </p>

      {/* Visual Timeline of Guardian Circuit Breaker */}
      <div className="enrollment-stepper-visual" aria-hidden="true">
        <div className="enrollment-step active">
          <span className="step-circle"><Icon name="shieldCheck" size={14} /></span>
          <span>1. Invite Guardian</span>
        </div>
        <div className="step-connector" />
        <div className={`enrollment-step ${occupied ? 'active' : ''}`}>
          <span className="step-circle"><Icon name="clock" size={14} /></span>
          <span>2. Session Consent</span>
        </div>
        <div className="step-connector" />
        <div className={`enrollment-step ${current?.status === 'Accepted' ? 'active' : ''}`}>
          <span className="step-circle"><Icon name="check" size={14} /></span>
          <span>3. Active Protection</span>
        </div>
      </div>

      {items === undefined && !error && <p role="status">Loading enrollment…</p>}
      {items?.length === 0 && <p>{payer ? 'No guardian enrolled.' : 'No invitations for this demo identity.'}</p>}

      <div className="enrollment-list">
        {items?.map((item) => (
          <article key={item.id} className="enrollment-item">
            <div className="enrollment-title">
              <h3>{item.name}</h3>
              <span className={`pill ${item.status === 'Accepted' ? 'mint' : item.status === 'Declined' || item.status === 'Revoked' ? 'danger' : 'caution'}`}>
                {item.status}
              </span>
            </div>
            <p className="field-help">{item.relationship}</p>
            {payer && item.status === 'Pending' && (
              <div className="invite-link">
                <p>Share this demo link with your trusted contact. They should sign in or register using the fictional contact you entered.</p>
                <div className="invite-link-row">
                  <label>Guardian invitation link
                    <input
                      readOnly
                      value={new URL('/guardian/enrollment', window.location.origin).href}
                      onFocus={(event) => event.target.select()}
                    />
                  </label>
                  <button
                    className="secondary copy-link-btn"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(new URL('/guardian/enrollment', window.location.origin).href)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                  >
                    <Icon name="copy" size={14} />
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
            {payer && !profile.sample && (item.status === 'Pending' || item.status === 'Accepted') && (
              <button className="secondary" disabled={busy} type="button" onClick={() => void change({ action: 'revoke', id: item.id }, 'Guardian access revoked.')}>
                {item.status === 'Pending' ? 'Cancel invitation' : 'Revoke guardian access'}
              </button>
            )}
            {!payer && !profile.sample && item.status === 'Accepted' && (
              <button className="secondary" disabled={busy} type="button" onClick={() => void change({ action: 'withdraw', id: item.id }, 'Guardian consent withdrawn.')}>
                Withdraw guardian consent
              </button>
            )}
            {!payer && item.status === 'Pending' && (
              <>
                <label className="check-row">
                  <input type="checkbox" checked={acceptance.includes(item.id)} onChange={(event) => {
                    const checked = event.target.checked
                    setAcceptance((before) => checked ? [...before, item.id] : before.filter((id) => id !== item.id))
                  }} />
                  I agree to receive privacy-limited review requests from this payer.
                </label>
                <div className="actions">
                  <button
                    className="primary"
                    type="button"
                    disabled={busy || !acceptance.includes(item.id)}
                    onClick={() => void change({ action: 'accept', id: item.id, consent: true }, 'Invitation accepted.')}
                  >
                    Accept invitation
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void change({ action: 'decline', id: item.id }, 'Invitation declined.')}
                  >
                    Decline invitation
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {payer && profile.sample && (
        <p className="form-note">The walkthrough uses a pre-enrolled sample pair. Create your own demo payer to try enrollment changes.</p>
      )}

      {payer && !profile.sample && items && !occupied && (
        <>
          <label className="check-row">
            <input type="checkbox" checked={enabled} onChange={(event) => {
              setEnabled(event.target.checked)
              if (!event.target.checked) setConsent(false)
            }} />
            I want to invite a trusted guardian
          </label>
          {enabled && (
            <form className="account-form" noValidate onSubmit={invite}>
              <fieldset disabled={busy}>
                <legend>Trusted guardian details</legend>
                <label>Guardian name
                  <input required maxLength={64} value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>Relationship
                  <select required value={relationship} onChange={(event) => setRelationship(event.target.value as Relationship)}>
                    <option value="">Choose a relationship</option>
                    {relationships.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label>Guardian demo email or mobile
                  <input
                    required
                    maxLength={90}
                    value={contact}
                    autoComplete="off"
                    placeholder="name@gmail.com or 9876543210"
                    onChange={(event) => setContact(event.target.value)}
                  />
                </label>
                <p className="field-help">Standard email or 10-digit Indian mobile. Ownership is unverified in demo.</p>
                <label className="check-row">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  I consent to sharing the limited review details after this guardian accepts.
                </label>
              </fieldset>
              <button className="primary" type="submit" disabled={busy}>Send demo invitation</button>
            </form>
          )}
        </>
      )}

      {error && <p role="alert" className="notice">{error}</p>}
      {message && <p role="status" className="form-note">{message}</p>}
      <div className="actions">
        <button type="button" className="secondary" disabled={busy || (!items && !error)} onClick={() => void change()}>
          {busy ? 'Updating…' : 'Refresh invitation status'}
        </button>
      </div>
    </section>
  )
}
