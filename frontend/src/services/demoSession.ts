export const reviewKey = 'pauseguard:demo:guardian-request'
export const payerKey = 'pauseguard:demo:payer-payment'
const draftKey = 'pauseguard:demo:payment-draft'

export function storageRead(storage: 'localStorage' | 'sessionStorage', key: string) {
  try {
    return window[storage].getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function storageWrite(storage: 'localStorage' | 'sessionStorage', key: string, value: string) {
  try {
    if (value) window[storage].setItem(key, value)
    else window[storage].removeItem(key)
    return true
  } catch {
    // Reference entry remains available when the browser blocks storage.
    return false
  }
}

export function isReference(value: string) {
  return /^pg_[a-zA-Z0-9_-]{1,80}$/.test(value)
}

export function savedDraft(accountId: string) {
  return storageRead('sessionStorage', `${draftKey}:${accountId}`)
}

export function saveDraft(accountId: string, value: string) {
  storageWrite('sessionStorage', `${draftKey}:${accountId}`, value)
}

export function toPaise(value: string) {
  const nativeDigits = '०१२३४५६७८९౦౧౨౩౪౫౬౭౮౯೦೧೨೩೪೫೬೭೮೯'
  const normalized = value.trim().replace(/[०-९౦-౯೦-೯]/g, (digit) => String(nativeDigits.indexOf(digit) % 10))
  const parts = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!parts) return null
  const paise = Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null
}

export function decimalRupees(paise: number) {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`
}

export function formatRupees(paise: number, locale = 'en-IN') {
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR' })
  const fractionFormat = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const [rupees, fraction] = decimalRupees(paise).split('.')
  return currency.formatToParts(Number(rupees)).map((part) =>
    part.type === 'fraction' ? fractionFormat.format(Number(fraction)) : part.value).join('')
}
