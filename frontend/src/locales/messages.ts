import { en } from './en.ts'
import type { MessageKey, Translation } from './en.ts'
import { kn } from './kn.ts'
import { hi } from './hi.ts'
import { te } from './te.ts'

export const languages = {
  en: { label: 'English', region: 'en-IN' },
  kn: { label: 'ಕನ್ನಡ', region: 'kn-IN' },
  hi: { label: 'हिन्दी', region: 'hi-IN' },
  te: { label: 'తెలుగు', region: 'te-IN' },
} as const

export type Locale = keyof typeof languages
export type Translate = (key: MessageKey) => string
const catalogs: Record<Locale, Translation> = { en, kn, hi, te }

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(languages, value)
}

export function translator(locale: Locale): Translate {
  return (key) => catalogs[locale][key] ?? en[key]
}
