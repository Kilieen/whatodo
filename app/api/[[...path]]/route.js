import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import {
  signToken, comparePassword, hashPassword,
  requireUser, requireWorkspace,
  canManageWorkspace, canManageGroupTasks, canViewTask
} from '@/lib/authz'
import { ensureSeedAndMigration, makeInviteCode } from '@/lib/seed'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-Id')
  return res
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function json(data, status = 200) { return cors(NextResponse.json(data, { status })) }
function err(m, s = 400) { return json({ error: m }, s) }

function strip(obj) { if (!obj) return obj; const { _id, passwordHash, ...rest } = obj; return rest }
function cleanArr(arr) { return (arr || []).map(strip) }

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = '/' + path.join('/')
  const method = request.method
  const db = await getDb()
  await ensureSeedAndMigration(db)

  try {
    // ============ AUTH ============
    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const user = await db.collection('users').findOne({ email: (body.email || '').toLowerCase().trim() })
      if (!user) return err('Identifiants invalides', 401)
      const ok = await comparePassword(body.password || '', user.passwordHash)
      if (!ok) return err('Identifiants invalides', 401)
      const token = signToken({ uid: user.id })
      return json({ token, user: strip(user) })
    }

    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      if (!email || !body.password || !body.firstName) return err('Champs requis manquants', 400)
      const exists = await db.collection('users').findOne({ email })
      if (exists) return err('Un compte existe déjà avec cet email', 400)
      const passwordHash = await hashPassword(body.password)
      const user = {
        id: uuidv4(), email, passwordHash,
        firstName: body.firstName, lastName: body.lastName || '',
        avatarColor: '#3a5375',
        createdAt: new Date(),
        role: 'student', groupId: null,
      }
      await db.collection('users').insertOne(user)
      const token = signToken({ uid: user.id })
      return json({ token, user: strip(user) })
    }

    if (route === '/auth/me' && method === 'GET') {
      const user = await requireUser(request, db)
      if (!user) return err('Non authentifié', 401)
      // list workspaces
      const memberships = await db.collection('workspace_members').find({ userId: user.id, status: 'active' }).toArray()
      const wids = memberships.map(m => m.workspaceId)
      const wsList = wids.length ? await db.collection('workspaces').find({ id: { $in: wids } }).toArray() : []
      const wsById = Object.fromEntries(wsList.map(w => [w.id, w]))
      const workspaces = memberships.map(m => ({
        ...strip(wsById[m.workspaceId]),
        myRole: m.role,
        myGroupId: m.groupId,
      })).filter(w => w.id)
      return json({ user, workspaces })
    }

    if (route === '/auth/users-list' && method === 'GET') {
      const users = await db.collection('users').find({}).sort({ firstName: 1 }).toArray()
      return json(users.map(u => ({ email: u.email, firstName: u.firstName, role: u.role })))
    }

    // ============ WORKSPACES ============
    if (route === '/workspaces' && method === 'GET') {
      const user = await requireUser(request, db)
      if (!user) return err('Non authentifié', 401)
      const memberships = await db.collection('workspace_members').find({ userId: user.id, status: 'active' }).toArray()
      const wids = memberships.map(m => m.workspaceId)
      const wsList = wids.length ? await db.collection('workspaces').find({ id: { $in: wids } }).toArray() : []
      const wsById = Object.fromEntries(wsList.map(w => [w.id, w]))
      const workspaces = await Promise.all(memberships.map(async m => {
        const w = wsById[m.workspaceId]
        if (!w) return null
        const memberCount = await db.collection('workspace_members').countDocuments({ workspaceId: w.id, status: 'active' })
        return { ...strip(w), myRole: m.role, myGroupId: m.groupId, memberCount }
      }))
      return json(workspaces.filter(Boolean))
    }

    if (route === '/workspaces' && method === 'POST') {
      const user = await requireUser(request, db)
      if (!user) return err('Non authentifié', 401)
      const body = await request.json()
      if (!body.name) return err('Nom requis', 400)
      const wid = uuidv4()
      const workspace = {
        id: wid,
        name: body.name,
        description: body.description || '',
        icon: body.icon || (body.name[0] || 'W').toUpperCase(),
        color: body.color || '#3b82f6',
        ownerId: user.id,
        inviteCode: makeInviteCode(body.name.split(' ')[0].toUpperCase().slice(0, 6) || 'WT'),
        createdAt: new Date(), updatedAt: new Date(),
      }
      await db.collection('workspaces').insertOne(workspace)
      await db.collection('workspace_members').insertOne({
        id: uuidv4(), workspaceId: wid, userId: user.id,
        role: 'owner', groupId: null, status: 'active', joinedAt: new Date(),
      })
      return json({ ...strip(workspace), myRole: 'owner', myGroupId: null, memberCount: 1 })
    }

    if (route === '/workspaces/join' && method === 'POST') {
      const user = await requireUser(request, db)
      if (!user) return err('Non authentifié', 401)
      const body = await request.json()
      const code = (body.inviteCode || '').trim().toUpperCase()
      if (!code) return err('Code requis', 400)
      const workspace = await db.collection('workspaces').findOne({ inviteCode: code })
      if (!workspace) return err('Code invalide', 404)
      const existing = await db.collection('workspace_members').findOne({ workspaceId: workspace.id, userId: user.id })
      if (existing) {
        if (existing.status !== 'active') {
          await db.collection('workspace_members').updateOne({ id: existing.id }, { $set: { status: 'active' } })
        }
        return json({ workspace: strip(workspace), rejoined: true })
      }
      await db.collection('workspace_members').insertOne({
        id: uuidv4(), workspaceId: workspace.id, userId: user.id,
        role: 'member', groupId: null, status: 'active', joinedAt: new Date(),
      })
      return json({ workspace: strip(workspace), joined: true })
    }

    // ============ ALL FOLLOWING ROUTES REQUIRE WORKSPACE ============
    const user = await requireUser(request, db)
    if (!user) return err('Non authentifié', 401)
    const ws = await requireWorkspace(request, db, user)
    if (!ws) return err('Workspace inaccessible', 403)
    const { workspace, member } = ws

    // ============ WORKSPACE DETAILS / MEMBERS ============
    if (route === '/workspace' && method === 'GET') {
      const members = await db.collection('workspace_members').find({ workspaceId: workspace.id, status: 'active' }).toArray()
      const userIds = members.map(m => m.userId)
      const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
      const usersById = Object.fromEntries(users.map(u => [u.id, strip(u)]))
      return json({
        ...strip(workspace),
        myRole: member.role, myGroupId: member.groupId,
        members: members.map(m => ({ ...m, user: usersById[m.userId] })),
      })
    }

    if (route === '/workspace/regenerate-code' && method === 'POST') {
      if (!canManageWorkspace(member.role)) return err('Non autorisé', 403)
      const newCode = makeInviteCode(workspace.name.split(' ')[0].toUpperCase().slice(0, 6) || 'WT')
      await db.collection('workspaces').updateOne({ id: workspace.id }, { $set: { inviteCode: newCode } })
      return json({ inviteCode: newCode })
    }

    // ============ MEMBERS MANAGEMENT ============
    if (route === '/workspace/members' && method === 'GET') {
      const members = await db.collection('workspace_members').find({ workspaceId: workspace.id }).toArray()
      const userIds = members.map(m => m.userId)
      const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
      const usersById = Object.fromEntries(users.map(u => [u.id, strip(u)]))
      const groups = await db.collection('groups').find({ workspaceId: workspace.id }).toArray()
      const groupsById = Object.fromEntries(groups.map(g => [g.id, { id: g.id, name: g.name }]))
      return json(members.map(m => ({
        ...m, _id: undefined,
        user: usersById[m.userId] || null,
        group: m.groupId ? groupsById[m.groupId] : null,
      })))
    }

    const memMatch = route.match(/^\/workspace\/members\/([^/]+)$/)
    if (memMatch && method === 'PATCH') {
      if (!canManageWorkspace(member.role)) return err('Non autorisé', 403)
      const memberId = memMatch[1]
      const target = await db.collection('workspace_members').findOne({ id: memberId, workspaceId: workspace.id })
      if (!target) return err('Membre introuvable', 404)
      // Cannot demote yourself if you're the only owner
      const body = await request.json()
      const update = {}
      if ('role' in body) {
        if (['owner','admin','leader','member','teacher','viewer'].includes(body.role)) update.role = body.role
        // Protect last owner
        if (target.role === 'owner' && body.role !== 'owner') {
          const owners = await db.collection('workspace_members').countDocuments({ workspaceId: workspace.id, role: 'owner', status: 'active' })
          if (owners <= 1) return err('Impossible de rétrograder le dernier owner', 400)
        }
      }
      if ('groupId' in body) {
        if (body.groupId === null || body.groupId === '') update.groupId = null
        else {
          const g = await db.collection('groups').findOne({ id: body.groupId, workspaceId: workspace.id })
          if (!g) return err('Groupe introuvable', 404)
          update.groupId = body.groupId
        }
      }
      if ('status' in body && ['active','inactive'].includes(body.status)) update.status = body.status
      await db.collection('workspace_members').updateOne({ id: memberId }, { $set: update })
      // If groupId changed, also sync legacy groups.memberIds and leaderId if role becomes leader
      if ('groupId' in update) {
        // remove from all groups memberIds in this workspace, then add to new
        await db.collection('groups').updateMany({ workspaceId: workspace.id, memberIds: target.userId }, { $pull: { memberIds: target.userId } })
        if (update.groupId) {
          await db.collection('groups').updateOne({ id: update.groupId }, { $addToSet: { memberIds: target.userId } })
        }
      }
      if (update.role === 'leader' && (update.groupId || target.groupId)) {
        const gid = update.groupId || target.groupId
        await db.collection('groups').updateOne({ id: gid }, { $set: { leaderId: target.userId } })
      }
      return json({ ok: true })
    }
    if (memMatch && method === 'DELETE') {
      if (!canManageWorkspace(member.role)) return err('Non autorisé', 403)
      const memberId = memMatch[1]
      const target = await db.collection('workspace_members').findOne({ id: memberId, workspaceId: workspace.id })
      if (!target) return err('Membre introuvable', 404)
      if (target.role === 'owner') {
        const owners = await db.collection('workspace_members').countDocuments({ workspaceId: workspace.id, role: 'owner', status: 'active' })
        if (owners <= 1) return err('Impossible de retirer le dernier owner', 400)
      }
      await db.collection('workspace_members').deleteOne({ id: memberId })
      await db.collection('groups').updateMany({ workspaceId: workspace.id }, { $pull: { memberIds: target.userId } })
      return json({ ok: true })
    }

    // ============ USERS (workspace-scoped) ============
    if (route === '/users' && method === 'GET') {
      const members = await db.collection('workspace_members').find({ workspaceId: workspace.id, status: 'active' }).toArray()
      const userIds = members.map(m => m.userId)
      const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
      const memberByUserId = Object.fromEntries(members.map(m => [m.userId, m]))
      return json(users.map(u => ({ ...strip(u), workspaceRole: memberByUserId[u.id]?.role, workspaceGroupId: memberByUserId[u.id]?.groupId })))
    }

    // ============ GROUPS ============
    if (route === '/groups' && method === 'GET') {
      const groups = await db.collection('groups').find({ workspaceId: workspace.id }).toArray()
      const wsMembers = await db.collection('workspace_members').find({ workspaceId: workspace.id }).toArray()
      const userIds = [...new Set(wsMembers.map(m => m.userId))]
      const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
      const usersById = Object.fromEntries(users.map(u => [u.id, strip(u)]))
      return json(groups.map(g => {
        const { _id, ...rest } = g
        return {
          ...rest,
          leader: g.leaderId ? usersById[g.leaderId] : null,
          members: (g.memberIds || []).map(id => usersById[id]).filter(Boolean),
        }
      }))
    }

    if (route === '/groups' && method === 'POST') {
      if (!canManageWorkspace(member.role)) return err('Non autorisé', 403)
      const body = await request.json()
      const group = {
        id: uuidv4(), workspaceId: workspace.id, name: body.name || 'Nouveau groupe',
        leaderId: body.leaderId || null, memberIds: body.memberIds || [],
        description: body.description || '', createdAt: new Date(),
      }
      await db.collection('groups').insertOne(group)
      return json(strip(group))
    }

    if (route.startsWith('/groups/') && method === 'GET') {
      const groupId = route.split('/')[2]
      const g = await db.collection('groups').findOne({ id: groupId, workspaceId: workspace.id })
      if (!g) return err('Groupe introuvable', 404)
      const users = await db.collection('users').find({ id: { $in: g.memberIds || [] } }).toArray()
      const leader = users.find(u => u.id === g.leaderId)
      const tasks = await db.collection('tasks').find({ groupId, workspaceId: workspace.id }).toArray()
      const { _id, ...rest } = g
      return json({
        ...rest, leader: strip(leader),
        members: users.map(strip),
        tasks: cleanArr(tasks),
      })
    }

    // ============ TASKS ============
    if (route === '/tasks' && method === 'GET') {
      const url = new URL(request.url)
      const scope = url.searchParams.get('scope') || 'visible'
      let query = { workspaceId: workspace.id }
      const priv = ['owner','admin','teacher'].includes(member.role)
      if (priv) {
        if (scope === 'mine') query.assignees = user.id
        if (scope === 'group' && member.groupId) query.groupId = member.groupId
      } else {
        if (scope === 'mine') query.assignees = user.id
        else if (scope === 'group') query.groupId = member.groupId
        else query.$or = [{ groupId: member.groupId }, { assignees: user.id }]
      }
      const tasks = await db.collection('tasks').find(query).sort({ dueDate: 1 }).toArray()
      return json(cleanArr(tasks))
    }

    if (route === '/tasks' && method === 'POST') {
      const body = await request.json()
      const groupId = body.groupId || member.groupId
      if (!groupId) return err('Groupe requis', 400)
      const group = await db.collection('groups').findOne({ id: groupId, workspaceId: workspace.id })
      if (!group) return err('Groupe introuvable', 404)
      const isPriv = ['owner','admin'].includes(member.role)
      const isLeader = member.role === 'leader' && group.leaderId === user.id
      const isMember = (group.memberIds || []).includes(user.id)
      if (!isPriv && !isLeader && !isMember) return err('Non autorisé', 403)
      const task = {
        id: uuidv4(), workspaceId: workspace.id,
        title: body.title || 'Nouvelle tâche', description: body.description || '',
        groupId, createdBy: user.id,
        assignees: body.assignees?.length ? body.assignees : [user.id],
        priority: body.priority || 'medium', status: body.status || 'todo',
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 86400000),
        proofRequired: !!body.proofRequired, proofs: [], comments: [],
        history: [{ userId: user.id, action: 'created', at: new Date() }],
        createdAt: new Date(), updatedAt: new Date(),
      }
      await db.collection('tasks').insertOne(task)
      return json(strip(task))
    }

    const taskIdMatch = route.match(/^\/tasks\/([^/]+)(?:\/([^/]+))?$/)
    if (taskIdMatch) {
      const taskId = taskIdMatch[1]
      const sub = taskIdMatch[2]
      const task = await db.collection('tasks').findOne({ id: taskId, workspaceId: workspace.id })
      if (!task) return err('Tâche introuvable', 404)
      const group = await db.collection('groups').findOne({ id: task.groupId, workspaceId: workspace.id })
      const canManage = canManageGroupTasks({ ...member, userId: user.id }, group)
      const isAssignee = task.assignees?.includes(user.id)

      if (!sub && method === 'GET') {
        if (!canViewTask({ ...member, userId: user.id }, task)) return err('Non autorisé', 403)
        return json(strip(task))
      }
      if (!sub && method === 'PATCH') {
        if (!canManage && !isAssignee) return err('Non autorisé', 403)
        const body = await request.json()
        const allowed = {}
        const memberFields = ['status']
        const managerFields = ['title', 'description', 'assignees', 'priority', 'startDate', 'dueDate', 'proofRequired', 'groupId']
        for (const f of memberFields) if (f in body) allowed[f] = body[f]
        if (canManage) for (const f of managerFields) if (f in body) allowed[f] = body[f]
        if (allowed.startDate) allowed.startDate = new Date(allowed.startDate)
        if (allowed.dueDate) allowed.dueDate = new Date(allowed.dueDate)
        if (allowed.status === 'review' && task.proofRequired && (!task.proofs?.length)) {
          return err('Ajoute une preuve avant de demander la validation.', 400)
        }
        const history = task.history || []
        if (allowed.status && allowed.status !== task.status) {
          history.push({ userId: user.id, action: 'status_change', from: task.status, to: allowed.status, at: new Date() })
        }
        allowed.history = history
        allowed.updatedAt = new Date()
        await db.collection('tasks').updateOne({ id: taskId }, { $set: allowed })
        const updated = await db.collection('tasks').findOne({ id: taskId })
        return json(strip(updated))
      }
      if (!sub && method === 'DELETE') {
        if (!canManage) return err('Non autorisé', 403)
        await db.collection('tasks').deleteOne({ id: taskId })
        return json({ ok: true })
      }
      if (sub === 'comments' && method === 'POST') {
        if (!canViewTask({ ...member, userId: user.id }, task)) return err('Non autorisé', 403)
        const body = await request.json()
        const c = { id: uuidv4(), userId: user.id, userName: user.firstName, content: body.content || '', createdAt: new Date() }
        await db.collection('tasks').updateOne({ id: taskId }, { $push: { comments: c }, $set: { updatedAt: new Date() } })
        return json(c)
      }
      if (sub === 'proofs' && method === 'POST') {
        if (!canViewTask({ ...member, userId: user.id }, task)) return err('Non autorisé', 403)
        const body = await request.json()
        const proof = {
          id: uuidv4(), userId: user.id, userName: user.firstName,
          type: body.type || 'file', fileData: body.fileData || null, fileName: body.fileName || null,
          mimeType: body.mimeType || null, linkUrl: body.linkUrl || null, text: body.text || null,
          createdAt: new Date(),
        }
        await db.collection('tasks').updateOne({ id: taskId }, { $push: { proofs: proof }, $set: { updatedAt: new Date() } })
        return json(proof)
      }
      if (sub === 'validate' && method === 'POST') {
        if (!canManage) return err('Non autorisé', 403)
        const body = await request.json()
        const approved = !!body.approved
        const history = task.history || []
        history.push({ userId: user.id, action: approved ? 'validated' : 'rejected', comment: body.comment || '', at: new Date() })
        const update = {
          status: approved ? 'done' : 'in_progress',
          updatedAt: new Date(),
          validatedBy: approved ? user.id : task.validatedBy,
          validatedAt: approved ? new Date() : task.validatedAt,
          history,
        }
        if (!approved && body.comment) {
          const c = { id: uuidv4(), userId: user.id, userName: user.firstName, content: `❌ Correction demandée: ${body.comment}`, createdAt: new Date() }
          await db.collection('tasks').updateOne({ id: taskId }, { $push: { comments: c } })
        }
        await db.collection('tasks').updateOne({ id: taskId }, { $set: update })
        const updated = await db.collection('tasks').findOne({ id: taskId })
        return json(strip(updated))
      }
    }

    // ============ DASHBOARD ============
    if (route === '/dashboard' && method === 'GET') {
      const now = new Date()
      const myTasks = await db.collection('tasks').find({ assignees: user.id, workspaceId: workspace.id }).toArray()
      const groupTasks = member.groupId ? await db.collection('tasks').find({ groupId: member.groupId, workspaceId: workspace.id }).toArray() : []
      const countBy = (arr, s) => arr.filter(t => t.status === s).length
      const overdue = myTasks.filter(t => t.status !== 'done' && new Date(t.dueDate) < now).length
      const upcoming = [...myTasks].filter(t => t.status !== 'done').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 8)
      const activity = []
      for (const t of groupTasks) {
        for (const h of (t.history || []).slice(-3)) activity.push({ taskId: t.id, taskTitle: t.title, ...h })
      }
      activity.sort((a, b) => new Date(b.at) - new Date(a.at))
      const allUsers = await db.collection('users').find({}).toArray()
      const usersById = Object.fromEntries(allUsers.map(u => [u.id, u.firstName]))

      // Group info
      const group = member.groupId ? await db.collection('groups').findOne({ id: member.groupId }) : null
      const leader = group?.leaderId ? await db.collection('users').findOne({ id: group.leaderId }) : null

      return json({
        stats: {
          todo: countBy(myTasks, 'todo'),
          in_progress: countBy(myTasks, 'in_progress'),
          review: countBy(myTasks, 'review'),
          blocked: countBy(myTasks, 'blocked'),
          done: countBy(myTasks, 'done'),
          overdue, total: myTasks.length,
        },
        upcoming: cleanArr(upcoming),
        activity: activity.slice(0, 10).map(a => ({ ...a, userName: usersById[a.userId] || 'Utilisateur' })),
        calendarMarkers: myTasks.map(t => ({ date: t.dueDate, taskId: t.id, title: t.title, status: t.status })),
        group: group ? { id: group.id, name: group.name, leaderName: leader?.firstName || null } : null,
        role: member.role,
      })
    }

    // ============ VALIDATION QUEUE ============
    if (route === '/validation-queue' && method === 'GET') {
      let query = { status: 'review', workspaceId: workspace.id }
      if (member.role === 'leader') {
        const grp = await db.collection('groups').findOne({ leaderId: user.id, workspaceId: workspace.id })
        if (!grp) return json([])
        query.groupId = grp.id
      } else if (!canManageWorkspace(member.role) && member.role !== 'teacher') {
        return err('Non autorisé', 403)
      }
      const tasks = await db.collection('tasks').find(query).toArray()
      return json(cleanArr(tasks))
    }

    return err(`Route ${route} not found`, 404)
  } catch (e) {
    console.error('API error', e)
    return err('Erreur serveur: ' + e.message, 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
