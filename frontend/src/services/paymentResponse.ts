import { isReference } from './demoSession.ts'
import { paymentStatuses } from '../types/payment.ts'
import type { GuardianPayment, PayerPayment, Role, Status } from '../types/payment.ts'

const statuses = new Set<string>(paymentStatuses)
const guardianFields = new Set(['id', 'status', 'tier', 'guardian_deadline', 'message'])

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parsePayment(value: unknown, role: 'payer', id?: string): PayerPayment | undefined
export function parsePayment(value: unknown, role: 'guardian', id?: string): GuardianPayment | undefined
export function parsePayment(value: unknown, role: Role, id?: string): PayerPayment | GuardianPayment | undefined
export function parsePayment(value: unknown, role: Role, id?: string) {
  if (!isObject(value)) return
  const { id: reference, status, tier, guardian_deadline: deadline } = value
  if (typeof reference !== 'string' || !isReference(reference) || (id && id !== reference) ||
      typeof status !== 'string' || !statuses.has(status) ||
      (tier !== 0 && tier !== 1 && tier !== 2 && tier !== 3) ||
      !(deadline === null || (typeof deadline === 'string' && Number.isFinite(Date.parse(deadline)))) ||
      (status === 'AWAITING_GUARDIAN' && deadline === null)) return
  const summary = { id: reference, status: status as Status, tier, guardian_deadline: deadline }

  if (role === 'guardian') {
    if (typeof value.message !== 'string' || Object.keys(value).some((key) => !guardianFields.has(key))) return
    return { ...summary, message: value.message }
  }

  const { amount_paise, beneficiary_id, purpose, risk_score, reason_codes, version } = value
  if (typeof amount_paise !== 'number' || !Number.isSafeInteger(amount_paise) || amount_paise <= 0 ||
      typeof beneficiary_id !== 'string' || !beneficiary_id || typeof purpose !== 'string' || !purpose ||
      typeof risk_score !== 'number' || !Number.isFinite(risk_score) ||
      !Array.isArray(reason_codes) || !reason_codes.every((reason) => typeof reason === 'string') ||
      typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return
  return { ...summary, amount_paise, beneficiary_id, purpose, risk_score, reason_codes, version }
}
