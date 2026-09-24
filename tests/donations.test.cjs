const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const donations = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('lib/donations.js', 'utf8')).toString('base64'))

test('donations accept all presets, decimal separators and the CHF 200 boundary', async () => {
  const { DONATION_CONFIG, amountInCents } = await donations
  for (const amount of DONATION_CONFIG.presets) assert.equal(amountInCents(String(amount)), amount * 100)
  for (const [amount, cents] of [['0.01', 1], ['2,50', 250], [' 12.34 ', 1234], ['200', 20000], ['200.00', 20000]]) assert.equal(amountInCents(amount), cents)
})

test('donations reject zero, negatives, excess precision, over-limit and ambiguous amounts', async () => {
  const { amountInCents } = await donations
  for (const amount of ['', ' ', '0', '0.00', '-1', '200.01', '201', '9999', '1.234', 'NaN', 'Infinity', '1e2', '1,2.3', 'CHF 5', null, 5]) assert.equal(amountInCents(amount), null, String(amount))
})

test('donations require both names, reject whitespace and preserve international names', async () => {
  const { validateDonation } = await donations
  const valid = validateDonation({ firstName: ' Élise ', lastName: '李', amount: '2.50' })
  assert.deepEqual(valid.errors, {}); assert.equal(valid.cents, 250)
  assert.deepEqual(Object.keys(validateDonation({ firstName: ' ', lastName: '', amount: '0' }).errors), ['firstName', 'lastName', 'amount'])
  assert.ok(validateDonation({ firstName: 'a'.repeat(81), lastName: 'Nom', amount: '5' }).errors.firstName)
})

test('recipient display derives from the single configuration and amounts are exact CHF cents', async () => {
  const { DONATION_CONFIG, displayPhone, formatDonation } = await donations
  assert.match(DONATION_CONFIG.phone, /^\+41\d{9}$/)
  assert.equal(displayPhone().replaceAll(' ', ''), DONATION_CONFIG.phone)
  assert.equal(formatDonation(1), 'CHF 0.01')
  assert.equal(formatDonation(1234), 'CHF 12.34')
})
