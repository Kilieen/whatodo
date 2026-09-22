// Wipe ALL demo/test data. Whatodo will start as a brand-new empty app.
// A backup MUST be created first (scripts/backup.js runs automatically).
// Usage: node scripts/wipe-demo.js
const fs = require('fs')
const path = require('path')
try {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
} catch {}
const { MongoClient } = require('mongodb')
const { spawnSync } = require('child_process')

const COLLECTIONS = [
  'users', 'workspaces', 'workspace_members', 'groups', 'tasks',
  'channels', 'messages', 'channel_reads', 'notifications',
  'invitations', 'audit_log', 'password_resets'
]

async function main() {
  // 1. Backup first — safety net
  console.log('→ Running backup first...')
  const r = spawnSync('node', [path.join(__dirname, 'backup.js')], { stdio: 'inherit' })
  if (r.status !== 0) { console.error('Backup failed, aborting wipe.'); process.exit(1) }

  const uri = process.env.MONGO_URL
  const dbName = process.env.DB_NAME || 'epco_hub'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  console.log('\n→ Wiping demo/test data...')
  for (const name of COLLECTIONS) {
    try {
      const res = await db.collection(name).deleteMany({})
      console.log(`  ✓ ${name}: ${res.deletedCount} docs removed`)
    } catch (e) { console.log(`  · ${name}: skipped (${e.message})`) }
  }

  console.log('\n✅ Whatodo is now a clean, empty application.')
  console.log('   Users, workspaces, tasks, messages, notifications — all cleared.')
  console.log('   The first user to register will start from zero.')
  await client.close()
}
main().catch(e => { console.error(e); process.exit(1) })
