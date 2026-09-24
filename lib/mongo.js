import { MongoClient } from 'mongodb'

let connectionPromise

// All requests await the same initialization. A failure never poisons later attempts.
export async function getDb() {
  if (!connectionPromise) {
    const uri = process.env.MONGO_URL
    const name = process.env.DB_NAME
    if (!uri || !name) throw new Error('MONGO_URL and DB_NAME must be configured')
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 10000,
      maxPoolSize: 20,
      waitQueueTimeoutMS: 8000,
    })
    connectionPromise = client.connect().then(() => client.db(name)).catch(async error => {
      connectionPromise = undefined
      await client.close().catch(() => {})
      throw error
    })
  }
  return connectionPromise
}
