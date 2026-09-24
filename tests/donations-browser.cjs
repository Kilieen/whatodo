// Uses the existing disposable-local fixture. Never opens TWINT or sends money.
const { chromium } = require(process.env.WHATODO_PLAYWRIGHT_PATH || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const base = process.env.WHATODO_BROWSER_URL || 'http://127.0.0.1:3100'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local test server required')
const fixture = JSON.parse(fs.readFileSync(process.env.WHATODO_TEST_FIXTURE, 'utf8'))
const config = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('lib/donations.js', 'utf8')).toString('base64'))

async function run() {
  const { DONATION_CONFIG, displayPhone } = await config
  const browser = await chromium.launch({ headless: true })
  const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'whatodo-donations-'))
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 667 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'] })
      // Exercise the same UI while display-mode reports standalone, as in an installed PWA.
      if (mobile) await context.addInitScript(() => {
        const original = window.matchMedia.bind(window)
        window.matchMedia = query => {
          const result = original(query)
          if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true })
          return result
        }
      })
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      const errors = [], sentNames = [], unexpectedNavigation = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => {
        if (request.postData()?.includes('DonationTest')) sentNames.push(request.url())
        // Existing Google Fonts styles/fonts are unrelated to the donation flow.
        const url = new URL(request.url())
        const existingFont = (url.hostname === 'fonts.googleapis.com' && request.resourceType() === 'stylesheet') || (url.hostname === 'fonts.gstatic.com' && request.resourceType() === 'font')
        if (url.origin !== base && !existingFont) unexpectedNavigation.push(request.url())
      })
      await page.goto(base)
      await page.evaluate(({ viewer, ws }) => { localStorage.setItem('whatodo_token', viewer.token); localStorage.setItem('whatodo_workspace', ws.id) }, fixture)
      await page.reload()
      await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor()
      if (mobile) await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click()
      const trigger = page.getByRole('button', { name: 'Faire un don', exact: true })
      await trigger.focus(); await page.keyboard.press('Enter')
      const modal = page.getByRole('dialog')
      await modal.waitFor()
      assert.equal(await page.getByLabel('Prénom', { exact: true }).evaluate(el => el === document.activeElement), true)
      await modal.getByRole('button', { name: 'Continuer avec TWINT', exact: true }).click()
      await modal.getByText('Indique ton prénom.', { exact: true }).waitFor()
      await modal.getByText('Indique ton nom.', { exact: true }).waitFor()
      await modal.getByLabel('Prénom', { exact: true }).fill('DonationTest')
      await modal.getByLabel('Nom', { exact: true }).fill('NomTest')
      for (const value of DONATION_CONFIG.presets) {
        await modal.getByRole('button', { name: `CHF ${value}`, exact: true }).click()
        assert.equal(await modal.getByRole('button', { name: `CHF ${value}`, exact: true }).getAttribute('aria-pressed'), 'true')
        await modal.getByText(`CHF ${value.toFixed(2)}`, { exact: true }).waitFor()
      }
      await modal.getByRole('button', { name: 'Autre montant', exact: true }).click()
      const amount = modal.getByLabel('Montant personnalisé (CHF)', { exact: true })
      for (const invalid of ['0', '-1', '200.01', '1.234']) {
        await amount.fill(invalid)
        await modal.getByRole('button', { name: 'Continuer avec TWINT', exact: true }).click()
        await modal.getByRole('alert').filter({ hasText: 'Choisis un montant' }).waitFor()
      }
      await amount.fill('12,50')
      await modal.getByText('CHF 12.50', { exact: true }).waitFor()
      const box = await modal.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= (mobile ? 390 : 1440), 'modal fits viewport horizontally')
      assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'no horizontal scroll')
      await page.screenshot({ path: path.join(screenshots, mobile ? 'mobile-form.png' : 'desktop-form.png'), fullPage: true, animations: 'disabled' })
      await modal.getByRole('button', { name: 'Continuer avec TWINT', exact: true }).click()
      await modal.getByText(/Ouvre manuellement ton application TWINT/).waitFor()
      assert.equal(await modal.getByLabel('Numéro TWINT destinataire').inputValue(), displayPhone())
      assert.match(await modal.innerText(), /CHF 12\.50/)
      assert.doesNotMatch(await modal.innerText(), /Paiement réussi|Don reçu/)
      assert.equal(await modal.getByRole('button', { name: 'Ouvrir TWINT', exact: true }).count(), 0, 'no fake deep link')
      assert.equal(await modal.getByRole('link', { name: /Guide officiel TWINT/ }).getAttribute('href'), DONATION_CONFIG.instructionsUrl)
      await modal.getByRole('button', { name: 'Copier le numéro', exact: true }).click()
      await modal.getByText('Numéro copié.', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), DONATION_CONFIG.phone)
      await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new DOMException('denied', 'NotAllowedError') } }))
      await modal.getByRole('button', { name: 'Copier le numéro', exact: true }).click()
      await modal.getByText(/La copie automatique est indisponible/).waitFor()
      assert.equal(await modal.getByLabel('Numéro TWINT destinataire').evaluate(el => el.selectionEnd - el.selectionStart), displayPhone().length)
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true, 'keyboard focus stays inside modal')
      }
      await page.screenshot({ path: path.join(screenshots, mobile ? 'mobile-instructions.png' : 'desktop-instructions.png'), fullPage: true, animations: 'disabled' })
      await modal.getByRole('button', { name: 'Modifier', exact: true }).click()
      assert.equal(await modal.getByLabel('Montant personnalisé (CHF)').inputValue(), '12,50')
      await page.keyboard.press('Escape'); await modal.waitFor({ state: 'hidden' })
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'focus restored to trigger')
      await trigger.click()
      assert.equal(await page.getByLabel('Prénom', { exact: true }).inputValue(), '', 'names discarded on close')
      assert.equal(await page.getByLabel('Nom', { exact: true }).inputValue(), '')
      await modal.getByRole('button', { name: 'Close', exact: true }).click()
      await modal.waitFor({ state: 'hidden' })
      const storage = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))
      assert.doesNotMatch(storage, /DonationTest|NomTest/)
      assert.deepEqual(sentNames, []); assert.deepEqual(unexpectedNavigation, []); assert.deepEqual(errors, [])
      // Abandonment never submits a declaration or creates a notification.
      const declarations = []
      page.on('request', request => { if (request.url() === base + '/api/donations') declarations.push(JSON.parse(request.postData())) })
      async function instructions() {
        await trigger.click()
        await modal.getByLabel('Prénom', { exact: true }).fill('DonationTest')
        await modal.getByLabel('Nom', { exact: true }).fill('NomTest')
        await modal.getByRole('button', { name: 'Continuer avec TWINT', exact: true }).click()
      }
      await instructions()
      await modal.getByRole('button', { name: 'Abandonner', exact: true }).click()
      await modal.waitFor({ state: 'hidden' })
      assert.equal(declarations.length, 0)
      // Simulate a lost response AFTER the server has stored the donation.
      let firstResponse
      await page.route('**/api/donations', async route => {
        const response = await route.fetch()
        firstResponse = await response.json()
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Réponse perdue (test)' }) })
      }, { times: 1 })
      await instructions()
      await modal.getByRole('button', { name: 'J’ai fait le don', exact: true }).evaluate(button => { button.click(); button.click() })
      await modal.getByRole('alert').filter({ hasText: 'Réponse perdue' }).waitFor()
      assert.equal(declarations.length, 1, 'synchronous double click submits only once')
      await modal.getByRole('button', { name: 'J’ai fait le don', exact: true }).click()
      await modal.getByText('Ta déclaration de don a bien été enregistrée.', { exact: true }).waitFor()
      assert.equal(declarations.length, 2)
      assert.equal(declarations[0].requestId, declarations[1].requestId, 'retry uses same idempotency key')
      assert.equal(firstResponse.status, 'declared_paid')
      assert.doesNotMatch(await modal.innerText(), /Paiement confirmé|Paiement reçu|Don vérifié/)
      const notificationResponse = await context.request.get(base + '/api/notifications', { headers: { Authorization: `Bearer ${fixture.owner.token}`, 'X-Workspace-Id': fixture.ws.id } })
      const ownerNotifications = await notificationResponse.json()
      assert.equal(ownerNotifications.filter(n => n.id === `donation:${firstResponse.id}:${fixture.owner.user.id}`).length, 1)
      await modal.getByRole('button', { name: 'Fermer', exact: true }).click()
      await modal.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      if (mobile) {
        assert.equal(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), true)
        await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
      }
      console.log(`PASS ${mobile ? 'mobile + standalone simulated + service worker' : 'desktop'}: keyboard, names, amounts, clipboard/fallback, privacy, responsive modal and no payment claims`)
      await context.close()
    }
    console.log('Screenshots:', screenshots)
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
