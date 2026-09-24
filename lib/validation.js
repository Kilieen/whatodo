// Small shared boundary checks; errors become explicit client errors in the API.
export function invalid(message) { const error = new Error(message); error.status = 400; throw error }
export function text(value, name, max = 300, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid(`${name} invalide (max. ${max} caractères)`)
  return value.trim()
}
export function id(value, name = 'Identifiant') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) invalid(`${name} invalide`)
  return value
}
export function ids(value, name = 'Membres') {
  if (!Array.isArray(value) || value.length > 200) invalid(`${name} doit être une liste de 200 identifiants maximum`)
  return [...new Set(value.map(v => id(v, name)))]
}
export function date(value, name = 'Date') {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(new Date(value).getTime())) invalid(`${name} invalide`)
  return new Date(value)
}
export async function workspaceGroup(db, workspaceId, groupId) {
  id(groupId, 'Groupe')
  const group = await db.collection('groups').findOne({ id: groupId, workspaceId })
  if (!group) invalid('Groupe introuvable dans cet espace')
  return group
}
export async function workspaceUsers(db, workspaceId, values) {
  const userIds = ids(values)
  const members = await db.collection('workspace_members').find({ workspaceId, status: 'active', userId: { $in: userIds } }).toArray()
  if (members.length !== userIds.length) invalid('Les membres doivent être actifs dans cet espace')
  return members
}
export async function taskInput(db, workspaceId, body, previous = {}) {
  for (const [key, max] of [['title', 160], ['description', 10000]]) if (key in body) text(body[key], key, max, key === 'title')
  if ('status' in body && !['todo', 'in_progress', 'review', 'blocked', 'done'].includes(body.status)) invalid('Statut invalide')
  if ('priority' in body && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) invalid('Priorité invalide')
  if ('proofRequired' in body && typeof body.proofRequired !== 'boolean') invalid('Preuve requise invalide')
  if ('assignees' in body) await workspaceUsers(db, workspaceId, body.assignees)
  if ('groupId' in body && body.groupId !== null) await workspaceGroup(db, workspaceId, body.groupId)
  for (const key of ['startDate', 'dueDate']) if (key in body) date(body[key], key)
  const start = body.startDate || previous.startDate
  const end = body.dueDate || previous.dueDate
  if (start && end && new Date(start) > new Date(end)) invalid('Date de début après date de fin')
}

// One source of truth: active workspace memberships. Rebuild the legacy display list.
export async function syncGroups(db, workspaceId) {
  const members = await db.collection('workspace_members').find({ workspaceId, status: 'active' }).toArray()
  const groups = await db.collection('groups').find({ workspaceId }).toArray()
  for (const group of groups) {
    const current = members.filter(m => m.groupId === group.id)
    const leader = current.find(m => m.userId === group.leaderId && ['leader', 'owner', 'admin'].includes(m.role))
    await db.collection('groups').updateOne({ id: group.id, workspaceId }, { $set: { memberIds: current.map(m => m.userId), leaderId: leader ? leader.userId : null } })
  }
}
