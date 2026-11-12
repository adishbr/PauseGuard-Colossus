import { useEffect, useState } from 'react'
import { defaultReviewDuration, parseReviewDuration } from '../mocks/reviewPreference.ts'
import type { ReviewDuration } from '../mocks/reviewPreference.ts'
import { ProtectionSettings } from './components/ProtectionSettings.tsx'
import { Icon } from './components/Icon.tsx'
import { isLocale, languages, translator } from './locales/messages.ts'
import type { Locale } from './locales/messages.ts'
import { Account } from './pages/Account.tsx'
import { Admin, AdminLogin } from './pages/Admin.tsx'
import { Auth } from './pages/Auth.tsx'
import { Enrollment } from './pages/Enrollment.tsx'
import { Help } from './pages/Help.tsx'
import { Landing } from './pages/Landing.tsx'
import { accountApi, AccountError, savedSession, saveSession, sessionExpired } from './services/accountApi.ts'
import type { DemoProfile, DemoSession } from './types/account.ts'
import { Guardian } from './pages/Guardian.tsx'
import { Payer } from './pages/Payer.tsx'
import { storageRead, storageWrite } from './services/demoSession.ts'
import './App.css'

const languageKey = 'pauseguard:demo:language'
const protectionKey = 'pauseguard:demo:review-seconds'

function dashboardDestination(dashboard: string) {
  return dashboard === '/guardian' && new URLSearchParams(window.location.search).get('next') === '/guardian/enrollment' ?
    '/guardian/enrollment' : dashboard
}

function Workspace() {
  const [path, setPath] = useState(() => {
    const current = window.location.pathname.replace(/\/$/, '') || '/'
    if (['/login', '/signup', '/profile', '/enrollment'].includes(current)) {
      const canonical = '/payer' + current
      window.history.replaceState(null, '', canonical + window.location.search)
      return canonical
    }
    if (current === '/admin' && !savedSession('admin')) {
      window.history.replaceState(null, '', '/admin/login')
      return '/admin/login'
    }
    return current
  })
  const guardian = path === '/guardian' || path.startsWith('/guardian/')
  const adminPath = path === '/admin' || path.startsWith('/admin/')
  const role = guardian ? 'guardian' : adminPath ? 'admin' : 'payer'
  const base = guardian ? '/guardian' : adminPath ? '/admin' : '/payer'
  const dashboard = base
  const shell = path === '/analyst'
  const [token, setToken] = useState(() => shell ? '' : savedSession(role))
  const [session, setSession] = useState<DemoSession>()
  const [expired, setExpired] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [retry, setRetry] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = storageRead('localStorage', languageKey)
    return isLocale(saved) ? saved : 'en'
  })
  const [savedDuration, setSavedDuration] = useState<{ key: string; value: ReviewDuration }>()
  const t = translator(locale)
  const profile = session?.profile
  const durationKey = `${protectionKey}:${profile?.id}`
  const reviewDuration = savedDuration?.key === durationKey ? savedDuration.value :
    parseReviewDuration(storageRead('localStorage', durationKey) ||
      (profile?.sample ? storageRead('localStorage', protectionKey) : '')) ?? defaultReviewDuration
  const paymentPage = path === dashboard
  const showProtection = !guardian && !adminPath && (paymentPage || path === '/payer/profile')

  function changeLocale(next: Locale) {
    storageWrite('localStorage', languageKey, next)
    setLocale(next)
  }

  function saveReviewDuration(duration: ReviewDuration) {
    if (!storageWrite('localStorage', durationKey, String(duration))) return false
    setSavedDuration({ key: durationKey, value: duration })
    return true
  }

  function enter(next: DemoSession) {
    if (next.profile.role !== role) return
    saveSession(role, next.token)
    setSession(next)
    setToken(next.token)
    setExpired(false)
    setSessionError('')
    if (!next.profile.sample) changeLocale(next.profile.language)
    const target = path.endsWith('/login') || path.endsWith('/signup') ? dashboardDestination(dashboard) : path
    window.history.replaceState(null, '', target)
    setPath(target)
  }

  function saveProfile(next: DemoProfile) {
    setSession((previous) => previous && { ...previous, profile: next })
    changeLocale(next.language)
  }

  async function logout() {
    if (!token || signingOut) return
    setSigningOut(true)
    try {
      await accountApi.logout(token)
      saveSession(role, '')
      setToken('')
      setSession(undefined)
      setSessionError('')
      setExpired(false)
      const destination = base + '/login'
      window.history.replaceState(null, '', destination)
      setPath(destination)
    } catch (error) {
      if (!(error instanceof AccountError && error.status === 401)) setSessionError('Sign-out could not reach the demo service. Try again.')
    } finally {
      setSigningOut(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let active = true

    function expire() {
      if (!active) return
      saveSession(role, '')
      setToken('')
      setSession(undefined)
      setExpired(true)
      setSessionError('')
    }

    function onExpiry(event: Event) {
      if ((event as CustomEvent<string>).detail === token) expire()
    }

    let timer: ReturnType<typeof setTimeout>
    window.addEventListener(sessionExpired, onExpiry)
    void accountApi.session(token).then((next) => {
      if (!active) return
      if (next.profile.role !== role) { expire(); return }
      setSession(next)
      setSessionError('')
      if (window.location.pathname.endsWith('/login') || window.location.pathname.endsWith('/signup')) {
        const target = dashboardDestination(dashboard)
        window.history.replaceState(null, '', target)
        setPath(target)
      }
      timer = setTimeout(expire, Math.max(0, next.expiresAt - Date.now()))
    }, (error: unknown) => {
      if (!active) return
      if (error instanceof AccountError && error.status === 401) expire()
      else setSessionError('Could not check your demo session. Retry when connected.')
    })

    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener(sessionExpired, onExpiry)
    }
  }, [token, role, retry, dashboard])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const authRole = guardian ? 'guardian' : 'payer'
  const isAuth = !shell && !adminPath && !session && !token

  return (
    <div className={`app${profile?.largeText ? ' large-text' : ''}${isAuth ? ' auth-page' : ''}`}>
      <a className="skip-link" href="#main">{t('skip')}</a>
      <header className="site-header">
        <div className="frame topbar">
          <div className="topbar-brand-group">
            <a href={profile ? dashboard : '/'} className="brand" aria-label={guardian ? 'PauseGuard guardian home' : adminPath ? 'PauseGuard admin home' : t('payerHome')}>
              <span className="brand-mark"><Icon name="shield" /></span>
              <span>Pause<span>Guard</span></span>
            </a>
            {adminPath && <span className="platform-tag">Merchant checkout testing</span>}
          </div>

          <div className="topbar-controls">
            {profile && (
              <div className="user-persona-chip">
                <span className="persona-avatar">{profile.name.charAt(0).toUpperCase()}</span>
                <div className="persona-details">
                  <span className="persona-name">{profile.name}</span>
                  <span className="persona-meta">
                    {profile.role === 'admin' ? 'Admin' : guardian ? 'Guardian' : profile.category.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}

            {!guardian && !adminPath && profile?.safeLock && (
              <span className="safelock-indicator active" title="Safe-Lock is Active (Outgoing transfers blocked)">
                <Icon name="lock" size={13} />
                <span>Safe-Lock ON</span>
              </span>
            )}

            {!isAuth && <span className="demo-badge"><span />{adminPath ? 'Test mode' : 'Preview'}</span>}

            {!adminPath && (
              <label className="locale-control">
                <span className="sr-only">{t('language')}</span>
                <select value={locale} onChange={(event) => {
                  const next = event.target.value
                  if (!isLocale(next)) return
                  changeLocale(next)
                }}>
                  {Object.entries(languages).map(([code, language]) => (
                    <option key={code} value={code} lang={code}>{language.label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {profile && (
          <nav className="frame account-nav" aria-label="Account navigation">
            <div className="nav-primary-links">
              <a href={dashboard} aria-current={paymentPage ? 'page' : undefined}>
                <Icon name={adminPath ? 'shieldAlert' : guardian ? 'users' : 'activity'} size={16} />
                <span>{adminPath ? 'Testing' : guardian ? 'Reviews' : 'Dashboard'}</span>
              </a>
              {!adminPath && (
                <>
                  <a href={`${base}/profile`} aria-current={path.endsWith('/profile') ? 'page' : undefined}>
                    <Icon name="sliders" size={16} />
                    <span>Profile</span>
                  </a>
                  <a href={`${base}/enrollment`} aria-current={path.endsWith('/enrollment') ? 'page' : undefined}>
                    <Icon name="users" size={16} />
                    <span>{guardian ? 'Invitations' : 'Guardians'}</span>
                  </a>
                  <a href={`${base}/help`} aria-current={path.endsWith('/help') ? 'page' : undefined}>
                    <Icon name="fileText" size={16} />
                    <span>Help &amp; recovery</span>
                  </a>
                </>
              )}
            </div>

            <div className="nav-utility-group">
              <button className="text-button signout-btn" disabled={signingOut} type="button" onClick={() => void logout()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="frame" tabIndex={-1}>
        {sessionError && (
          <div className="notice" role="alert">
            <p>{sessionError}</p>
            {!session && <button className="secondary" type="button" onClick={() => { setSessionError(''); setRetry((n) => n + 1) }}>Retry session</button>}
          </div>
        )}

        {shell ? (
          <section className="card account-card workspace-card">
            <p className="eyebrow">Integration shell</p>
            <h1>Analyst interface</h1>
            <p className="form-note">Access and data will come from the team’s authorized backend. The local demo supports payer and guardian sessions.</p>
            <a className="secondary" href="/">Return to PauseGuard</a>
          </section>
        ) : adminPath ? (
          !session ? token ? (
            !sessionError && <p className="form-note" role="status">Checking your admin session…</p>
          ) : (
            <AdminLogin onSession={enter} expired={expired} registrationBlocked={path === '/admin/signup'} />
          ) : (
            <Admin key={session.profile.id} token={token} accountId={session.profile.id} />
          )
        ) : !session ? token ? (
          !sessionError && <p className="form-note" role="status">Checking your demo session…</p>
        ) : (
          <Auth key={path} path={path} role={authRole} locale={locale} onSession={enter} expired={expired} />
        ) : (
          <>
            {paymentPage && (
              <div className="intro">
                <div className="intro-copy">
                  <p className="eyebrow"><span className="line" />{t(guardian ? 'guardianEyebrow' : 'payerEyebrow')}</p>
                  <h1>{t(guardian ? 'guardianHero' : 'payerHero')} <em>{t(guardian ? 'guardianAccent' : 'payerAccent')}</em></h1>
                  <p>{t(guardian ? 'guardianIntro' : 'payerIntro')}</p>
                </div>
                <div className="intro-mark" aria-hidden="true"><Icon name="shield" size={53} /></div>
              </div>
            )}

            <div className={paymentPage ? 'workspace' : 'workspace account-workspace'}>
              <div className="main-column">
                {showProtection && <a className="mobile-settings-link" href="#payment-protection-settings">{t('protectionSettings')} <Icon name="arrow" size={16} /></a>}
                {path.endsWith('/profile') ? <Account key={session.profile.id} token={token} profile={session.profile} saved={saveProfile} /> :
                  path.endsWith('/enrollment') ? <Enrollment key={session.profile.id} token={token} profile={session.profile} /> :
                  path.endsWith('/help') ? <Help payerId={guardian ? undefined : session.profile.id} /> :
                  guardian ? <Guardian key={session.profile.id} token={token} accountId={session.profile.id} locale={locale} /> :
                  <Payer key={session.profile.id} token={token} accountId={session.profile.id} locale={locale} reviewDuration={reviewDuration} />}
              </div>

              <aside className="side-column" aria-label={t('about')}>
                {showProtection && <ProtectionSettings key={session.profile.id} saved={reviewDuration} save={saveReviewDuration} t={t} />}

                <section className="card side-card privacy-card">
                  <div className="symbol"><Icon name="lock" /></div>
                  <h2>{t('privacy')}</h2>
                  <p>{session.profile.sample ? t('privacyNote') : 'Guardian enrollment requires explicit acceptance. Payment details stay with the payer.'}</p>
                  <div className="side-card-footer">
                    <span className="pill neutral">
                      Signed in as {session.profile.name} · {guardian ? 'Guardian' : 'Payer'}
                    </span>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="frame site-footer">
        <div className="footer-left">
          <span><Icon name="shield" size={16} /> PauseGuard V2</span>
          <span className="footer-divider">·</span>
          <a href="/">Public homepage</a>
        </div>
        <span>{t('footer')}</span>
      </footer>
    </div>
  )
}

function App() {
  const route = window.location.pathname.replace(/\/$/, '') || '/'
  return route === '/' || route === '/help' ? <Landing help={route === '/help'} /> : <Workspace />
}

export default App
