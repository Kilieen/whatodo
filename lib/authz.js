import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// Fail-closed: refuse to start signing tokens with a fallback secret.
const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.error('[FATAL] JWT_SECRET is missing or shorter than 32 chars. Refusing to sign tokens.')
  throw new Error('JWT_SECRET must be a 32+ character string. Set it in your environment.')
}

// pv (password version) is stamped into the token; requireUser refuses a mismatch
// so a password change invalidates all previously-issued tokens.
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
  // Password version guard — invalidates old tokens after change-password.
  const currentPv = user.passwordVersion || 0
  const tokenPv = typeof payload.pv === 'number' ? payload.pv : 0
  if (tokenPv !== currentPv) return null
  const { passwordHash, _id, ...safe } = user
  return safe
}

/** Get active workspace membership for a user based on X-Workspace-Id header. */
export async function requireWorkspace(request, db, user) {
  if (!user) return null
  const wid = request.headers.get('x-workspace-id')
  if (!wid) return null
  const member = await db.collection('workspace_members').findOne({ workspaceId: wid, userId: user.id, status: 'active' })
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
  if (task.groupId && task.groupId === member.groupId) return true
  if (task.assignees?.includes(member.userId) || task.createdBy === member.userId) return true
  return false
}

// ---------------- Rate limiting (in-memory, per-IP) ----------------
// NOTE: in-memory only — fine for single-process dev/preview.
// On Vercel/serverless it should be replaced by a shared limiter (Redis/Upstash).
const buckets = new Map() // key => { count, resetAt }
export function rateLimit(key, { max = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, resetAt: now + windowMs }
  }
  if (b.count >= max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count += 1
  return { ok: true, remaining: max - b.count, resetAt: b.resetAt }
}
export function getClientIp(request) {
  const h = request.headers
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') || h.get('cf-connecting-ip') || 'unknown'
}

// ---------------- Upload validation ----------------
// Whatodo stores images as data-URLs (base64). Enforce size and MIME server-side.
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const FILE_MIMES = [...IMAGE_MIMES, 'application/pdf']
export function validateDataUrl(dataUrl, { maxBytes, allowedMimes }) {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Format de fichier invalide' }
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return { ok: false, error: 'Format de fichier invalide (data-URL attendu)' }
  const mime = m[1].toLowerCase()
  const b64 = m[2]
  if (!allowedMimes.includes(mime)) return { ok: false, error: `Type de fichier non autorisé (${mime})` }
  // Base64: 4 chars => 3 bytes; deduct padding
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
  const size = (b64.length * 3) / 4 - padding
  if (size > maxBytes) return { ok: false, error: `Fichier trop volumineux (${Math.round(size/1024)} Ko, max ${Math.round(maxBytes/1024)} Ko)` }
  return { ok: true, mime, size }
}
export const UPLOAD_LIMITS = {
  avatar: { maxBytes: 500 * 1024, allowedMimes: IMAGE_MIMES },       // 500 KB
  workspaceLogo: { maxBytes: 500 * 1024, allowedMimes: IMAGE_MIMES }, // 500 KB
  taskProof: { maxBytes: 2 * 1024 * 1024, allowedMimes: FILE_MIMES }, // 2 MB
}

export function canViewGroup(member, group) {
  return ['owner', 'admin', 'teacher'].includes(member.role) || member.groupId === group.id
}

export function canReadChannel(member, channel) {
  if (['owner', 'admin'].includes(member.role)) return true
  if (channel.type === 'workspace') return true
  if (channel.type === 'leaders') return member.role === 'leader'
  if (channel.type === 'group') return !!member.groupId && channel.groupId === member.groupId
  return channel.type === 'private' && channel.memberIds?.includes(member.userId)
}
