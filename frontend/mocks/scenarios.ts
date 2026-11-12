export const beneficiaries = {
  merchant_familiar: 'Cedar Café',
  supplier_new: 'Willow Supplies',
  recipient_flagged: 'Harbor Trading',
} as const

export const purposes = {
  purchase: 'Purchase',
  supplier_payment: 'Supplier payment',
  kyc_verification: 'KYC or verification request',
} as const

export const scenarios = [
  { title: 'everyday', tag: 'routine', beneficiary: 'merchant_familiar', amount: '100', purpose: 'purchase' },
  { title: 'unfamiliar', tag: 'warning', beneficiary: 'supplier_new', amount: '50000', purpose: 'supplier_payment' },
  { title: 'coerced', tag: 'guardianReview', beneficiary: 'supplier_new', amount: '55000', purpose: 'kyc_verification' },
  { title: 'flagged', tag: 'blocked', beneficiary: 'recipient_flagged', amount: '15000', purpose: 'purchase' },
] as const
