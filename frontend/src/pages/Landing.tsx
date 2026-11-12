import { Icon } from '../components/Icon.tsx'
import { WovenLock } from '../components/WovenLock.tsx'
import { Help } from './Help.tsx'
import './Landing.css'

const steps = [
  { icon: 'radar', title: 'Check the payment', text: 'Enter the details and see if the request has warning signs worth a closer look.' },
  { icon: 'users', title: 'Get a second look', text: 'When a review is needed, an enrolled guardian can help you assess the request.' },
  { icon: 'checkCircle', title: 'Make your decision', text: 'Review the outcome and decide whether to stop or confirm an eligible payment.' },
] as const

export function Landing({ help }: { help: boolean }) {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="landing-header">
        <div className="landing-frame landing-topbar">
          <a href="/" className="landing-brand" aria-label="PauseGuard home"><Icon name="shield" size={24} />PauseGuard</a>
          <nav aria-label="Main navigation" className="landing-nav">
            <a href="/#how-it-works">How it works</a>
            <a href="/#privacy">Privacy</a>
            <a href="/guardian/login">Guardian portal</a>
          </nav>
          <div className="landing-entry">
            <a className="landing-login" href="/payer/login">Log in</a>
            <a className="landing-button" href="/payer/signup">Get started <Icon name="arrow" size={15} /></a>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {help ? <div className="landing-frame landing-help"><Help /></div> : <>
        <section className="landing-hero" aria-labelledby="landing-title">
          <WovenLock />
          <div className="landing-frame landing-hero-inner">
            <h1 id="landing-title">A pause can protect <em>a payment.</em></h1>
            <p>Spot warning signs, take a moment to verify, and involve someone you trust when you need a second opinion.</p>
            <div className="landing-hero-actions">
              <a className="landing-button" href="/payer/signup">Get started <Icon name="arrow" size={19} /></a>
              <a className="landing-secondary" href="/#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="landing-frame landing-section" aria-labelledby="steps-title">
          <h2 id="steps-title">From a warning to a decision.</h2>
          <ol className="landing-steps">
            {steps.map(({ icon, title, text }) => (
              <li className="glass-surface" key={title}><Icon name={icon} size={25} /><h3>{title}</h3><p>{text}</p></li>
            ))}
          </ol>
        </section>
        <section id="privacy" className="landing-frame landing-privacy glass-surface" aria-labelledby="privacy-title">
          <div className="landing-privacy-icon"><Icon name="lock" size={30} /></div>
          <div>
            <h2 id="privacy-title">Your payment. Your decision.</h2>
            <p>Guardians see a limited review request. Your recipient, amount, and payment purpose stay private. If a guardian review times out, the payment stays on hold.</p>
          </div>
        </section>
        </>}
      </main>
      <footer className="landing-frame landing-footer">
        <a href="/" className="landing-brand" aria-label="PauseGuard home"><Icon name="shield" size={21} />PauseGuard</a>
        <p>Preview environment. No funds move.</p>
        <nav aria-label="Footer navigation">
          <a href="/#privacy">Privacy</a>
          <a href="/help">Help</a>
          <a href="/guardian/login">Guardian portal</a>
        </nav>
      </footer>
    </div>
  )
}
