const { chromium } = require(process.env.WHATODO_PLAYWRIGHT_PATH || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fixture = JSON.parse(fs.readFileSync(process.env.WHATODO_TEST_FIXTURE, 'utf8'))
const base = 'http://127.0.0.1:3100'
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' })
    const errors = [], taskCalls = [], marks = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/\/api\/tasks(?:\/|\?|$)/.test(request.url())) taskCalls.push(request.url()) })
    page.on('response', response => { if (response.url().endsWith('/notifications/mark-read')) marks.push(response.status()) })
    await page.goto(base)
    await page.evaluate(({ owner, ws }) => { localStorage.setItem('whatodo_token', owner.token); localStorage.setItem('whatodo_workspace', ws.id) }, fixture)
    await page.reload()
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor()
    await page.locator('aside nav').getByRole('button', { name: /^Notifications/ }).click()
    await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor()
    await page.getByRole('button').filter({ hasText: 'Nouveau don déclaré ❤️' }).first().waitFor()
    taskCalls.length = 0
    const marked = page.waitForResponse(r => r.url().endsWith('/notifications/mark-read'))
    await page.getByRole('button').filter({ hasText: 'Nouveau don déclaré ❤️' }).first().click()
    assert.equal((await marked).status(), 200)
    const dialog = page.getByRole('dialog')
    await dialog.getByText(/Jean Dupont indique avoir effectué un don de CHF/).waitFor()
    await dialog.getByText('Cette information est une déclaration utilisateur et ne constitue pas une confirmation TWINT.').waitFor()
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
    assert.ok(marks.includes(200))
    assert.deepEqual(taskCalls, [])
    assert.doesNotMatch(await page.locator('body').innerText(), /Invalid id|id invalide/)
    // Old donation documents have only body/link. Unknown types must ignore dangerous links.
    const notification = (id, type, link) => ({ id, type, title: id, body: 'Jean Dupont indique avoir effectué un don de CHF 5.00.', createdAt: new Date().toISOString(), link })
    await page.route('**/api/notifications', route => route.fulfill({ json: [
      notification('legacy-donation', 'donation_declared', { view: 'tasks', taskId: 'bad' }),
      notification('unknown-notification', 'future_type', { view: 'tasks', taskId: 'bad' }),
      notification('existing-task', 'task_assigned', { view: 'tasks' }),
    ] }))
    await page.reload()
    await page.locator('aside nav').getByRole('button', { name: /^Notifications/ }).click()
    await page.getByRole('button').filter({ hasText: 'legacy-donation' }).click()
    await dialog.getByText('Jean Dupont indique avoir effectué un don de CHF 5.00.').waitFor()
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
    taskCalls.length = 0
    await page.getByRole('button').filter({ hasText: 'unknown-notification' }).click()
    await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor()
    assert.deepEqual(taskCalls, [])
    await page.getByRole('button').filter({ hasText: 'existing-task' }).click()
    await page.getByRole('heading', { name: 'Tâches', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS donation click/read/detail, legacy data, no task call, unknown type and existing task navigation')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
