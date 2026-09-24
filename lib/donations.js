// Public recipient information; no payment credentials or transaction tracking.
export const DONATION_CONFIG = Object.freeze({
  phone: '+41799269688',
  currency: 'CHF',
  maxCents: 20000,
  presets: [1, 2, 5, 10],
  instructionsUrl: 'https://www.twint.ch/fr/faq/comment-envoyer-ou-demander-de-largent-a-un-autre-utilisateur-twint/',
})

export function displayPhone(phone = DONATION_CONFIG.phone) {
  return phone.replace(/^(\+41)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')
}

export function amountInCents(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value.trim())) return null
  const [whole, decimal = ''] = value.trim().replace(',', '.').split('.')
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  return cents > 0 && cents <= DONATION_CONFIG.maxCents ? cents : null
}

export function formatDonation(cents) {
  return `${DONATION_CONFIG.currency} ${(cents / 100).toFixed(2)}`
}

export function validateDonation({ firstName, lastName, amount }) {
  const errors = {}
  for (const [key, label, value] of [['firstName', 'prénom', firstName], ['lastName', 'nom', lastName]]) {
    if (typeof value !== 'string' || !value.trim()) errors[key] = `Indique ton ${label}.`
    else if (value.trim().length > 80) errors[key] = '80 caractères maximum.'
  }
  const cents = amountInCents(amount)
  if (cents === null) errors.amount = 'Choisis un montant entre CHF 0.01 et CHF 200.00, avec au maximum deux décimales.'
  return { errors, cents }
}
