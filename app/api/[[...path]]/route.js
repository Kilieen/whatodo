import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { signToken, comparePassword, requireUser, canManageTask, canViewTask } from '@/lib/authz'
import { seedIfEmpty } from '@/lib/seed'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function json(data, status = 200) { return cors(NextResponse.json(data, { status })) }
function err(message, status = 400) { return json({ error: message }, status) }

function stripSensitive(u) {
  if (!u) return u
  const { passwordHash, _id, ...rest } = u
  return rest
}
function cleanTask(t) {
  if (!t) return t
  const { _id, ...rest } = t
  return rest
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = '/' + path.join('/')
  const method = request.method
  const db = await getDb()
  await seedIfEmpty(db)

  try {
    // ===== AUTH =====
    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const user = await db.collection('users').findOne({ email: (body.email || '').toLowerCase().trim() })
      if (!user) return err('Identifiants invalides', 401)
      const ok = await comparePassword(body.password || '', user.passwordHash)
      if (!ok) return err('Identifiants invalides', 401)
      const token = signToken({ uid: user.id, role: user.role })
      const group = user.groupId ? await db.collection('groups').findOne({ id: user.groupId }) : null
      const leader = group?.leaderId ? await db.collection('users').findOne({ id: group.leaderId }) : null
      return json({
        token,
        user: stripSensitive(user),
        group: group ? { id: group.id, name: group.name, leaderName: leader?.firstName || null } : null,
      })
    }

    if (route === '/auth/me' && method === 'GET') {
      const user = await requireUser(request, db)
      if (!user) return err('Non authentifié', 401)
      const group = user.groupId ? await db.collection('groups').findOne({ id: user.groupId }) : null
      const leader = group?.leaderId ? await db.collection('users').findOne({ id: group.leaderId }) : null
      return json({
        user,
        group: group ? { id: group.id, name: group.name, leaderName: leader?.firstName || null } : null,
      })
    }

    if (route === '/auth/users-list' && method === 'GET') {
      // Public list of demo credentials for onboarding
      const users = await db.collection('users').find({}).sort({ role: 1, firstName: 1 }).toArray()
      return json(users.map(u => ({ email: u.email, firstName: u.firstName, role: u.role })))
    }

    // ===== USERS =====
    if (route === '/users' && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const users = await db.collection('users').find({}).toArray()
      return json(users.map(stripSensitive))
    }

    // ===== GROUPS =====
    if (route === '/groups' && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const groups = await db.collection('groups').find({}).toArray()
      const allUsers = await db.collection('users').find({}).toArray()
      const usersById = Object.fromEntries(allUsers.map(u => [u.id, stripSensitive(u)]))
      const result = groups.map(g => {
        const { _id, ...rest } = g
        return {
          ...rest,
          leader: g.leaderId ? usersById[g.leaderId] : null,
          members: (g.memberIds || []).map(id => usersById[id]).filter(Boolean),
        }
      })
      return json(result)
    }

    if (route.startsWith('/groups/') && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const groupId = route.split('/')[2]
      const g = await db.collection('groups').findOne({ id: groupId })
      if (!g) return err('Groupe introuvable', 404)
      const users = await db.collection('users').find({ id: { $in: g.memberIds || [] } }).toArray()
      const leader = users.find(u => u.id === g.leaderId)
      const tasks = await db.collection('tasks').find({ groupId }).toArray()
      const { _id, ...rest } = g
      return json({
        ...rest,
        leader: stripSensitive(leader),
        members: users.map(stripSensitive),
        tasks: tasks.map(cleanTask),
      })
    }

    // ===== TASKS =====
    if (route === '/tasks' && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const url = new URL(request.url)
      const scope = url.searchParams.get('scope') || 'visible'
      let query = {}
      if (me.role === 'admin' || me.role === 'teacher') {
        // see all
        if (scope === 'mine') query = { assignees: me.id }
        if (scope === 'group' && me.groupId) query = { groupId: me.groupId }
      } else {
        if (scope === 'mine') query = { assignees: me.id }
        else if (scope === 'group') query = { groupId: me.groupId }
        else query = { $or: [{ groupId: me.groupId }, { assignees: me.id }] }
      }
      const tasks = await db.collection('tasks').find(query).sort({ dueDate: 1 }).toArray()
      return json(tasks.map(cleanTask))
    }

    if (route === '/tasks' && method === 'POST') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const body = await request.json()
      const groupId = body.groupId || me.groupId
      if (!groupId) return err('Groupe requis', 400)
      const group = await db.collection('groups').findOne({ id: groupId })
      if (!group) return err('Groupe introuvable', 404)
      // permission: admin, leader of that group, or member creating a self-task
      const isAdmin = me.role === 'admin'
      const isLeader = me.role === 'leader' && group.leaderId === me.id
      const isMember = (group.memberIds || []).includes(me.id)
      if (!isAdmin && !isLeader && !isMember) return err('Non autorisé', 403)

      const task = {
        id: uuidv4(),
        title: body.title || 'Nouvelle tâche',
        description: body.description || '',
        groupId,
        createdBy: me.id,
        assignees: body.assignees && body.assignees.length ? body.assignees : [me.id],
        priority: body.priority || 'medium',
        status: body.status || 'todo',
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 86400000),
        proofRequired: !!body.proofRequired,
        proofs: [],
        comments: [],
        history: [{ userId: me.id, action: 'created', at: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('tasks').insertOne(task)
      return json(cleanTask(task))
    }

    if (route.startsWith('/tasks/') && route.split('/').length === 3 && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      if (!canViewTask(me, task)) return err('Non autorisé', 403)
      return json(cleanTask(task))
    }

    if (route.startsWith('/tasks/') && route.split('/').length === 3 && method === 'PATCH') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      const group = await db.collection('groups').findOne({ id: task.groupId })
      const isAssignee = task.assignees?.includes(me.id)
      const canManage = canManageTask(me, task, group)
      if (!canManage && !isAssignee) return err('Non autorisé', 403)

      const body = await request.json()
      const allowed = {}
      const managerFields = ['title', 'description', 'assignees', 'priority', 'startDate', 'dueDate', 'proofRequired', 'groupId']
      const memberFields = ['status']
      for (const f of memberFields) if (f in body) allowed[f] = body[f]
      if (canManage) for (const f of managerFields) if (f in body) allowed[f] = body[f]

      if (allowed.startDate) allowed.startDate = new Date(allowed.startDate)
      if (allowed.dueDate) allowed.dueDate = new Date(allowed.dueDate)

      // If moving to review, proof required check
      if (allowed.status === 'review' && task.proofRequired && (!task.proofs || task.proofs.length === 0)) {
        return err('Ajoute une preuve avant de demander la validation.', 400)
      }

      allowed.updatedAt = new Date()
      const history = task.history || []
      if (allowed.status && allowed.status !== task.status) {
        history.push({ userId: me.id, action: 'status_change', from: task.status, to: allowed.status, at: new Date() })
      }
      allowed.history = history

      await db.collection('tasks').updateOne({ id }, { $set: allowed })
      const updated = await db.collection('tasks').findOne({ id })
      return json(cleanTask(updated))
    }

    if (route.startsWith('/tasks/') && route.split('/').length === 3 && method === 'DELETE') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      const group = await db.collection('groups').findOne({ id: task.groupId })
      if (!canManageTask(me, task, group)) return err('Non autorisé', 403)
      await db.collection('tasks').deleteOne({ id })
      return json({ ok: true })
    }

    // Comments
    if (route.match(/^\/tasks\/[^/]+\/comments$/) && method === 'POST') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      if (!canViewTask(me, task)) return err('Non autorisé', 403)
      const body = await request.json()
      const c = { id: uuidv4(), userId: me.id, userName: me.firstName, content: body.content || '', createdAt: new Date() }
      await db.collection('tasks').updateOne({ id }, { $push: { comments: c }, $set: { updatedAt: new Date() } })
      return json(c)
    }

    // Proofs (base64 upload)
    if (route.match(/^\/tasks\/[^/]+\/proofs$/) && method === 'POST') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      if (!canViewTask(me, task)) return err('Non autorisé', 403)
      const body = await request.json()
      const proof = {
        id: uuidv4(),
        userId: me.id,
        userName: me.firstName,
        type: body.type || 'file', // file|link|text
        fileData: body.fileData || null,
        fileName: body.fileName || null,
        mimeType: body.mimeType || null,
        linkUrl: body.linkUrl || null,
        text: body.text || null,
        createdAt: new Date(),
      }
      await db.collection('tasks').updateOne({ id }, { $push: { proofs: proof }, $set: { updatedAt: new Date() } })
      return json(proof)
    }

    // Validation
    if (route.match(/^\/tasks\/[^/]+\/validate$/) && method === 'POST') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const id = route.split('/')[2]
      const task = await db.collection('tasks').findOne({ id })
      if (!task) return err('Tâche introuvable', 404)
      const group = await db.collection('groups').findOne({ id: task.groupId })
      if (!canManageTask(me, task, group)) return err('Non autorisé', 403)
      const body = await request.json()
      const approved = !!body.approved
      const update = {
        status: approved ? 'done' : 'in_progress',
        updatedAt: new Date(),
        validatedBy: approved ? me.id : task.validatedBy,
        validatedAt: approved ? new Date() : task.validatedAt,
      }
      const history = task.history || []
      history.push({ userId: me.id, action: approved ? 'validated' : 'rejected', comment: body.comment || '', at: new Date() })
      update.history = history
      if (!approved && body.comment) {
        const c = { id: uuidv4(), userId: me.id, userName: me.firstName, content: `❌ Correction demandée: ${body.comment}`, createdAt: new Date() }
        await db.collection('tasks').updateOne({ id }, { $push: { comments: c } })
      }
      await db.collection('tasks').updateOne({ id }, { $set: update })
      const updated = await db.collection('tasks').findOne({ id })
      return json(cleanTask(updated))
    }

    // ===== DASHBOARD =====
    if (route === '/dashboard' && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      const now = new Date()

      const myTasks = await db.collection('tasks').find({ assignees: me.id }).toArray()
      const groupTasks = me.groupId ? await db.collection('tasks').find({ groupId: me.groupId }).toArray() : []

      const countBy = (arr, s) => arr.filter(t => t.status === s).length
      const overdue = myTasks.filter(t => t.status !== 'done' && new Date(t.dueDate) < now).length

      const upcoming = [...myTasks]
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5)

      // Recent activity across group
      const activity = []
      for (const t of groupTasks) {
        for (const h of (t.history || []).slice(-3)) {
          activity.push({ taskId: t.id, taskTitle: t.title, ...h })
        }
      }
      activity.sort((a, b) => new Date(b.at) - new Date(a.at))

      const allUsers = await db.collection('users').find({}).toArray()
      const usersById = Object.fromEntries(allUsers.map(u => [u.id, u.firstName]))

      return json({
        stats: {
          todo: countBy(myTasks, 'todo'),
          in_progress: countBy(myTasks, 'in_progress'),
          review: countBy(myTasks, 'review'),
          blocked: countBy(myTasks, 'blocked'),
          done: countBy(myTasks, 'done'),
          overdue,
          total: myTasks.length,
        },
        upcoming: upcoming.map(cleanTask),
        activity: activity.slice(0, 10).map(a => ({ ...a, userName: usersById[a.userId] || 'Utilisateur' })),
        // calendar markers: dates having tasks
        calendarMarkers: myTasks.map(t => ({ date: t.dueDate, taskId: t.id, title: t.title, status: t.status })),
      })
    }

    // ===== VALIDATION QUEUE =====
    if (route === '/validation-queue' && method === 'GET') {
      const me = await requireUser(request, db)
      if (!me) return err('Non authentifié', 401)
      let query = { status: 'review' }
      if (me.role === 'leader') {
        const grp = await db.collection('groups').findOne({ leaderId: me.id })
        if (!grp) return json([])
        query.groupId = grp.id
      } else if (me.role !== 'admin' && me.role !== 'teacher') {
        return err('Non autorisé', 403)
      }
      const tasks = await db.collection('tasks').find(query).toArray()
      return json(tasks.map(cleanTask))
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
