/**
 * Admin API service layer.
 *
 * Mode A (Mock UPI):
 *  - Admin sessions NEVER call /api/v2/payments directly as a payer.
 *  - Admin calls isolated mock-admin endpoints (/__pauseguard/demo/admin/*) with the admin token
 *    to obtain an explicitly authorized synthetic test-payer context and read synthetic audit evidence.
 *  - Payment execution still passes through the canonical /api/v2/payments endpoints under that
 *    synthetic payer context, preserving Safe-Lock, warnings, guardian review, and confirmation.
 *
 * Mode B (Razorpay Test Mode):
 *  - All functions are stubs that reject with AdminApiError until Komal's FastAPI backend
 *    provides the required sandbox endpoints.
 *
 * Security invariants:
 *  - Razorpay key_secret must NEVER appear in this file or any frontend source.
 *  - Signature verification is performed server-side only.
 *  - Client-side Razorpay callbacks are forwarded to the backend for verification.
 *  - Payment state is never updated based on a client-only success signal.
 */

import { demoAccountPath } from '../types/account.ts'
import type { DemoSession } from '../types/account.ts'
import type { AdminAuditResponse, AuditVerifyResult } from '../types/admin.ts'
import { AccountError, sessionExpired } from './accountApi.ts'

export class AdminApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminApiError'
  }
}

export {
  ApiError,
  createPayment as adminCreatePayment,
  getPayment as adminGetPayment,
  payerAction as adminPayerAction,
  paymentError,
} from './paymentApi.ts'

async function adminRequest<T>(url: string, adminToken: string, body?: object): Promise<T> {
  const headers = new Headers({ Authorization: `Bearer ${adminToken}` })
  if (body) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new AccountError(0, 'Demo service unavailable. Check your connection and try again.')
  }

  const data = await response.json().catch(() => undefined)
  if (response.status === 401 && adminToken) {
    window.dispatchEvent(new CustomEvent(sessionExpired, { detail: adminToken }))
  }
  if (!response.ok || !data) {
    throw new AccountError(
      response.status,
      typeof data?.detail === 'string' ? data.detail : 'Admin service could not complete this action.',
    )
  }
  return data as T
}

export const adminMockApi = {
  /**
   * Obtains or updates the explicitly authorized synthetic payer session for admin Mode A testing.
   * Requires a valid admin bearer token; rejected (403) for payer/guardian tokens.
   */
  getSyntheticPayerSession: (adminToken: string, safeLock?: boolean) =>
    adminRequest<DemoSession>(`${demoAccountPath}/admin/test-payer`, adminToken,
      typeof safeLock === 'boolean' ? { safeLock } : {}),

  /**
   * Fetches synthetic test payments and hash-chained audit events created in the admin sandbox.
   * Requires a valid admin bearer token.
   */
  getAudit: (adminToken: string, paymentId?: string) => {
    const query = paymentId ? `?paymentId=${encodeURIComponent(paymentId)}` : ''
    return adminRequest<AdminAuditResponse>(`${demoAccountPath}/admin/audit${query}`, adminToken)
  },

  /**
   * Verifies the local mock audit hash chain via GET /api/v2/audit/verify (Admin-only).
   */
  verifyAuditChain: (adminToken: string) =>
    adminRequest<AuditVerifyResult>('/api/v2/audit/verify', adminToken),
}

// ---------------------------------------------------------------------------
// Mode B — Razorpay Test Mode (stubs — not yet implemented)
// ---------------------------------------------------------------------------

const RAZORPAY_UNAVAILABLE =
  'Razorpay Test Mode requires backend integration. Coordinate with Komal (Backend Lead) to enable this mode.'

export const razorpayApi = {
  /**
   * Stub: creates a Razorpay test order via POST /api/v2/admin/razorpay/order.
   * Will be implemented when the backend endpoint is available.
   */
  createOrder: async (_token: string, _amountPaise: number): Promise<never> => {
    throw new AdminApiError(RAZORPAY_UNAVAILABLE)
  },

  /**
   * Stub: retrieves the Razorpay public test key_id via GET /api/v2/admin/razorpay/config.
   * key_secret is never sent to the frontend.
   */
  getConfig: async (_token: string): Promise<never> => {
    throw new AdminApiError(RAZORPAY_UNAVAILABLE)
  },

  /**
   * Stub: verifies a Razorpay payment callback via POST /api/v2/admin/razorpay/verify.
   * HMAC signature verification happens server-side only.
   */
  verifyPayment: async (
    _token: string,
    _payload: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string },
  ): Promise<never> => {
    throw new AdminApiError(RAZORPAY_UNAVAILABLE)
  },

  /**
   * Stub: fetches order/payment reconciliation status via GET /api/v2/admin/razorpay/status/{order_id}.
   */
  getOrderStatus: async (_token: string, _orderId: string): Promise<never> => {
    throw new AdminApiError(RAZORPAY_UNAVAILABLE)
  },
}
