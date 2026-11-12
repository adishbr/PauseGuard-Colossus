import { useState } from 'react'
import { Icon } from '../components/Icon.tsx'
import { isReference, payerKey, storageRead } from '../services/demoSession.ts'

export function Help({ payerId }: { payerId?: string }) {
  const reference = payerId ? storageRead('sessionStorage', `${payerKey}:${payerId}`) : ''
  const [copied, setCopied] = useState('')

  return (
    <section className="card account-card help-recovery-card">
      <div className="card-header">
        <div className="symbol mint"><Icon name="fileText" /></div>
        <div>
          <p className="eyebrow">PauseGuard Help &amp; Response</p>
          <h2>Help and fraud reporting</h2>
        </div>
      </div>
      <p className="form-note">
        For a suspicious request, stop the payment and verify independently through a trusted contact method. For an actual transfer, contact your bank through its official channel.
      </p>

      {/* Emergency Cybercrime Helpline Action Panel */}
      <div className="emergency-helpline-panel">
        <div className="helpline-left">
          <div className="helpline-badge">
            <Icon name="phone" size={18} />
            <span>National Cybercrime Helpline</span>
          </div>
          <strong className="helpline-number">Dial 1930 (Toll Free)</strong>
          <p className="field-help">Operated by the Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs.</p>
        </div>
        <div className="actions emergency-actions">
          <a className="primary call-helpline-btn" href="tel:1930">
            <Icon name="phone" size={16} /> Call cybercrime helpline 1930
          </a>
          <a className="secondary" href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">
            <Icon name="external" size={16} /> Open the National Cybercrime Reporting Portal
          </a>
        </div>
      </div>

      {/* 4-Step Incident Response Protocol */}
      <div className="incident-protocol-section">
        <h3>APP Fraud Immediate Action Checklist</h3>
        <div className="protocol-grid">
          <div className="protocol-card">
            <span className="step-num">01</span>
            <strong>Disconnect &amp; Stop</strong>
            <p>Disconnect high-pressure phone or video calls. Fraudsters exploit artificial urgency to bypass logic.</p>
          </div>
          <div className="protocol-card">
            <span className="step-num">02</span>
            <strong>Contact Your Bank</strong>
            <p>Notify your account bank within the initial 2-hour Golden Window to freeze recipient account trails.</p>
          </div>
          <div className="protocol-card">
            <span className="step-num">03</span>
            <strong>File on 1930 Portal</strong>
            <p>Submit transaction logs, beneficiary UPI VPA, and phone numbers to cybercrime.gov.in.</p>
          </div>
          <div className="protocol-card">
            <span className="step-num">04</span>
            <strong>Preserve Evidence</strong>
            <p>Export PauseGuard tamper-evident audit logs and reason codes for official investigation.</p>
          </div>
        </div>
      </div>

      {/* Recovery Assist Section */}
      {payerId && (
        <section id="recovery-assist" className="safety-setting recovery-assist-panel">
          <div className="recovery-header">
            <Icon name="shieldCheck" size={20} />
            <div>
              <h3>Recovery Assist</h3>
              <p className="field-help">Use your simulated request reference when discussing the demo. Keep actual account information in official channels. Reports are submitted directly through the official portal.</p>
            </div>
          </div>

          {isReference(reference) ? (
            <div className="evidence-preview-card">
              <div className="evidence-header">
                <span className="pill neutral">Simulation Incident Record</span>
                <span className="field-help">Cryptographically Chained Mock Log</span>
              </div>
              <p className="reference"><code>{reference}</code></p>
              <div className="actions">
                <button
                  className="secondary copy-ref-action-btn"
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(reference)
                        setCopied('Reference copied.')
                        setTimeout(() => setCopied(''), 3000)
                      } catch {
                        setCopied('Select and copy the displayed reference.')
                      }
                    })()
                  }}
                >
                  <Icon name="copy" size={16} /> Copy demo reference
                </button>
              </div>
              {copied && <p role="status" className="field-help text-accent">{copied}</p>}
            </div>
          ) : (
            <p className="field-help no-ref-note">Open a simulated payment in this tab to make its reference available here.</p>
          )}
        </section>
      )}
    </section>
  )
}
