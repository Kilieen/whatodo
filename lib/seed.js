import { v4 as uuidv4 } from 'uuid'
import { hashPassword } from './authz.js'

function slugify(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const COLORS = ['#f97316','#ec4899','#8b5cf6','#3b82f6','#10b981','#eab308','#ef4444','#14b8a6','#f43f5e','#06b6d4']

export async function seedIfEmpty(db) {
  const usersCount = await db.collection('users').countDocuments()
  if (usersCount > 0) return { seeded: false }

  const groupsData = [
    { name: 'Communication', leader: 'Jules', members: ['Jules','Juliann','Hugo','Nicolas','Maria'] },
    { name: 'Logistique', leader: 'Sofie', members: ['Sofie','Lucien','Flavio','Théo','Tuana'] },
    { name: 'Contenu de la journée', leader: 'Kilian', members: ['Kilian','Erwan','Océane','Rion','Romain'] },
    { name: 'Planification', leader: 'Selam', members: ['Selam','Leno','Emma','Zemane','Fiona'] },
  ]

  const groups = []
  const users = []
  const defaultHash = await hashPassword('epco2026')
  const adminHash = await hashPassword('admin2026')

  // Admin user
  const adminId = uuidv4()
  users.push({
    id: adminId, email: 'admin@epco.ch', passwordHash: adminHash,
    firstName: 'Admin', lastName: 'EPCO', role: 'admin', groupId: null,
    avatarColor: '#0f172a', createdAt: new Date()
  })

  for (let g = 0; g < groupsData.length; g++) {
    const grp = groupsData[g]
    const groupId = uuidv4()
    let leaderId = null
    const groupMemberIds = []

    for (let i = 0; i < grp.members.length; i++) {
      const first = grp.members[i]
      const userId = uuidv4()
      const isLeader = first === grp.leader
      if (isLeader) leaderId = userId
      users.push({
        id: userId,
        email: `${slugify(first)}@epco.ch`,
        passwordHash: defaultHash,
        firstName: first,
        lastName: '',
        role: isLeader ? 'leader' : 'student',
        groupId,
        avatarColor: COLORS[(g * 5 + i) % COLORS.length],
        createdAt: new Date()
      })
      groupMemberIds.push(userId)
    }
    groups.push({
      id: groupId, name: grp.name, leaderId, memberIds: groupMemberIds,
      description: `Groupe ${grp.name} pour le Speed Dating EPCO`,
      createdAt: new Date()
    })
  }

  await db.collection('users').insertMany(users)
  await db.collection('groups').insertMany(groups)

  // Seed a few example tasks per group
  const tasks = []
  const now = new Date()
  const eventDate = new Date('2026-11-11')
  const sampleTasks = {
    'Communication': [
      { title: 'Créer l’affiche de l’événement', status: 'in_progress', priority: 'high', proofRequired: true },
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
      { title: 'Rédiger le mot d’accueil', status: 'review', priority: 'medium', proofRequired: true },
    ],
    'Planification': [
      { title: 'Contacter les entreprises partenaires', status: 'in_progress', priority: 'urgent', proofRequired: true },
      { title: 'Confirmer les intervenants', status: 'todo', priority: 'high', proofRequired: true },
      { title: 'Envoyer les invitations élèves', status: 'todo', priority: 'medium', proofRequired: false },
    ],
  }

  for (const g of groups) {
    const gTasks = sampleTasks[g.name] || []
    for (let i = 0; i < gTasks.length; i++) {
      const t = gTasks[i]
      const assignee = g.memberIds[(i + 1) % g.memberIds.length]
      const due = new Date(now.getTime() + (7 + i * 10) * 24 * 3600 * 1000)
      tasks.push({
        id: uuidv4(),
        title: t.title,
        description: 'Tâche exemple – à compléter par le groupe.',
        groupId: g.id,
        createdBy: g.leaderId,
        assignees: [assignee],
        priority: t.priority,
        status: t.status,
        startDate: now,
        dueDate: due,
        proofRequired: t.proofRequired,
        proofs: [],
        comments: [],
        history: [{ userId: g.leaderId, action: 'created', at: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
        isDemo: true,
      })
    }
  }

  if (tasks.length) await db.collection('tasks').insertMany(tasks)

  return { seeded: true, users: users.length, groups: groups.length, tasks: tasks.length, eventDate }
}
