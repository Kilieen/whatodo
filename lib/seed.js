import { v4 as uuidv4 } from 'uuid'
import { hashPassword } from './authz.js'

function slugify(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
function makeInviteCode(base = 'WHATODO') {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${base}-${rand}`
}
const COLORS = ['#f97316','#ec4899','#8b5cf6','#3b82f6','#10b981','#eab308','#ef4444','#14b8a6','#f43f5e','#06b6d4']

/**
 * Bootstrap logic:
 * 1. If users empty → create default EPCO users + admin
 * 2. If workspaces empty but groups exist → migrate all existing data into "EPCO – Speed Dating"
 * Idempotent.
 */
export async function ensureSeedAndMigration(db) {
  const usersCount = await db.collection('users').countDocuments()
  const workspacesCount = await db.collection('workspaces').countDocuments()

  // First-time seed: users + groups + tasks (workspaceId will be attached in migration step)
  if (usersCount === 0) {
    const groupsData = [
      { name: 'Communication',        leader: 'Jules',  members: ['Jules','Juliann','Hugo','Nicolas','Maria'] },
      { name: 'Logistique',           leader: 'Sofie',  members: ['Sofie','Lucien','Flavio','Théo','Tuana'] },
      { name: 'Contenu de la journée',leader: 'Kilian', members: ['Kilian','Erwan','Océane','Rion','Romain'] },
      { name: 'Planification',        leader: 'Selam',  members: ['Selam','Leno','Emma','Zemane','Fiona'] },
    ]
    const users = []
    const groups = []
    const defaultHash = await hashPassword('epco2026')
    const adminHash = await hashPassword('admin2026')

    const adminId = uuidv4()
    users.push({
      id: adminId, email: 'admin@epco.ch', passwordHash: adminHash,
      firstName: 'Admin', lastName: 'EPCO', avatarColor: '#0f172a', createdAt: new Date(),
      // legacy fields kept for backward compat; source of truth is workspace_members
      role: 'admin', groupId: null,
    })

    const groupPreset = [] // to build workspace_members after
    for (let g = 0; g < groupsData.length; g++) {
      const grp = groupsData[g]
      const groupId = uuidv4()
      let leaderId = null
      const memberIds = []
      const memberRoles = []
      for (let i = 0; i < grp.members.length; i++) {
        const first = grp.members[i]
        const userId = uuidv4()
        const isLeader = first === grp.leader
        if (isLeader) leaderId = userId
        users.push({
          id: userId,
          email: `${slugify(first)}@epco.ch`,
          passwordHash: defaultHash,
          firstName: first, lastName: '',
          avatarColor: COLORS[(g * 5 + i) % COLORS.length],
          createdAt: new Date(),
          role: isLeader ? 'leader' : 'student',
          groupId,
        })
        memberIds.push(userId)
        memberRoles.push({ userId, role: isLeader ? 'leader' : 'member', groupId })
      }
      groups.push({
        id: groupId, name: grp.name, leaderId, memberIds,
        description: `Groupe ${grp.name}`,
        createdAt: new Date(),
      })
      groupPreset.push({ groupId, memberRoles })
    }

    await db.collection('users').insertMany(users)
    await db.collection('groups').insertMany(groups)

    // Seed sample tasks
    const now = new Date()
    const sampleTasks = {
      'Communication': [
        { title: 'Créer l\u2019affiche de l\u2019événement', status: 'in_progress', priority: 'high', proofRequired: true },
        { title: 'Publier les posts Instagram', status: 'todo', priority: 'medium', proofRequired: true },
        { title: 'Rédiger le communiqué de presse', status: 'todo', priority: 'medium', proofRequired: false },
      ],
      'Logistique': [
        { title: 'Réserver la salle', status: 'done', priority: 'urgent', proofRequired: true },
        { title: 'Commander les badges', status: 'todo', priority: 'high', proofRequired: true },
        { title: 'Vérifier le matériel audio', status: 'blocked', priority: 'medium', proofRequired: false },
      ],
      'Contenu de la journée': [
        { title: 'Préparer les questions du speed dating', status: 'in_progress', priority: 'high', proofRequired: false },
        { title: 'Créer le planning des rotations', status: 'todo', priority: 'high', proofRequired: true },
        { title: 'Rédiger le mot d\u2019accueil', status: 'review', priority: 'medium', proofRequired: true },
      ],
      'Planification': [
        { title: 'Contacter les entreprises partenaires', status: 'in_progress', priority: 'urgent', proofRequired: true },
        { title: 'Confirmer les intervenants', status: 'todo', priority: 'high', proofRequired: true },
        { title: 'Envoyer les invitations élèves', status: 'todo', priority: 'medium', proofRequired: false },
      ],
    }
    const tasks = []
    for (const g of groups) {
      const gTasks = sampleTasks[g.name] || []
      for (let i = 0; i < gTasks.length; i++) {
        const t = gTasks[i]
        const assignee = g.memberIds[(i + 1) % g.memberIds.length]
        const due = new Date(now.getTime() + (7 + i * 10) * 86400000)
        tasks.push({
          id: uuidv4(), title: t.title, description: 'Tâche exemple à compléter par le groupe.',
          groupId: g.id, createdBy: g.leaderId, assignees: [assignee],
          priority: t.priority, status: t.status, startDate: now, dueDate: due,
          proofRequired: t.proofRequired, proofs: [], comments: [],
          history: [{ userId: g.leaderId, action: 'created', at: new Date() }],
          createdAt: new Date(), updatedAt: new Date(),
        })
      }
    }
    if (tasks.length) await db.collection('tasks').insertMany(tasks)
  }

  // Migration to multi-workspace
  if (workspacesCount === 0) {
    const groups = await db.collection('groups').find({}).toArray()
    const users = await db.collection('users').find({}).toArray()
    if (users.length === 0 || groups.length === 0) return { migrated: false }

    const admin = users.find(u => u.role === 'admin') || users[0]
    const workspaceId = uuidv4()
    const workspace = {
      id: workspaceId,
      name: 'EPCO — Speed Dating',
      description: 'Speed Dating Entreprises · 11 novembre 2026',
      icon: 'E',
      color: '#3b82f6',
      ownerId: admin.id,
      inviteCode: makeInviteCode('EPCO'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection('workspaces').insertOne(workspace)

    // Create workspace_members for every user (map legacy role/groupId)
    const members = users.map(u => ({
      id: uuidv4(),
      workspaceId,
      userId: u.id,
      role: u.role === 'admin' ? 'owner' : u.role === 'leader' ? 'leader' : u.role === 'teacher' ? 'teacher' : 'member',
      groupId: u.groupId || null,
      status: 'active',
      joinedAt: new Date(),
    }))
    await db.collection('workspace_members').insertMany(members)

    // Tag all existing groups + tasks with workspaceId
    await db.collection('groups').updateMany({ workspaceId: { $exists: false } }, { $set: { workspaceId } })
    await db.collection('tasks').updateMany({ workspaceId: { $exists: false } }, { $set: { workspaceId } })

    return { migrated: true, workspaceId, memberCount: members.length }
  }

  return { migrated: false }
}

export { makeInviteCode }
