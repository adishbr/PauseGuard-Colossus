// Admin Payment Testing Dashboard — type definitions
// These types are admin-UI-only and do not affect canonical V2 payment-domain contracts.
import type { PayerPayment, Status } from './payment.ts'

/** The two selectable testing modes in the Admin dashboard. */
export type AdminTestMode = 'mock-upi' | 'razorpay'

/** Configuration for a single Mock UPI test run. */
export interface MockUpiTestConfig {
  beneficiary_id: string
  amount_paise: number
  purpose: string
}

/** Single hash-chained mock audit event for admin test payments. */
export interface AdminAuditEntry {
  seq: number
  paymentId: string
  actorRole: string
  event: string
  fromStatus: Status | null
  toStatus: Status
  version: number
  timestamp: string
  prevHash: string
  hash: string
}

/** Response from GET /__pauseguard/demo/admin/audit (isolated to admin synthetic payer). */
export interface AdminAuditResponse {
  payments: PayerPayment[]
  events: AdminAuditEntry[]
}

/** Response from GET /api/v2/audit/verify (Admin-only). */
export interface AuditVerifyResult {
  valid: boolean
  total_events: number
  head_hash: string
  checked_at: string
}

/**
 * Razorpay test order & reconciliation preview — populated only when Komal's backend is available.
 * All fields remain null / pending while backend integration is unavailable.
 */
export interface RazorpayOrderPreview {
  orderId: string | null
  paymentId: string | null
  amountPaise: number | null
  currency: 'INR' | null
  keyId: string | null
  verificationStatus: 'not_connected' | 'pending' | 'verified' | 'failed'
  reconciliationStatus: 'unavailable' | 'created' | 'captured' | 'refunded' | 'failed'
}

/** Razorpay integration status as known by the frontend. */
export type RazorpayBackendStatus = 'unavailable' | 'pending' | 'available'

/**
 * Required backend endpoints for Razorpay Test Mode.
 * Listed here as documentation; none are called until Komal's implementation is confirmed.
 */
export const razorpayRequiredEndpoints = [
  { method: 'POST', path: '/api/v2/admin/razorpay/order',             note: 'Create a Razorpay test order server-side' },
  { method: 'POST', path: '/api/v2/admin/razorpay/verify',            note: 'Verify Razorpay payment signature (HMAC) server-side' },
  { method: 'GET',  path: '/api/v2/admin/razorpay/status/{order_id}', note: 'Fetch order/payment reconciliation status' },
  { method: 'GET',  path: '/api/v2/admin/razorpay/config',            note: 'Return Razorpay test key_id (public key only)' },
] as const
