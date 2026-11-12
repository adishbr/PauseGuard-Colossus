import type { Locale } from '../locales/messages.ts'
import type { Role } from './payment.ts'

// Admin is an application-layer role only (not a payment-domain role).
export type AppRole = Role | 'admin'

export const demoAccountPath = '/__pauseguard/demo'
export const accountCategories = { personal: 'Personal', professional: 'Professional', small_business: 'Small Business', enterprise: 'Enterprise' } as const
export const relationships = ['Family', 'Friend', 'Colleague', 'Other trusted contact'] as const
export type AccountCategory = keyof typeof accountCategories
export type Relationship = typeof relationships[number]
export type EnrollmentStatus = 'Pending' | 'Accepted' | 'Declined' | 'Revoked'

export interface DemoProfile {
  id: string
  role: AppRole
  sample: boolean
  name: string
  contact: string
  category: AccountCategory
  language: Locale
  largeText: boolean
  organization: string
  recurringSupplier: string
  thresholdPaise: number | null
  notifications: boolean
  quietStart: string
  quietEnd: string
  callConsent: boolean
  safeLock: boolean
}

export type ProfileUpdate = Partial<Omit<DemoProfile, 'id' | 'role' | 'sample'>>
export interface DemoSession { token: string; expiresAt: number; profile: DemoProfile }
export interface EnrollmentView { id: string; name: string; relationship: Relationship; status: EnrollmentStatus }

export function isEmailContact(value: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value.trim())
}

export function isMobileContact(value: string): boolean {
  const cleaned = value.trim().replace(/[\s-]/g, '')
  return /^(?:\+91)?[6-9]\d{9}$/.test(cleaned) || /^00000\d{5}$/.test(cleaned)
}

export function canonicalContact(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const cleaned = trimmed.replace(/[\s-]/g, '')
  if (cleaned.startsWith('+91') && /^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(3)
  }
  return trimmed
}

export function demoContact(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > 90 || trimmed.length < 3) return undefined
  if (isEmailContact(trimmed)) return trimmed.toLowerCase()
  const cleaned = trimmed.replace(/[\s-]/g, '')
  if (/^(?:\+91)?[6-9]\d{9}$/.test(cleaned) || /^00000\d{5}$/.test(cleaned)) {
    return cleaned
  }
  return undefined
}

export function demoName(value: unknown) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length <= 64 && (normalized.match(/\p{L}/gu)?.length ?? 0) >= 2 &&
      /^[\p{L}\p{M} .'-]+$/u.test(normalized)) return normalized
}
