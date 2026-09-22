import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const SECRET = process.env.JWT_SECRET || 'dev_secret'

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET) } catch { return null }
}

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

export function canManageTask(user, task, group) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'leader' && group && group.leaderId === user.id) return true
  return false
}

export function canViewTask(user, task) {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'teacher') return true
  if (task.groupId === user.groupId) return true
  if (task.assignees?.includes(user.id)) return true
  return false
}
