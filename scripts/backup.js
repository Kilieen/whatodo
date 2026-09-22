// Backup all Mongo collections into a timestamped JSON file.
// Usage: node scripts/backup.js
const fs = require('fs')
const path = require('path')
// Minimal .env loader (avoids extra dependency)
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

async function main() {
  const uri = process.env.MONGO_URL
  const dbName = process.env.DB_NAME || 'epco_hub'
  if (!uri) { console.error('MONGO_URL missing'); process.exit(1) }
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const cols = await db.listCollections().toArray()
  const dump = { _meta: { at: new Date().toISOString(), dbName, count: cols.length } }
  for (const c of cols) {
    dump[c.name] = await db.collection(c.name).find({}).toArray()
    console.log(`  ✓ ${c.name}: ${dump[c.name].length} docs`)
  }
  const dir = path.join(__dirname, '..', 'backup')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outfile = path.join(dir, `mongo-${dbName}-${stamp}.json`)
  fs.writeFileSync(outfile, JSON.stringify(dump, null, 2))
  console.log(`\n✅ Backup written to ${outfile}`)
  await client.close()
}
main().catch(e => { console.error(e); process.exit(1) })
