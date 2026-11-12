import type { IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import { accountCategories, canonicalContact, demoContact, demoName, relationships } from '../src/types/account.ts'
import type { AppRole, DemoProfile, DemoSession, EnrollmentView, Relationship } from '../src/types/account.ts'
import { MockError, readBody } from './http.ts'
import { beneficiaries } from './scenarios.ts'

type Invitation = EnrollmentView & { payerId: string; guardianId?: string; contact: string }

function matchesContact(a: string, b: string): boolean {
  return canonicalContact(a) === canonicalContact(b)
}

function profile(id: string, role: AppRole, name: string, contact: string, sample = false): DemoProfile {
  return {
    id, role, name, contact, sample, category: 'personal', language: 'en', largeText: false,
    organization: '', recurringSupplier: '', thresholdPaise: sample && role === 'payer' ? 5_500_000 : null,
    notifications: true, quietStart: '', quietEnd: '', callConsent: false, safeLock: false,
  }
}

function bad(message: string): never {
  throw new MockError(422, message)
}

function updateProfile(current: DemoProfile, input: Record<string, unknown>): DemoProfile {
  const next = { ...current }
  if ('name' in input) next.name = demoName(input.name) ?? bad('Enter a fictional full name.')
  if ('contact' in input) next.contact = demoContact(input.contact) ?? bad('Enter a valid email address or 10-digit Indian mobile number.')
  if ('language' in input) {
    const value = input.language
    if (value !== 'en' && value !== 'kn' && value !== 'hi' && value !== 'te') bad('Choose a supported language.')
    next.language = value
  }
  if ('largeText' in input) {
    if (typeof input.largeText !== 'boolean') bad('Choose an accessibility preference.')
    next.largeText = input.largeText
  }
  if (current.role === 'guardian' || current.role === 'admin') return next
  if ('category' in input) {
    if (typeof input.category !== 'string' || !Object.hasOwn(accountCategories, input.category)) bad('Choose an account category.')
    next.category = input.category as DemoProfile['category']
  }
  if ('organization' in input) {
    if (typeof input.organization !== 'string' || input.organization.length > 80) bad('Enter a short fictional business name.')
    next.organization = input.organization.trim()
  }
  if ('recurringSupplier' in input) {
    const value = input.recurringSupplier
    if (typeof value !== 'string' || (value && (value === 'recipient_flagged' || !Object.hasOwn(beneficiaries, value)))) bad('Choose a demo supplier.')
    next.recurringSupplier = value
  }
  if (next.category === 'personal') {
    next.organization = ''
    next.recurringSupplier = ''
  }
  if ('thresholdPaise' in input) {
    const value = input.thresholdPaise
    if (value === null) next.thresholdPaise = null
    else if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) bad('Enter a positive payment alert threshold.')
    else next.thresholdPaise = value
  }
  for (const key of ['notifications', 'callConsent', 'safeLock'] as const) {
    if (!(key in input)) continue
    const value = input[key]
    if (typeof value !== 'boolean') bad('Choose an on or off setting.')
    next[key] = value
  }
  for (const key of ['quietStart', 'quietEnd'] as const) {
    if (!(key in input)) continue
    const value = input[key]
    if (typeof value !== 'string' || (value && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) bad('Enter a valid quiet-hours time.')
    next[key] = value
  }
  if (Boolean(next.quietStart) !== Boolean(next.quietEnd) ||
      (next.quietStart && next.quietStart === next.quietEnd)) bad('Choose different start and end times, or clear both.')
  return next
}

export function createDemoAccounts(clock: () => number) {
  const samplePayer = profile('demo-payer', 'payer', 'Asha Demo', 'asha@pauseguard.test', true)
  const sampleGuardian = profile('demo-guardian', 'guardian', 'Ravi Demo', 'ravi@pauseguard.test', true)
  const sampleAdmin: DemoProfile = {
    id: 'demo-admin', role: 'admin', name: 'Admin Demo', contact: 'admin@pauseguard.test',
    sample: true, category: 'personal', language: 'en', largeText: false,
    organization: '', recurringSupplier: '', thresholdPaise: null,
    notifications: false, quietStart: '', quietEnd: '', callConsent: false, safeLock: false,
  }
  const syntheticTestPayer: DemoProfile = profile(
    'admin-synthetic-payer', 'payer', 'Admin Sandbox Payer', 'sandbox-payer@pauseguard.test', true,
  )
  const profiles = new Map([
    [samplePayer.id, samplePayer],
    [sampleGuardian.id, sampleGuardian],
    [sampleAdmin.id, sampleAdmin],
    [syntheticTestPayer.id, syntheticTestPayer],
  ])
  const sessions = new Map<string, { actorId: string; expiresAt: number }>()
  const invitations = new Map<string, Invitation>([[
    'sample-guardian', {
      id: 'sample-guardian', payerId: samplePayer.id, guardianId: sampleGuardian.id,
      contact: sampleGuardian.contact, name: sampleGuardian.name, relationship: 'Family', status: 'Accepted',
    },
  ]])

  function signIn(account: DemoProfile): DemoSession {
    const now = clock()
    for (const [token, stored] of sessions) if (stored.expiresAt <= now) sessions.delete(token)
    const token = randomUUID()
    const expiresAt = now + 30 * 60_000
    sessions.set(token, { actorId: account.id, expiresAt })
    return { token, expiresAt, profile: account }
  }

  function authenticate(authorization: string | undefined): DemoSession {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
    const session = sessions.get(token)
    const account = session && profiles.get(session.actorId)
    if (!session || !account || session.expiresAt <= clock()) {
      sessions.delete(token)
      throw new MockError(401, 'The demo session has expired. Sign in again.')
    }
    return { token, expiresAt: session.expiresAt, profile: account }
  }

  function latestEnrollment(payerId: string) {
    return [...invitations.values()].reverse().find((invite) => invite.payerId === payerId)
  }

  function currentEnrollment(payerId: string) {
    const invite = latestEnrollment(payerId)
    return invite?.status === 'Accepted' ? invite : undefined
  }

  function isInviteFor(guardian: DemoProfile, invite: Invitation) {
    return invite.guardianId ? invite.guardianId === guardian.id :
      !guardian.sample && invite.status === 'Pending' && matchesContact(invite.contact, guardian.contact)
  }

  function listEnrollments(actor: DemoProfile): EnrollmentView[] {
    const all = actor.role === 'payer' ? [latestEnrollment(actor.id)].filter((invite) => invite !== undefined) :
      [...invitations.values()].reverse().filter((invite) => isInviteFor(actor, invite))
    return all.map((invite) => ({
      id: invite.id, relationship: invite.relationship, status: invite.status,
      name: actor.role === 'payer' ? invite.name : profiles.get(invite.payerId)?.name ?? 'Demo payer',
    }))
  }

  function contactInUse(contact: string, exceptId?: string) {
    return [...profiles.values()].some((other) => other.id !== exceptId && matchesContact(other.contact, contact))
  }

  async function handle(route: string, request: IncomingMessage): Promise<unknown> {
    const method = request.method
    if (method === 'POST' && (route === '/session' || route === '/register')) {
      const input = await readBody(request)
      const role = input.role
      if (role !== 'payer' && role !== 'guardian' && role !== 'admin') bad('Choose a demo role.')
      if (role === 'admin') {
        // Admin accounts are provisioned only as samples; no self-registration.
        if (route === '/register') bad('Admin accounts cannot self-register in the demo.')
        if (input.sample === true) return signIn(profiles.get(sampleAdmin.id) ?? sampleAdmin)
        const contact = demoContact(input.contact) ?? bad('Enter your demo admin email or mobile.')
        const account = [...profiles.values()].find((entry) => entry.role === 'admin' && matchesContact(entry.contact, contact))
        if (!account) throw new MockError(404, 'No demo admin account was found for that contact.')
        return signIn(account)
      }
      // Narrowed to payer or guardian from this point.
      const payerOrGuardian = role
      if (route === '/register') {
        const name = demoName(input.name) ?? bad('Enter a fictional full name.')
        const contact = demoContact(input.contact) ?? bad('Enter a valid email address or 10-digit Indian mobile number.')
        if (contactInUse(contact)) throw new MockError(409, 'A demo account already uses that contact.')
        const account = updateProfile(profile(randomUUID(), payerOrGuardian, name, contact), input)
        profiles.set(account.id, account)
        return signIn(account)
      }
      if (input.sample === true) {
        const sample = payerOrGuardian === 'payer' ? samplePayer : sampleGuardian
        return signIn(profiles.get(sample.id) ?? sample)
      }
      const contact = demoContact(input.contact) ?? bad('Enter your demo email or mobile.')
      const account = [...profiles.values()].find((entry) =>
        entry.id !== syntheticTestPayer.id && entry.role === payerOrGuardian && matchesContact(entry.contact, contact))
      if (!account) throw new MockError(404, 'No demo account was found for that role and contact.')
      return signIn(account)
    }

    const input = method === 'POST' ? await readBody(request) : undefined
    const session = authenticate(request.headers.authorization)
    const actor = session.profile
    if (route === '/session' && method === 'GET') return session
    if (route === '/session' && method === 'DELETE') {
      sessions.delete(session.token)
      return { signedOut: true }
    }
    if (route === '/profile' && method === 'POST' && input) {
      const next = updateProfile(actor, input)
      if (contactInUse(next.contact, actor.id)) throw new MockError(409, 'A demo account already uses that contact.')
      profiles.set(actor.id, next)
      return next
    }
    if (route === '/enrollment' && method === 'GET') {
      if (actor.role === 'admin') throw new MockError(403, 'Admin accounts cannot manage guardian enrollments.')
      return listEnrollments(actor)
    }
    if (route === '/enrollment' && method === 'POST' && input) {
      if (actor.role === 'admin') throw new MockError(403, 'Admin accounts cannot manage guardian enrollments.')
      if (input.action === 'invite') {
        if (actor.role !== 'payer' || actor.sample) throw new MockError(403, 'Create your own demo payer to invite a guardian.')
        const current = latestEnrollment(actor.id)
        if (current?.status === 'Pending' || current?.status === 'Accepted') {
          throw new MockError(409, 'Revoke the current invitation before sending another.')
        }
        const name = demoName(input.name) ?? bad('Enter a fictional guardian name.')
        const contact = demoContact(input.contact) ?? bad('Enter a valid guardian email or 10-digit mobile number.')
        const isSampleContact = [...profiles.values()].some((entry) => entry.sample && matchesContact(entry.contact, contact))
        if (isSampleContact || matchesContact(contact, actor.contact) || !relationships.includes(input.relationship as Relationship) ||
            input.consent !== true) {
          bad('Choose a separate guardian, relationship, and sharing consent.')
        }
        const invite: Invitation = {
          id: randomUUID(), payerId: actor.id, name, contact, relationship: input.relationship as Relationship, status: 'Pending',
        }
        invitations.set(invite.id, invite)
        return listEnrollments(actor)
      }

      const invite = typeof input.id === 'string' ? invitations.get(input.id) : undefined
      if (!invite) throw new MockError(404, 'Invitation unavailable.')
      if (input.action === 'revoke' && actor.role === 'payer' && actor.id === invite.payerId && !actor.sample) {
        if (invite.status !== 'Pending' && invite.status !== 'Accepted') throw new MockError(409, 'This invitation is closed.')
        invite.status = 'Revoked'
      } else if (input.action === 'withdraw' && actor.role === 'guardian' && invite.guardianId === actor.id && !actor.sample) {
        if (invite.status !== 'Accepted') throw new MockError(409, 'This invitation is closed.')
        invite.status = 'Revoked'
      } else if (actor.role === 'guardian' && isInviteFor(actor, invite)) {
        if (invite.status !== 'Pending') throw new MockError(409, 'This invitation is closed.')
        if (input.action === 'accept' && input.consent === true) invite.status = 'Accepted'
        else if (input.action === 'decline') invite.status = 'Declined'
        else bad('Accept with consent or decline the invitation.')
        invite.guardianId = actor.id
      } else {
        throw new MockError(404, 'Invitation unavailable.')
      }
      return listEnrollments(actor)
    }
    throw new MockError(404, 'Demo account action unavailable.')
  }

  function issueSyntheticPayerSession(actor: DemoProfile, safeLock?: boolean): DemoSession {
    if (actor.role !== 'admin') throw new MockError(403, 'Admin authorization required.')
    const current = profiles.get(syntheticTestPayer.id) ?? syntheticTestPayer
    const updated = typeof safeLock === 'boolean' ? { ...current, safeLock } : current
    profiles.set(updated.id, updated)
    return signIn(updated)
  }

  return {
    authenticate, currentEnrollment, handle, issueSyntheticPayerSession,
    syntheticPayerId: syntheticTestPayer.id,
    isEnrolled: (id: string | undefined, payerId: string, guardianId: string | null) => {
      const invite = currentEnrollment(payerId)
      return Boolean(id && invite?.id === id && invite.guardianId === guardianId)
    },
  }
}
