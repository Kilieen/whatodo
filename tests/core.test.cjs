const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
function mongoContext(MongoClient) {
  const code = fs.readFileSync('lib/mongo.js', 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
  const ctx = vm.createContext({ MongoClient, process: { env: { MONGO_URL: 'mongodb://localhost/mock', DB_NAME: 'mock' } } })
  vm.runInContext(code, ctx)
  return ctx
}
test('Mongo initialization is shared by simultaneous requests', async () => {
  let release, connections = 0
  const gate = new Promise(resolve => { release = resolve })
  const db = { connected: true }
  const ctx = mongoContext(class { async connect() { connections++; await gate; return this } db() { return db } })
  const calls = Array.from({ length: 20 }, () => ctx.getDb())
  assert.equal(connections, 1)
  release()
  for (const value of await Promise.all(calls)) assert.equal(value, db)
})
test('Mongo can recover after its first initialization fails', async () => {
  let attempts = 0, closed = 0
  const ctx = mongoContext(class { async connect() { if (++attempts === 1) throw Error('temporary'); return this } async close() { closed++ } db() { return 'recovered' } })
  await assert.rejects(ctx.getDb(), /temporary/)
  assert.equal(await ctx.getDb(), 'recovered'); assert.equal(attempts, 2); assert.equal(closed, 1)
})
test('client session handling distinguishes network, auth and workspace errors', async () => {
  const values = new Map([['whatodo_token', 'valid'], ['whatodo_workspace', 'workspace']])
  const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  const events = []
  const ctx = vm.createContext({ localStorage: storage, window: { dispatchEvent: event => events.push(event.type) }, Event, AbortController, setTimeout, clearTimeout, Error, TypeError })
  vm.runInContext(fs.readFileSync('lib/api-client.js', 'utf8').replace(/export /g, ''), ctx)
  ctx.fetch = async () => { throw new TypeError('network') }
  await assert.rejects(ctx.apiFetch('/auth/me'), /session est conservée/)
  assert.equal(storage.getItem('whatodo_token'), 'valid'); assert.equal(events.length, 0)
  ctx.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) })
  await assert.rejects(ctx.apiFetch('/auth/me')); assert.equal(events.length, 0)
  ctx.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) })
  await assert.rejects(ctx.apiFetch('/groups')); assert.equal(events.length, 0)
  ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) })
  await assert.rejects(ctx.apiFetch('/auth/me')); assert.deepEqual(events, ['whatodo:session-expired'])
  ctx.fetch = async () => ({ ok: true, json: async () => ({ token: 'renewed' }) })
  await ctx.apiFetch('/auth/change-password', { method: 'POST' }); assert.equal(storage.getItem('whatodo_token'), 'renewed')
  ctx.fetch = async () => ({ ok: true, json: async () => ({ token: 'reset' }) })
  await ctx.apiFetch('/auth/reset-password', { method: 'POST' }); assert.equal(storage.getItem('whatodo_token'), 'reset')
})
test('concurrent identical GET requests share a fetch; mutations are never deduplicated', async () => {
  let release, calls = 0
  const gate = new Promise(resolve => { release = resolve })
  const ctx = vm.createContext({ localStorage: { getItem: () => null }, window: {}, AbortController, setTimeout, clearTimeout, fetch: async () => { calls++; await gate; return { ok: true, json: async () => [] } } })
  vm.runInContext(fs.readFileSync('lib/api-client.js', 'utf8').replace(/export /g, ''), ctx)
  const reads = [ctx.apiFetch('/groups'), ctx.apiFetch('/groups')]
  assert.equal(calls, 1); release(); await Promise.all(reads)
  await Promise.all([ctx.apiFetch('/groups', { method: 'POST' }), ctx.apiFetch('/groups', { method: 'POST' })])
  assert.equal(calls, 3)
})
test('service worker purges only Whatodo caches, never intercepts API, and falls back offline', async () => {
  const handlers = {}, deleted = []
  let claimed = false
  const ctx = vm.createContext({
    self: { addEventListener: (name, fn) => { handlers[name] = fn }, skipWaiting() {}, clients: { claim: async () => { claimed = true } } },
    caches: { keys: async () => ['whatodo-v1', 'whatodo-v2', 'another-app'], delete: async key => { deleted.push(key) } },
    fetch: async () => { throw Error('offline') }, Response,
  })
  vm.runInContext(fs.readFileSync('public/sw.js', 'utf8'), ctx)
  let completion
  handlers.activate({ waitUntil: promise => { completion = promise } }); await completion
  assert.deepEqual(deleted, ['whatodo-v1', 'whatodo-v2']); assert.equal(claimed, true)
  handlers.fetch({ request: { mode: 'cors', url: 'https://example.test/api/tasks' }, respondWith() { assert.fail('API must not be intercepted') } })
  let response
  handlers.fetch({ request: { mode: 'navigate' }, respondWith: promise => { response = promise } })
  response = await response; assert.equal(response.status, 503); assert.match(await response.text(), /session est conservée/)
  ctx.fetch = async () => new Response('fresh deployment')
  handlers.fetch({ request: { mode: 'navigate' }, respondWith: promise => { response = promise } })
  assert.equal(await (await response).text(), 'fresh deployment')
})
