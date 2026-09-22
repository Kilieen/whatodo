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

async function createNotification(db, { workspaceId, userId, type, title, body, link }) {
  if (!userId) return
  await db.collection('notifications').insertOne({
    id: uuidv4(), workspaceId, userId, type,
    title: title || '', body: body || '',
    link: link || null, read: false, createdAt: new Date(),
  })
}

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
      const tasks = await db.collection('tasks').find({ groupId, workspaceId: workspace.id, deletedAt: { $exists: false } }).toArray()
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
      const trash = url.searchParams.get('trash') === '1'
      let query = { workspaceId: workspace.id }
      if (trash) {
        if (!['owner','admin'].includes(member.role)) return err('Non autorisé', 403)
        query.deletedAt = { $exists: true }
      } else {
        query.deletedAt = { $exists: false }
      }
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
      // notify assignees
      for (const uid of task.assignees) {
        if (uid !== user.id) {
          await createNotification(db, {
            workspaceId: workspace.id, userId: uid, type: 'task_assigned',
            title: `Nouvelle tâche · ${task.title}`,
            body: `${user.firstName} vous a assigné une tâche`,
            link: { view: 'tasks', taskId: task.id },
          })
        }
      }
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
        // Notifications on relevant changes
        if (allowed.status === 'review') {
          // notify leader / manager
          if (group?.leaderId && group.leaderId !== user.id) {
            await createNotification(db, {
              workspaceId: workspace.id, userId: group.leaderId, type: 'validation_requested',
              title: `Validation demandée · ${task.title}`,
              body: `${user.firstName} a demandé la validation`,
              link: { view: 'validation', taskId: task.id },
            })
          }
        }
        if (allowed.assignees) {
          const added = allowed.assignees.filter(uid => !(task.assignees || []).includes(uid) && uid !== user.id)
          for (const uid of added) {
            await createNotification(db, {
              workspaceId: workspace.id, userId: uid, type: 'task_assigned',
              title: `Vous avez été assigné · ${task.title}`,
              body: `Par ${user.firstName}`,
              link: { view: 'tasks', taskId: task.id },
            })
          }
        }
        return json(strip(updated))
      }
      if (!sub && method === 'DELETE') {
        // Permissions:
        // owner/admin → any task
        // leader of task's group → any task in that group
        // member → only own tasks (created by them)
        const isPriv = ['owner','admin'].includes(member.role)
        const isLeaderOfGroup = member.role === 'leader' && group?.leaderId === user.id
        const isCreator = task.createdBy === user.id
        if (!isPriv && !isLeaderOfGroup && !isCreator) return err('Non autorisé', 403)
        // Soft delete
        const history = task.history || []
        history.push({ userId: user.id, action: 'deleted', at: new Date() })
        await db.collection('tasks').updateOne({ id: taskId }, {
          $set: { deletedAt: new Date(), deletedBy: user.id, history, updatedAt: new Date() }
        })
        return json({ ok: true, softDeleted: true })
      }
      if (sub === 'restore' && method === 'POST') {
        const isPriv = ['owner','admin'].includes(member.role)
        if (!isPriv) return err('Non autorisé', 403)
        await db.collection('tasks').updateOne({ id: taskId }, {
          $set: { updatedAt: new Date() }, $unset: { deletedAt: '', deletedBy: '' }
        })
        return json({ ok: true, restored: true })
      }
      if (sub === 'comments' && method === 'POST') {
        if (!canViewTask({ ...member, userId: user.id }, task)) return err('Non autorisé', 403)
        const body = await request.json()
        const c = { id: uuidv4(), userId: user.id, userName: user.firstName, content: body.content || '', createdAt: new Date() }
        await db.collection('tasks').updateOne({ id: taskId }, { $push: { comments: c }, $set: { updatedAt: new Date() } })
        // notify assignees + creator (except self)
        const notifTargets = new Set([...(task.assignees || []), task.createdBy].filter(uid => uid && uid !== user.id))
        for (const uid of notifTargets) {
          await createNotification(db, {
            workspaceId: workspace.id, userId: uid, type: 'comment',
            title: `Nouveau commentaire · ${task.title}`,
            body: `${user.firstName}: ${c.content.slice(0, 100)}`,
            link: { view: 'tasks', taskId: task.id },
          })
        }
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
        // notify assignees
        for (const uid of (task.assignees || [])) {
          if (uid !== user.id) {
            await createNotification(db, {
              workspaceId: workspace.id, userId: uid,
              type: approved ? 'task_validated' : 'task_rejected',
              title: approved ? `Tâche validée · ${task.title}` : `Correction demandée · ${task.title}`,
              body: body.comment || '',
              link: { view: 'tasks', taskId: task.id },
            })
          }
        }
        return json(strip(updated))
      }
    }

    // ============ DASHBOARD ============
    if (route === '/dashboard' && method === 'GET') {
      const now = new Date()
      const myTasks = await db.collection('tasks').find({ assignees: user.id, workspaceId: workspace.id, deletedAt: { $exists: false } }).toArray()
      const groupTasks = member.groupId ? await db.collection('tasks').find({ groupId: member.groupId, workspaceId: workspace.id, deletedAt: { $exists: false } }).toArray() : []
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

    // ============ CALENDAR ============
    if (route === '/calendar' && method === 'GET') {
      const url = new URL(request.url)
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const scope = url.searchParams.get('scope') || 'group'
      let query = { workspaceId: workspace.id, deletedAt: { $exists: false } }
      if (from && to) query.dueDate = { $gte: new Date(from), $lte: new Date(to) }
      const priv = ['owner','admin','teacher'].includes(member.role)
      if (scope === 'mine') query.assignees = user.id
      else if (scope === 'group' && member.groupId && !priv) query.groupId = member.groupId
      else if (!priv && scope !== 'mine') query.$or = [{ groupId: member.groupId }, { assignees: user.id }]
      const tasks = await db.collection('tasks').find(query).toArray()
      return json(cleanArr(tasks))
    }

    // ============ CHANNELS & CHAT ============
    if (route === '/channels' && method === 'GET') {
      const chs = await db.collection('channels').find({ workspaceId: workspace.id }).toArray()
      const priv = ['owner','admin'].includes(member.role)
      const visible = chs.filter(c => {
        if (priv) return true
        if (c.type === 'workspace') return true
        if (c.type === 'leaders') return member.role === 'leader'
        if (c.type === 'group') return c.groupId === member.groupId
        return false
      })
      // enrich with unread count
      const enriched = await Promise.all(visible.map(async c => {
        const { _id, ...rest } = c
        const lastReadDoc = await db.collection('channel_reads').findOne({ channelId: c.id, userId: user.id })
        const lastReadAt = lastReadDoc?.lastReadAt || new Date(0)
        const unread = await db.collection('messages').countDocuments({ channelId: c.id, createdAt: { $gt: lastReadAt }, userId: { $ne: user.id } })
        return { ...rest, unread }
      }))
      return json(enriched)
    }

    const chMatch = route.match(/^\/channels\/([^/]+)\/messages$/)
    if (chMatch && method === 'GET') {
      const channelId = chMatch[1]
      const ch = await db.collection('channels').findOne({ id: channelId, workspaceId: workspace.id })
      if (!ch) return err('Channel introuvable', 404)
      const priv = ['owner','admin'].includes(member.role)
      const canRead = priv || ch.type === 'workspace' || (ch.type === 'leaders' && member.role === 'leader') || (ch.type === 'group' && ch.groupId === member.groupId)
      if (!canRead) return err('Non autorisé', 403)
      const url = new URL(request.url)
      const since = url.searchParams.get('since')
      const q = { channelId, workspaceId: workspace.id }
      if (since) q.createdAt = { $gt: new Date(since) }
      const messages = await db.collection('messages').find(q).sort({ createdAt: 1 }).limit(200).toArray()
      // mark as read
      await db.collection('channel_reads').updateOne(
        { channelId, userId: user.id },
        { $set: { channelId, userId: user.id, lastReadAt: new Date() } },
        { upsert: true }
      )
      return json(cleanArr(messages))
    }
    if (chMatch && method === 'POST') {
      const channelId = chMatch[1]
      const ch = await db.collection('channels').findOne({ id: channelId, workspaceId: workspace.id })
      if (!ch) return err('Channel introuvable', 404)
      const priv = ['owner','admin'].includes(member.role)
      const canWrite = priv || ch.type === 'workspace' || (ch.type === 'leaders' && member.role === 'leader') || (ch.type === 'group' && ch.groupId === member.groupId)
      if (!canWrite) return err('Non autorisé', 403)
      const body = await request.json()
      const msg = {
        id: uuidv4(), workspaceId: workspace.id, channelId,
        userId: user.id, userName: user.firstName,
        avatarColor: user.avatarColor,
        content: (body.content || '').slice(0, 4000),
        replyToId: body.replyToId || null,
        createdAt: new Date(),
      }
      await db.collection('messages').insertOne(msg)
      // extract @mentions and create notifications
      const mentions = (msg.content.match(/@\w+/g) || []).map(m => m.slice(1).toLowerCase())
      if (mentions.length) {
        const wsMembers = await db.collection('workspace_members').find({ workspaceId: workspace.id, status: 'active' }).toArray()
        const usersInWs = await db.collection('users').find({ id: { $in: wsMembers.map(m => m.userId) } }).toArray()
        for (const u of usersInWs) {
          if (mentions.includes(u.firstName.toLowerCase()) && u.id !== user.id) {
            await createNotification(db, {
              workspaceId: workspace.id, userId: u.id, type: 'mention',
              title: `${user.firstName} vous a mentionné`,
              body: msg.content.slice(0, 100),
              link: { view: 'chat', channelId },
            })
          }
        }
      }
      return json({ ...msg, _id: undefined })
    }

    // ============ NOTIFICATIONS ============
    if (route === '/notifications' && method === 'GET') {
      const notifs = await db.collection('notifications')
        .find({ userId: user.id, workspaceId: workspace.id })
        .sort({ createdAt: -1 }).limit(50).toArray()
      return json(cleanArr(notifs))
    }
    if (route === '/notifications/mark-read' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const q = { userId: user.id, workspaceId: workspace.id }
      if (body.id) q.id = body.id
      await db.collection('notifications').updateMany(q, { $set: { read: true, readAt: new Date() } })
      return json({ ok: true })
    }

    // ============ PILOTAGE (admin dashboard) ============
    if (route === '/pilot' && method === 'GET') {
      if (!['owner','admin','teacher'].includes(member.role)) return err('Non autorisé', 403)
      const now = new Date()
      const allTasks = await db.collection('tasks').find({ workspaceId: workspace.id, deletedAt: { $exists: false } }).toArray()
      const groups = await db.collection('groups').find({ workspaceId: workspace.id }).toArray()
      const wsMembers = await db.collection('workspace_members').find({ workspaceId: workspace.id, status: 'active' }).toArray()
      const users = await db.collection('users').find({ id: { $in: wsMembers.map(m => m.userId) } }).toArray()
      const usersById = Object.fromEntries(users.map(u => [u.id, strip(u)]))

      const countBy = (arr, s) => arr.filter(t => t.status === s).length
      const overdue = allTasks.filter(t => t.status !== 'done' && new Date(t.dueDate) < now).length

      const byGroup = groups.map(g => {
        const gt = allTasks.filter(t => t.groupId === g.id)
        const done = gt.filter(t => t.status === 'done').length
        return {
          groupId: g.id, name: g.name,
          total: gt.length, done, progress: gt.length ? Math.round((done / gt.length) * 100) : 0,
          overdue: gt.filter(t => t.status !== 'done' && new Date(t.dueDate) < now).length,
        }
      })

      const byMember = wsMembers.map(m => {
        const mt = allTasks.filter(t => (t.assignees || []).includes(m.userId))
        return {
          userId: m.userId, user: usersById[m.userId],
          total: mt.length, open: mt.filter(t => t.status !== 'done').length,
          overdue: mt.filter(t => t.status !== 'done' && new Date(t.dueDate) < now).length,
        }
      }).sort((a, b) => b.open - a.open).slice(0, 10)

      const critical = allTasks
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 8)

      // Trend over past 30 days (based on updatedAt and status)
      const trend = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(23, 59, 59, 999)
        const doneByThen = allTasks.filter(t => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) <= d).length
        trend.push({ date: d.toISOString().slice(0, 10), done: doneByThen })
      }

      return json({
        kpis: {
          total: allTasks.length,
          todo: countBy(allTasks, 'todo'),
          in_progress: countBy(allTasks, 'in_progress'),
          review: countBy(allTasks, 'review'),
          blocked: countBy(allTasks, 'blocked'),
          done: countBy(allTasks, 'done'),
          overdue,
        },
        byGroup,
        byMember,
        critical: cleanArr(critical),
        trend,
      })
    }

    // ============ VALIDATION QUEUE ============
    if (route === '/validation-queue' && method === 'GET') {
      let query = { status: 'review', workspaceId: workspace.id, deletedAt: { $exists: false } }
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
