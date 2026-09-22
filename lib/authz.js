import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const SECRET = process.env.JWT_SECRET || 'dev_secret'

export function signToken(payload) { return jwt.sign(payload, SECRET, { expiresIn: '30d' }) }
export function verifyToken(token) { try { return jwt.verify(token, SECRET) } catch { return null } }
export async function hashPassword(pw) { return bcrypt.hash(pw, 10) }
export async function comparePassword(pw, hash) { return bcrypt.compare(pw, hash) }

export function getBearer(request) {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function requireUser(request, db) {
  const token = getBearer(request)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.uid) return null
  const user = await db.collection('users').findOne({ id: payload.uid })
  if (!user) return null
  const { passwordHash, _id, ...safe } = user
  return safe
}

/** Get active workspace membership for a user based on X-Workspace-Id header. */
export async function requireWorkspace(request, db, user) {
  if (!user) return null
  const wid = request.headers.get('x-workspace-id')
  if (!wid) return null
  const member = await db.collection('workspace_members').findOne({ workspaceId: wid, userId: user.id })
  if (!member) return null
  const workspace = await db.collection('workspaces').findOne({ id: wid })
  if (!workspace) return null
  return { workspace, member }
}

export function canManageWorkspace(role) { return role === 'owner' || role === 'admin' }

export function canManageGroupTasks(member, group) {
  if (!member) return false
  if (member.role === 'owner' || member.role === 'admin') return true
  if (member.role === 'leader' && group?.leaderId === member.userId) return true
  return false
}

export function canViewTask(member, task) {
  if (!member) return false
  if (['owner','admin','teacher'].includes(member.role)) return true
  if (task.groupId === member.groupId) return true
  if (task.assignees?.includes(member.userId)) return true
  return false
}
