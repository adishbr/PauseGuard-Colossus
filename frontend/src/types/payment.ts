export type Role = 'payer' | 'guardian'
export const paymentStatuses = [
  'CREATED', 'AWAITING_WARNING', 'AWAITING_STEP_UP', 'AWAITING_GUARDIAN',
  'AWAITING_FALLBACK_REVIEW', 'READY_TO_EXECUTE', 'EXECUTED', 'REJECTED',
  'CANCELLED', 'EXPIRED', 'FAILED',
] as const

export type Status = typeof paymentStatuses[number]

export interface CreatePayment {
  beneficiary_id: string
  amount_paise: number
  purpose: string
  idempotency_key: string
}

export interface PaymentSummary {
  id: string
  status: Status
  tier: 0 | 1 | 2 | 3
  guardian_deadline: string | null
}

export interface GuardianPayment extends PaymentSummary {
  message: string
}

export interface PayerPayment extends PaymentSummary {
  amount_paise: number
  beneficiary_id: string
  purpose: string
  risk_score: number
  reason_codes: string[]
  version: number
}

export const terminalStatuses: ReadonlySet<Status> = new Set([
  'EXECUTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED',
])
