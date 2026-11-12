import type { IncomingMessage, ServerResponse } from 'node:http'
import { createDemoAccounts } from './accounts.ts'
import { MockError, readBody, respond } from './http.ts'
import { demoAccountPath } from '../src/types/account.ts'
import { createHash, randomUUID } from 'node:crypto'
import { beneficiaries, purposes } from './scenarios.ts'
import { defaultReviewDuration, demoReviewDurationHeader, parseReviewDuration } from './reviewPreference.ts'
import type { ReviewDuration } from './reviewPreference.ts'
import { terminalStatuses } from '../src/types/payment.ts'
import type { CreatePayment, GuardianPayment, PayerPayment, Status } from '../src/types/payment.ts'

const API = '/api/v2'
interface PaymentRecord {
  payment: PayerPayment
  input: CreatePayment
  payer: string
  guardian: string | null
  enrollmentId?: string
  reviewDuration?: ReviewDuration
  confirmationKey?: string
}

interface MockAuditEntry {
  seq: number
  paymentId: string
  payerId: string
  actorRole: string
  event: string
  fromStatus: Status | null
  toStatus: Status
  version: number
  timestamp: string
  prevHash: string
  hash: string
}

function hashAuditEntry(entry: Omit<MockAuditEntry, 'hash' | 'payerId'>): string {
  return createHash('sha256').update(JSON.stringify(entry)).digest('hex')
}

function transition(record: PaymentRecord, status: Status) {
  record.payment.status = status
  record.payment.version += 1
}

function guardianView(payment: PayerPayment): GuardianPayment {
  return {
    id: payment.id,
    status: payment.status,
    tier: payment.tier,
    guardian_deadline: payment.guardian_deadline,
    message: 'PauseGuard requested an independent safety review.',
  }
}

function classify(input: CreatePayment): Pick<PayerPayment, 'status' | 'tier' | 'risk_score' | 'reason_codes'> {
  if (input.beneficiary_id === 'recipient_flagged') {
    return { status: 'REJECTED', tier: 3, risk_score: 100, reason_codes: [] }
  }
  if (input.purpose === 'kyc_verification') {
    const reasons = ['RC_COERCION_PURPOSE']
    if (input.beneficiary_id === 'supplier_new') reasons.unshift('RC_NEW_BENEFICIARY')
    if (input.amount_paise >= 5_500_000) reasons.push('RC_LARGE_DEVIATION')
    return { status: 'AWAITING_GUARDIAN', tier: 3, risk_score: 100, reason_codes: reasons }
  }
  if (input.beneficiary_id === 'supplier_new') {
    return { status: 'AWAITING_WARNING', tier: 1, risk_score: 30, reason_codes: ['RC_NEW_BENEFICIARY'] }
  }
  return { status: 'READY_TO_EXECUTE', tier: 0, risk_score: 5, reason_codes: [] }
}

function validKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128
}

export function createMockApi(clock: () => number = Date.now) {
  const accounts = createDemoAccounts(clock)
  const payments = new Map<string, PaymentRecord>()
  const creations = new Map<string, PaymentRecord>()
  const auditLog: MockAuditEntry[] = []

  function recordAudit(record: PaymentRecord, actorRole: string, event: string, fromStatus: Status | null) {
    const seq = auditLog.length + 1
    const prevHash = auditLog.at(-1)?.hash ?? 'GENESIS'
    const base = {
      seq,
      paymentId: record.payment.id,
      actorRole,
      event,
      fromStatus,
      toStatus: record.payment.status,
      version: record.payment.version,
      timestamp: new Date(clock()).toISOString(),
      prevHash,
    }
    auditLog.push({ ...base, payerId: record.payer, hash: hashAuditEntry(base) })
  }

  function verifyAuditChain() {
    let expectedPrev = 'GENESIS'
    for (const entry of auditLog) {
      const { hash, payerId: _payerId, ...base } = entry
      if (entry.prevHash !== expectedPrev || hashAuditEntry(base) !== hash) {
        return { valid: false, total_events: auditLog.length, head_hash: auditLog.at(-1)?.hash ?? 'GENESIS', checked_at: new Date(clock()).toISOString() }
      }
      expectedPrev = hash
    }
    return { valid: true, total_events: auditLog.length, head_hash: expectedPrev, checked_at: new Date(clock()).toISOString() }
  }

  function assigned(record: PaymentRecord) {
    return accounts.isEnrolled(record.enrollmentId, record.payer, record.guardian)
  }

  function expire(record: PaymentRecord) {
    const { status, guardian_deadline } = record.payment
    if (status === 'AWAITING_GUARDIAN' && (!assigned(record) || (guardian_deadline && clock() >= Date.parse(guardian_deadline)))) {
      transition(record, 'AWAITING_FALLBACK_REVIEW')
      recordAudit(record, 'system', 'GUARDIAN_WINDOW_EXPIRED', status)
    }
  }

  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const path = url.pathname
    if (!path.startsWith(`${API}/`) && !path.startsWith(`${demoAccountPath}/`)) return next()

    function snapshot(record: PaymentRecord, role: string) {
      if (record.payment.status === 'AWAITING_GUARDIAN' && record.reviewDuration) {
        response.setHeader(demoReviewDurationHeader, record.reviewDuration)
      }
      return role === 'guardian' ? guardianView(record.payment) : record.payment
    }

    async function handle() {
      const route = path.slice(API.length)
      const method = request.method
      if (method === 'GET' && route === '/health') return { status: 'ok', mode: 'mock' }
      if (path.startsWith(`${demoAccountPath}/`)) {
        const demoRoute = path.slice(demoAccountPath.length)
        if (demoRoute === '/admin/test-payer' && method === 'POST') {
          const { profile: actor } = accounts.authenticate(request.headers.authorization)
          if (actor.role !== 'admin') throw new MockError(403, 'Admin authorization required.')
          const body = await readBody(request).catch(() => ({} as Record<string, unknown>))
          const safeLock = typeof body.safeLock === 'boolean' ? body.safeLock : undefined
          return accounts.issueSyntheticPayerSession(actor, safeLock)
        }
        if (demoRoute === '/admin/audit' && method === 'GET') {
          const { profile: actor } = accounts.authenticate(request.headers.authorization)
          if (actor.role !== 'admin') throw new MockError(403, 'Admin authorization required.')
          const filterId = url.searchParams.get('paymentId')
          const syntheticPayments = [...payments.values()]
            .filter((record) => record.payer === accounts.syntheticPayerId && (!filterId || record.payment.id === filterId))
            .map((record) => {
              expire(record)
              return record.payment
            })
            .reverse()
          const events = auditLog
            .filter((entry) => entry.payerId === accounts.syntheticPayerId && (!filterId || entry.paymentId === filterId))
            .map(({ payerId: _payerId, ...rest }) => rest)
          return { payments: syntheticPayments, events }
        }
        if (demoRoute !== '/reviews' || method !== 'GET') return accounts.handle(demoRoute, request)
        const { profile } = accounts.authenticate(request.headers.authorization)
        if (profile.role !== 'guardian') throw new MockError(403, 'Only a guardian can open review alerts.')
        const hint = url.searchParams.get('reference')
        const found = [...payments.values()].reverse().find((record) => {
          if (record.guardian !== profile.id || (profile.sample && record.payment.id !== hint)) return false
          expire(record)
          return assigned(record) && record.payment.status === 'AWAITING_GUARDIAN'
        })
        return { id: found?.payment.id ?? null }
      }
      const { profile: actor } = accounts.authenticate(request.headers.authorization)

      if (method === 'GET' && route === '/audit/verify') {
        if (actor.role !== 'admin') throw new MockError(403, 'Admin authorization required.')
        return verifyAuditChain()
      }

      if (method === 'POST' && route === '/payments') {
        if (actor.role !== 'payer') throw new MockError(403, 'This demo role cannot start payments.')
        const body = await readBody(request)
        const { profile: payer } = accounts.authenticate(request.headers.authorization)
        const { beneficiary_id, purpose, amount_paise, idempotency_key } = body
        if (typeof beneficiary_id !== 'string' || !Object.hasOwn(beneficiaries, beneficiary_id) ||
            typeof purpose !== 'string' || !Object.hasOwn(purposes, purpose) ||
            typeof amount_paise !== 'number' || !Number.isSafeInteger(amount_paise) || amount_paise <= 0 ||
            !validKey(idempotency_key)) {
          throw new MockError(422, 'Enter a positive amount and choose a demo recipient and purpose.')
        }
        const input = { beneficiary_id, purpose, amount_paise, idempotency_key }
        const key = `${actor.id}:${idempotency_key}`
        const existing = creations.get(key)
        if (existing) {
          if (JSON.stringify(existing.input) !== JSON.stringify(input)) {
            throw new MockError(409, 'This payment reference already belongs to another request.')
          }
          expire(existing)
          return snapshot(existing, actor.role)
        }
        // The demo adapter supplies a preference; the fixture owns deadline creation.
        const durationHint = request.headers[demoReviewDurationHeader]
        const requestedDuration = durationHint === undefined ? defaultReviewDuration : parseReviewDuration(durationHint)
        if (!requestedDuration) throw new MockError(422, 'Choose 30, 45, or 60 seconds for guardian review.')
        const outcome = payer.safeLock ? { status: 'REJECTED', tier: 3, risk_score: 100, reason_codes: [] } as const : classify(input)
        const enrollment = outcome.status === 'AWAITING_GUARDIAN' ? accounts.currentEnrollment(actor.id) : undefined
        const reviewDuration = enrollment ? requestedDuration : undefined
        const status = outcome.status === 'AWAITING_GUARDIAN' && !enrollment ? 'AWAITING_FALLBACK_REVIEW' : outcome.status
        const reasonCodes = [...outcome.reason_codes]
        if (status !== 'REJECTED' && payer.thresholdPaise !== null && amount_paise >= payer.thresholdPaise) {
          reasonCodes.push('RC_CUSTOMER_ALERT_PREFERENCE')
        }
        const payment: PayerPayment = {
          id: `pg_${randomUUID()}`, ...outcome, status, reason_codes: reasonCodes, beneficiary_id, amount_paise, purpose, version: 1,
          guardian_deadline: reviewDuration ? new Date(clock() + reviewDuration * 1_000).toISOString() : null,
        }
        // The two synthetic accounts are pre-enrolled for this fixture only.
        const record = {
          payment, input, payer: actor.id, guardian: enrollment?.guardianId ?? null, enrollmentId: enrollment?.id, reviewDuration,
        }
        payments.set(payment.id, record)
        creations.set(key, record)
        recordAudit(record, actor.role, payer.safeLock ? 'PAYMENT_BLOCKED_SAFELOCK' : 'PAYMENT_CREATED', 'CREATED')
        return snapshot(record, actor.role)
      }

      const [, resource, id, ...segments] = route.split('/')
      const action = segments.join('/')
      if (resource !== 'payments' || !id) throw new MockError(404, 'This route is unavailable in the demo.')
      const record = payments.get(id)
      if (!record || (actor.id !== record.payer && (actor.id !== record.guardian || !assigned(record)))) {
        throw new MockError(404, 'This payment is unavailable for this demo account.')
      }
      const { payment } = record
      if (method === 'GET' && !action) {
        expire(record)
        return snapshot(record, actor.role)
      }
      if (method !== 'POST') throw new MockError(405, 'This method is unavailable for the payment.')
      if (action === 'guardian/decision') {
        if (actor.id !== record.guardian) throw new MockError(403, 'Only the assigned guardian can review.')
        const { decision } = await readBody(request)
        accounts.authenticate(request.headers.authorization)
        if (!assigned(record)) throw new MockError(404, 'This payment is unavailable for this demo account.')
        expire(record)
        if (payment.status !== 'AWAITING_GUARDIAN') {
          throw new MockError(409, 'This guardian review has closed. Refresh its status.')
        }
        if (decision !== 'approve' && decision !== 'reject') throw new MockError(422, 'Choose a review decision.')
        const previous = payment.status
        transition(record, decision === 'approve' ? 'READY_TO_EXECUTE' : 'REJECTED')
        recordAudit(record, actor.role, decision === 'approve' ? 'GUARDIAN_APPROVED' : 'GUARDIAN_REJECTED', previous)
        return guardianView(payment)
      }
      if (actor.id !== record.payer) throw new MockError(403, 'Only the payer can take this action.')
      if (action === 'confirm') {
        const { idempotency_key } = await readBody(request)
        const { profile: payer } = accounts.authenticate(request.headers.authorization)
        if (!validKey(idempotency_key)) throw new MockError(422, 'A confirmation key is required.')
        if (payment.status === 'EXECUTED' && idempotency_key === record.confirmationKey) return payment
        if (payment.status !== 'READY_TO_EXECUTE') throw new MockError(409, 'This payment is unavailable for confirmation.')
        if (payer.safeLock || (record.enrollmentId && !assigned(record))) {
          const previous = payment.status
          transition(record, 'REJECTED')
          recordAudit(record, actor.role, 'CONFIRM_REJECTED_SAFELOCK_OR_REVOKE', previous)
          return payment
        }
        record.confirmationKey = idempotency_key
        const previous = payment.status
        transition(record, 'EXECUTED')
        recordAudit(record, actor.role, 'PAYMENT_CONFIRMED_EXECUTED', previous)
        return payment
      }
      expire(record)
      if (action === 'warning/acknowledge' && payment.status === 'AWAITING_WARNING') {
        const previous = payment.status
        transition(record, 'READY_TO_EXECUTE')
        recordAudit(record, actor.role, 'WARNING_ACKNOWLEDGED', previous)
        return payment
      }
      if (action === 'fallback/activate' && payment.status === 'AWAITING_FALLBACK_REVIEW') return payment
      if (action === 'cancel' && payment.status !== 'CREATED' && !terminalStatuses.has(payment.status)) {
        const previous = payment.status
        transition(record, 'CANCELLED')
        recordAudit(record, actor.role, 'PAYMENT_CANCELLED', previous)
        return payment
      }
      throw new MockError(409, 'This action is unavailable for the current payment status.')
    }

    void handle().then(
      (body) => respond(response, clock(), 200, body),
      (error: unknown) => {
        const known = error instanceof MockError
        respond(response, clock(), known ? error.status : 500, {
          detail: known ? error.message : 'The local demo API encountered an error.',
        })
      },
    )
  }
}
