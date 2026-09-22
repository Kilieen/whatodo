// Whatodo used to auto-seed EPCO demo data. That is now GONE.
// This file only exposes helpers used when a real user creates a workspace.

import { v4 as uuidv4 } from 'uuid'

export function makeInviteCode(base = 'WHATODO') {
  const clean = (base || 'WHATODO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'WT'
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${clean}-${rand}`
}

// Create the two default channels for a newly-created workspace.
// #general: everyone in the workspace
// #leaders: owners/admins/leaders private channel
export async function ensureDefaultChannels(db, workspaceId, groups = []) {
  const existing = await db.collection('channels').countDocuments({ workspaceId })
  if (existing > 0) return
  const now = new Date()
  const docs = [
    { id: uuidv4(), workspaceId, name: 'general', type: 'workspace', description: 'Discussion générale', createdAt: now },
    { id: uuidv4(), workspaceId, name: 'chefs', type: 'leaders', description: 'Échanges entre chefs et admins', createdAt: now },
  ]
  for (const g of groups) {
    const slug = (g.name || 'groupe').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    docs.push({ id: uuidv4(), workspaceId, name: slug, type: 'group', description: `Channel du groupe ${g.name}`, groupId: g.id, createdAt: now })
  }
  await db.collection('channels').insertMany(docs)
}

// Audit log helper — used for owner/admin traceability.
export async function audit(db, { workspaceId, actorId, action, target, meta }) {
  try {
    await db.collection('audit_log').insertOne({
      id: uuidv4(),
      workspaceId: workspaceId || null,
      actorId: actorId || null,
      action,
      target: target || null,
      meta: meta || null,
      createdAt: new Date(),
    })
  } catch { /* silent — audit must never break a request */ }
}
