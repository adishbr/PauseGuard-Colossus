import { demoAccountPath } from '../types/account.ts'
import type { AppRole, DemoProfile, DemoSession, EnrollmentView, ProfileUpdate } from '../types/account.ts'
import { storageRead, storageWrite } from './demoSession.ts'

export const sessionExpired = 'pauseguard:session-expired'

export class AccountError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const savedSession = (role: AppRole) => storageRead('sessionStorage', `pauseguard:demo:session:${role}`)
export const saveSession = (role: AppRole, token: string) => storageWrite('sessionStorage', `pauseguard:demo:session:${role}`, token)

async function request<T>(path: string, token?: string, body?: object, method = body ? 'POST' : 'GET'): Promise<T> {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(demoAccountPath + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new AccountError(0, 'Demo service unavailable. Check your connection and try again.')
  }
  const data = await response.json().catch(() => undefined)
  if (response.status === 401 && token) window.dispatchEvent(new CustomEvent(sessionExpired, { detail: token }))
  if (!response.ok || !data) {
    throw new AccountError(response.status, typeof data?.detail === 'string' ? data.detail : 'The demo could not complete this action.')
  }
  return data as T
}

export const accountApi = {
  login: (role: AppRole, contact: string, sample = false) => request<DemoSession>('/session', undefined, { role, contact, sample }),
  register: (role: AppRole, details: ProfileUpdate) => request<DemoSession>('/register', undefined, { ...details, role }),
  session: (token: string) => request<DemoSession>('/session', token),
  logout: (token: string) => request('/session', token, undefined, 'DELETE'),
  save: (token: string, changes: ProfileUpdate) => request<DemoProfile>('/profile', token, changes),
  enrollments: (token: string) => request<EnrollmentView[]>('/enrollment', token),
  enrollmentAction: (token: string, body: object) => request<EnrollmentView[]>('/enrollment', token, body),
  review: (token: string, reference: string) => request<{ id: string | null }>(`/reviews?reference=${encodeURIComponent(reference)}`, token),
}
