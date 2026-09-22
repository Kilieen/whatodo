'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCorners
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import {
  LayoutDashboard, ListChecks, Users, MessageSquare, Calendar as CalIcon,
  Bell, LogOut, Moon, Sun, Plus, ChevronLeft, ChevronRight, Menu, X,
  Flag, Clock, CheckCircle2, AlertCircle, Paperclip, Send, CheckCheck,
  Upload, Link as LinkIcon, FileText, Trash2, Edit3, Loader2, Shield
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

// ===== API HELPERS =====
const API = '/api'
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('epco_token') : null }
async function apiFetch(path, opts = {}) {
  const token = getToken()
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Erreur')
  return data
}

// ===== STATUS CONFIG =====
const STATUS = {
  todo:        { label: 'À faire',    color: 'bg-slate-500',    text: 'text-slate-100', ring: 'ring-slate-400' },
  in_progress: { label: 'En cours',   color: 'bg-blue-500',     text: 'text-blue-50',   ring: 'ring-blue-400' },
  review:      { label: 'À valider',  color: 'bg-amber-500',    text: 'text-amber-50',  ring: 'ring-amber-400' },
  blocked:     { label: 'Bloqué',     color: 'bg-red-500',      text: 'text-red-50',    ring: 'ring-red-400' },
  done:        { label: 'Terminé',    color: 'bg-emerald-600',  text: 'text-emerald-50',ring: 'ring-emerald-400' },
}
const STATUS_ORDER = ['todo', 'in_progress', 'review', 'blocked', 'done']

const PRIORITY = {
  low:    { label: 'Basse',   color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100' },
  medium: { label: 'Moyenne', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200' },
  high:   { label: 'Haute',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' },
}

const ROLE_LABEL = { admin: 'Administrateur', leader: 'Chef de groupe', student: 'Élève', teacher: 'Enseignant' }

// ===== UTILS =====
function initials(name = '') {
  return name.split(' ').filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
}
function fmtDateFull(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
}
function isOverdue(t) {
  return t.status !== 'done' && new Date(t.dueDate) < new Date()
}
function daysUntil(d) {
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000)
  return diff
}

// ===== LOGIN =====
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetch(API + '/auth/users-list').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  async function submit(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('epco_token', data.token)
      toast.success(`Bienvenue ${data.user.firstName} !`)
      onLogin(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function quickPick(u) {
    setEmail(u.email)
    setPassword(u.role === 'admin' ? 'admin2026' : 'epco2026')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold shadow-lg mb-4">
            E
          </div>
          <h1 className="text-3xl font-bold tracking-tight">EPCO Project Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Speed Dating Entreprises · 11 novembre 2026</p>
        </div>
        <Card className="shadow-xl border-0">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="prenom@epco.ch" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
        {users.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-center text-muted-foreground mb-2">
              Compte de démo · mot de passe: <span className="font-mono">epco2026</span> (admin: <span className="font-mono">admin2026</span>)
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 max-h-48 overflow-y-auto">
              {users.map(u => (
                <button key={u.email} onClick={() => quickPick(u)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition hover:scale-105 ${
                    u.role === 'admin' ? 'bg-slate-900 text-white border-slate-900' :
                    u.role === 'leader' ? 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100' :
                    'bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                  }`}>
                  {u.firstName}{u.role === 'leader' ? ' 👑' : u.role === 'admin' ? ' ⚡' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== AVATAR CIRCLE =====
function UserAvatar({ user, size = 8 }) {
  if (!user) return null
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full text-white text-xs font-semibold shrink-0`}
      style={{ backgroundColor: user.avatarColor || '#6366f1', width: `${size * 4}px`, height: `${size * 4}px` }}
      title={user.firstName}>
      {initials(user.firstName)}
    </div>
  )
}

// ===== TASK CARD =====
function TaskCard({ task, users, onOpen, isDragging }) {
  const assignees = (task.assignees || []).map(id => users[id]).filter(Boolean)
  const overdue = isOverdue(task)
  return (
    <div
      onClick={() => onOpen?.(task)}
      className={`bg-card border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all ${isDragging ? 'shadow-2xl rotate-2 scale-105' : 'shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${PRIORITY[task.priority]?.color}`}>
          {PRIORITY[task.priority]?.label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map(u => <UserAvatar key={u.id} user={u} size={5} />)}
            {assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px]">+{assignees.length - 3}</div>
            )}
          </div>
          {task.proofRequired && <Paperclip className={`w-3 h-3 ${task.proofs?.length ? 'text-emerald-500' : 'text-amber-500'}`} />}
          {task.comments?.length > 0 && (
            <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{task.comments.length}</span>
          )}
        </div>
        <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
          <Clock className="w-3 h-3" />{fmtDate(task.dueDate)}
        </span>
      </div>
    </div>
  )
}

// ===== DND KANBAN =====
function DraggableCard({ task, users, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { task } })
  const style = { opacity: isDragging ? 0 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} users={users} onOpen={onOpen} />
    </div>
  )
}

function DroppableColumn({ id, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}
      className={`flex flex-col rounded-2xl p-3 min-h-[300px] border-2 transition ${
        isOver ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/40'
      }`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${STATUS[id].color}`} />
          <h3 className="text-sm font-semibold">{STATUS[id].label}</h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium">{count}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {children}
      </div>
    </div>
  )
}

function KanbanBoard({ tasks, users, onOpen, onStatusChange, canDrag = true }) {
  const [activeTask, setActiveTask] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )
  const grouped = useMemo(() => {
    const g = { todo: [], in_progress: [], review: [], blocked: [], done: [] }
    for (const t of tasks) if (g[t.status]) g[t.status].push(t)
    return g
  }, [tasks])

  function onDragStart(e) { setActiveTask(e.active.data.current?.task) }
  function onDragEnd(e) {
    setActiveTask(null)
    const overId = e.over?.id
    const task = e.active.data.current?.task
    if (!overId || !task || overId === task.status) return
    onStatusChange?.(task, overId)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STATUS_ORDER.map(s => (
          <DroppableColumn key={s} id={s} count={grouped[s].length}>
            {grouped[s].map(t => canDrag ? (
              <DraggableCard key={t.id} task={t} users={users} onOpen={onOpen} />
            ) : (
              <TaskCard key={t.id} task={t} users={users} onOpen={onOpen} />
            ))}
            {grouped[s].length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4 opacity-60">Vide</div>
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} users={users} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// ===== MINI CALENDAR =====
function MiniCalendar({ markers = [], onDayClick }) {
  const [ref, setRef] = useState(new Date())
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const markerByDay = useMemo(() => {
    const m = {}
    for (const mk of markers) {
      const d = new Date(mk.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const k = d.getDate()
        m[k] = m[k] || []
        m[k].push(mk)
      }
    }
    return m
  }, [markers, year, month])

  const today = new Date()
  const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const weeks = []
  let cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
    if (cells.length === 7) { weeks.push(cells); cells = [] }
  }
  if (cells.length) { while (cells.length < 7) cells.push(null); weeks.push(cells) }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">
            {ref.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setRef(new Date(year, month - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setRef(new Date(year, month + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1 uppercase">
          {['L','M','M','J','V','S','D'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((d, i) => {
            const marks = d ? markerByDay[d] : null
            return (
              <button key={i} disabled={!d}
                onClick={() => d && onDayClick?.(new Date(year, month, d), marks || [])}
                className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition ${
                  !d ? 'invisible' :
                  isToday(d) ? 'bg-primary text-primary-foreground font-bold' :
                  marks ? 'bg-accent hover:bg-accent/80 font-medium' :
                  'hover:bg-muted'
                }`}>
                <span>{d}</span>
                {marks && (
                  <div className="flex gap-0.5 mt-0.5">
                    {marks.slice(0, 3).map((mk, k) => (
                      <div key={k} className={`w-1 h-1 rounded-full ${STATUS[mk.status]?.color || 'bg-slate-400'}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ===== DASHBOARD =====
function DashboardView({ me, group, users, onOpenTask, onNavigate }) {
  const [data, setData] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  async function load() {
    try { setData(await apiFetch('/dashboard')) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  if (!data) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>

  const stats = data.stats
  const cards = [
    { label: 'À faire',    value: stats.todo,        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800' },
    { label: 'En cours',   value: stats.in_progress, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950' },
    { label: 'À valider',  value: stats.review,      color: 'bg-amber-100 text-amber-700 dark:bg-amber-950' },
    { label: 'En retard',  value: stats.overdue,     color: 'bg-red-100 text-red-700 dark:bg-red-950' },
    { label: 'Terminées',  value: stats.done,        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bonjour {me.firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ROLE_LABEL[me.role]}
            {group && <> · Groupe <span className="font-medium text-foreground">{group.name}</span></>}
            {group?.leaderName && <> · Chef·fe: <span className="font-medium text-foreground">{group.leaderName}</span></>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Événement</p>
          <p className="text-sm font-bold">Speed Dating · 11 nov 2026</p>
          <p className="text-xs text-muted-foreground">Dans {Math.ceil((new Date('2026-11-11') - new Date()) / 86400000)} jours</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className={`text-3xl font-bold ${c.value > 0 && c.label === 'En retard' ? 'text-red-600' : ''}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Mes prochaines échéances</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => onNavigate('tasks')}>Voir tout →</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Tu n'as aucune tâche en retard 🎉</p>
              )}
              {data.upcoming.map(t => (
                <div key={t.id} onClick={() => onOpenTask(t)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition">
                  <div className={`w-2 h-10 rounded-full ${STATUS[t.status].color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS[t.status].label} · {fmtDate(t.dueDate)}
                      {isOverdue(t) && <span className="text-red-500 font-medium"> · En retard</span>}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY[t.priority]?.color}`}>
                    {PRIORITY[t.priority]?.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Activité récente du groupe</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.activity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune activité.</p>
              )}
              {data.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0 mt-0.5">
                    {a.action === 'validated' ? <CheckCheck className="w-3 h-3" /> :
                     a.action === 'rejected' ? <X className="w-3 h-3" /> :
                     a.action === 'created' ? <Plus className="w-3 h-3" /> :
                     <Edit3 className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{a.userName}</span>{' '}
                      {a.action === 'created' && <>a créé </>}
                      {a.action === 'status_change' && <>a passé </>}
                      {a.action === 'validated' && <>a validé </>}
                      {a.action === 'rejected' && <>a refusé </>}
                      <span className="font-medium">"{a.taskTitle}"</span>
                      {a.action === 'status_change' && <> · <Badge variant="outline" className="text-[10px]">{STATUS[a.to]?.label}</Badge></>}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString('fr-CH')}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <MiniCalendar markers={data.calendarMarkers} onDayClick={(d, marks) => setSelectedDay({ d, marks })} />
          {selectedDay && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{fmtDateFull(selectedDay.d)}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {selectedDay.marks.length === 0 && <p className="text-xs text-muted-foreground">Aucune tâche.</p>}
                {selectedDay.marks.map(m => (
                  <div key={m.taskId} className="text-sm p-2 rounded-lg bg-muted flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      const task = data.upcoming.find(t => t.id === m.taskId)
                      if (task) onOpenTask(task)
                    }}>
                    <div className={`w-2 h-2 rounded-full ${STATUS[m.status]?.color}`} />
                    <span className="truncate">{m.title}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== TASK DETAIL DIALOG =====
function TaskDialog({ task, open, onClose, me, users, groups, onUpdated }) {
  const [editing, setEditing] = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEditing(task ? { ...task } : null); setComment('') }, [task])
  if (!task || !editing) return null

  const group = groups.find(g => g.id === task.groupId)
  const canManage = me.role === 'admin' || (me.role === 'leader' && group?.leaderId === me.id)
  const isAssignee = task.assignees?.includes(me.id)
  const canEdit = canManage || isAssignee

  async function patch(patch) {
    setSaving(true)
    try {
      const updated = await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      toast.success('Mise à jour')
      onUpdated(updated)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  async function saveEdits() {
    await patch({
      title: editing.title, description: editing.description, priority: editing.priority,
      assignees: editing.assignees, startDate: editing.startDate, dueDate: editing.dueDate,
      proofRequired: editing.proofRequired,
    })
  }

  async function sendComment() {
    if (!comment.trim()) return
    try {
      const c = await apiFetch(`/tasks/${task.id}/comments`, { method: 'POST', body: JSON.stringify({ content: comment }) })
      onUpdated({ ...task, comments: [...(task.comments || []), c] })
      setComment('')
    } catch (e) { toast.error(e.message) }
  }

  async function uploadProof(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Fichier max 5 MB'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const p = await apiFetch(`/tasks/${task.id}/proofs`, {
          method: 'POST',
          body: JSON.stringify({ type: 'file', fileData: reader.result, fileName: file.name, mimeType: file.type }),
        })
        toast.success('Preuve ajoutée')
        onUpdated({ ...task, proofs: [...(task.proofs || []), p] })
      } catch (e) { toast.error(e.message) }
    }
    reader.readAsDataURL(file)
  }

  async function validate(approved) {
    let comment = ''
    if (!approved) {
      comment = window.prompt('Commentaire pour demander une correction:') || ''
      if (!comment) return
    }
    try {
      const updated = await apiFetch(`/tasks/${task.id}/validate`, {
        method: 'POST', body: JSON.stringify({ approved, comment }),
      })
      toast.success(approved ? 'Tâche validée ✅' : 'Correction demandée')
      onUpdated(updated)
    } catch (e) { toast.error(e.message) }
  }

  async function requestReview() {
    try {
      await patch({ status: 'review' })
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS[task.status].color}`} />
            <DialogTitle className="text-left">{task.title}</DialogTitle>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
            <span>Groupe: <span className="font-medium text-foreground">{group?.name}</span></span>
            <span>·</span>
            <span>Statut: <span className="font-medium text-foreground">{STATUS[task.status].label}</span></span>
            <span>·</span>
            <span className={`px-1.5 py-0.5 rounded-full ${PRIORITY[task.priority]?.color}`}>{PRIORITY[task.priority]?.label}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {canEdit && (
            <div>
              <Label>Titre</Label>
              <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} disabled={!canManage} />
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Textarea value={editing.description || ''} rows={3}
              onChange={e => setEditing({ ...editing, description: e.target.value })} disabled={!canManage} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priorité</Label>
              <Select value={editing.priority} onValueChange={v => setEditing({ ...editing, priority: v })} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={editing.status} onValueChange={v => patch({ status: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input type="date" disabled={!canManage}
                value={editing.startDate ? new Date(editing.startDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Échéance</Label>
              <Input type="date" disabled={!canManage}
                value={editing.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, dueDate: e.target.value })} />
            </div>
          </div>

          {canManage && group && (
            <div>
              <Label>Assigné à</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {group.members?.map(m => {
                  const on = editing.assignees?.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const set = new Set(editing.assignees || [])
                        on ? set.delete(m.id) : set.add(m.id)
                        setEditing({ ...editing, assignees: [...set] })
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition ${
                        on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                      }`}>
                      <UserAvatar user={m} size={4} />{m.firstName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {canManage && (
            <div className="flex items-center gap-2">
              <Checkbox checked={editing.proofRequired}
                onCheckedChange={v => setEditing({ ...editing, proofRequired: !!v })} id="pr" />
              <Label htmlFor="pr" className="cursor-pointer">Preuve obligatoire pour valider</Label>
            </div>
          )}

          {canManage && (
            <Button onClick={saveEdits} disabled={saving} size="sm">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enregistrer les modifications
            </Button>
          )}

          {/* PROOFS */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Preuves de réalisation
              {task.proofRequired && <Badge variant="outline" className="text-[10px]">Obligatoire</Badge>}
            </h3>
            <div className="space-y-2 mb-2">
              {(task.proofs || []).map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {p.fileData ? (
                    <a href={p.fileData} download={p.fileName} target="_blank" rel="noreferrer"
                      className="flex-1 truncate text-primary hover:underline">{p.fileName}</a>
                  ) : (
                    <span className="flex-1 truncate">{p.text || p.linkUrl}</span>
                  )}
                  <span className="text-xs text-muted-foreground">par {p.userName}</span>
                </div>
              ))}
              {(!task.proofs || task.proofs.length === 0) && (
                <p className="text-xs text-muted-foreground">Aucune preuve pour le moment.</p>
              )}
            </div>
            {canEdit && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg cursor-pointer hover:bg-muted/70 text-sm">
                <Upload className="w-4 h-4" /> Ajouter une preuve
                <input type="file" className="hidden" onChange={e => uploadProof(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {/* ACTIONS */}
          <div className="border-t pt-4 flex flex-wrap gap-2">
            {isAssignee && task.status !== 'review' && task.status !== 'done' && (
              <Button size="sm" onClick={requestReview} variant="default">
                <CheckCheck className="w-4 h-4 mr-1" /> Passer À valider
              </Button>
            )}
            {canManage && task.status === 'review' && (
              <>
                <Button size="sm" onClick={() => validate(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                </Button>
                <Button size="sm" variant="destructive" onClick={() => validate(false)}>
                  <AlertCircle className="w-4 h-4 mr-1" /> Demander correction
                </Button>
              </>
            )}
          </div>

          {/* COMMENTS */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Commentaires ({task.comments?.length || 0})
            </h3>
            <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
              {(task.comments || []).map(c => (
                <div key={c.id} className="flex gap-2">
                  <UserAvatar user={users[c.userId]} size={6} />
                  <div className="flex-1 bg-muted rounded-lg p-2">
                    <p className="text-xs font-medium">{c.userName || users[c.userId]?.firstName}</p>
                    <p className="text-sm">{c.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleString('fr-CH')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ajouter un commentaire..." value={comment}
                onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()} />
              <Button size="icon" onClick={sendComment}><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== CREATE TASK DIALOG =====
function CreateTaskDialog({ open, onClose, me, group, groups, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', groupId: '', assignees: [], dueDate: '', proofRequired: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const gid = group?.id || (me.role === 'admin' ? groups[0]?.id : me.groupId) || ''
      const dt = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      setForm({ title: '', description: '', priority: 'medium', groupId: gid, assignees: [me.id], dueDate: dt, proofRequired: false })
    }
  }, [open])

  const selectedGroup = groups.find(g => g.id === form.groupId)

  async function submit() {
    if (!form.title.trim()) return toast.error('Titre requis')
    setSaving(true)
    try {
      const t = await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Tâche créée')
      onCreated(t); onClose()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Réserver la salle" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Groupe</Label>
              <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v, assignees: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.filter(g => me.role === 'admin' || g.id === me.groupId).map(g =>
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Échéance</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox checked={form.proofRequired} onCheckedChange={v => setForm({ ...form, proofRequired: !!v })} id="npr" />
              <Label htmlFor="npr" className="cursor-pointer">Preuve obligatoire</Label>
            </div>
          </div>
          {selectedGroup && (
            <div>
              <Label>Assigner à</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedGroup.members?.map(m => {
                  const on = form.assignees.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const s = new Set(form.assignees)
                        on ? s.delete(m.id) : s.add(m.id)
                        setForm({ ...form, assignees: [...s] })
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition ${
                        on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                      }`}>
                      <UserAvatar user={m} size={4} />{m.firstName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== TASKS VIEW =====
function TasksView({ me, users, groups, onOpenTask, refreshKey }) {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('kanban')
  const [scope, setScope] = useState('mine')

  async function load() {
    try { setTasks(await apiFetch(`/tasks?scope=${scope}`)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [scope, refreshKey])

  async function handleStatusChange(task, newStatus) {
    // optimistic
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      const updated = await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      toast.success(`→ ${STATUS[newStatus].label}`)
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Mes tâches</h1>
        <div className="flex items-center gap-2">
          <Tabs value={scope} onValueChange={setScope}>
            <TabsList>
              <TabsTrigger value="mine">Assignées à moi</TabsTrigger>
              <TabsTrigger value="group">Mon groupe</TabsTrigger>
              {(me.role === 'admin' || me.role === 'teacher') && <TabsTrigger value="visible">Tout</TabsTrigger>}
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">Liste</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === 'kanban' && (
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      )}
      {view === 'list' && (
        <Card>
          <CardContent className="p-0 divide-y">
            {tasks.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucune tâche.</div>}
            {tasks.map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)}
                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer">
                <div className={`w-1.5 h-10 rounded-full ${STATUS[t.status].color}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS[t.status].label} · {fmtDate(t.dueDate)}
                    {isOverdue(t) && <span className="text-red-500"> · Retard</span>}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY[t.priority]?.color}`}>{PRIORITY[t.priority]?.label}</span>
                <div className="flex -space-x-1.5">
                  {(t.assignees || []).slice(0, 3).map(id => <UserAvatar key={id} user={users[id]} size={5} />)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ===== GROUP VIEW =====
function GroupView({ me, users, groups, onOpenTask, refreshKey, groupId }) {
  const [group, setGroup] = useState(null)
  const gid = groupId || me.groupId

  async function load() {
    if (!gid) return
    try { setGroup(await apiFetch(`/groups/${gid}`)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [gid, refreshKey])

  if (!gid) return <div className="text-center py-12 text-muted-foreground">Vous n'êtes dans aucun groupe.</div>
  if (!group) return <div className="p-6"><Loader2 className="animate-spin" /></div>

  const tasks = group.tasks || []
  const doneCount = tasks.filter(t => t.status === 'done').length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  async function handleStatusChange(task, newStatus) {
    setGroup(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t) }))
    try {
      const updated = await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      setGroup(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }))
    } catch (e) { toast.error(e.message); load() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chef·fe: <span className="font-medium">{group.leader?.firstName}</span> · {group.members?.length} membres
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="md:col-span-2">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progression du groupe</span>
              <span className="text-sm font-bold">{progress}%</span>
            </div>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground mt-2">{doneCount} sur {tasks.length} tâches terminées</p>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-4">
          <p className="text-3xl font-bold">{tasks.filter(t => t.status !== 'done').length}</p>
          <p className="text-xs text-muted-foreground">Tâches ouvertes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-3xl font-bold text-red-600">{tasks.filter(isOverdue).length}</p>
          <p className="text-xs text-muted-foreground">En retard</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Membres</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {group.members?.map(m => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <UserAvatar user={m} size={9} />
              <div>
                <p className="text-sm font-medium">{m.firstName} {m.id === group.leaderId && '👑'}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Kanban du groupe</h2>
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
}

// ===== VALIDATION VIEW =====
function ValidationView({ me, users, groups, onOpenTask, refreshKey }) {
  const [tasks, setTasks] = useState([])
  async function load() { try { setTasks(await apiFetch('/validation-queue')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [refreshKey])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Centre de validation</h1>
      <p className="text-sm text-muted-foreground">Tâches en attente de validation</p>
      {tasks.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune tâche à valider 🎉</CardContent></Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map(t => {
          const g = groups.find(gr => gr.id === t.groupId)
          return (
            <Card key={t.id} className="cursor-pointer hover:shadow-md" onClick={() => onOpenTask(t)}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <Badge>{g?.name}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Échéance: {fmtDate(t.dueDate)}</p>
                <div className="flex -space-x-1.5">
                  {(t.assignees || []).map(id => <UserAvatar key={id} user={users[id]} size={6} />)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className={`w-3 h-3 ${t.proofs?.length ? 'text-emerald-500' : 'text-amber-500'}`} />
                  {t.proofs?.length || 0} preuve(s)
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ===== APP SHELL =====
export default function App() {
  const [me, setMe] = useState(null)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [users, setUsers] = useState({}) // usersById
  const [groups, setGroups] = useState([])
  const [taskOpen, setTaskOpen] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  async function bootstrap() {
    setLoading(true)
    if (getToken()) {
      try {
        const { user, group } = await apiFetch('/auth/me')
        setMe(user); setGroup(group)
        const gs = await apiFetch('/groups')
        setGroups(gs)
        const us = await apiFetch('/users')
        setUsers(Object.fromEntries(us.map(u => [u.id, u])))
      } catch { localStorage.removeItem('epco_token') }
    }
    setLoading(false)
  }

  useEffect(() => { bootstrap() }, [])

  function onLogin(data) {
    setMe(data.user); setGroup(data.group)
    bootstrap()
  }
  function logout() { localStorage.removeItem('epco_token'); setMe(null); setView('dashboard') }
  function refresh() { setRefreshKey(k => k + 1) }
  function openTask(t) { setTaskOpen(t) }
  function taskUpdated(t) {
    setTaskOpen(t)
    refresh()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  if (!me) return <LoginScreen onLogin={onLogin} />

  const canValidate = me.role === 'admin' || me.role === 'leader'

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Mes tâches', icon: ListChecks },
    { key: 'group', label: 'Mon groupe', icon: Users },
    ...(canValidate ? [{ key: 'validation', label: 'Validation', icon: CheckCheck }] : []),
    ...(me.role === 'admin' ? [{ key: 'admin_groups', label: 'Tous groupes', icon: Shield }] : []),
  ]

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center">E</div>
          <div>
            <p className="font-bold text-sm leading-tight">EPCO Hub</p>
            <p className="text-xs text-muted-foreground">Speed Dating</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(n => (
          <button key={n.key} onClick={() => { setView(n.key); setSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              view === n.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}>
            <n.icon className="w-4 h-4" />{n.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <UserAvatar user={me} size={9} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{me.firstName}</p>
            <p className="text-xs text-muted-foreground truncate">{ROLE_LABEL[me.role]}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  const currentView = (() => {
    switch (view) {
      case 'dashboard': return <DashboardView me={me} group={group} users={users} onOpenTask={openTask} onNavigate={setView} />
      case 'tasks': return <TasksView me={me} users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'group': return <GroupView me={me} users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'validation': return <ValidationView me={me} users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'admin_groups': return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Tous les groupes</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(g => (
              <Card key={g.id} className="cursor-pointer hover:shadow-md" onClick={() => { setView('group'); /* admin sees own or all */ }}>
                <CardHeader><CardTitle>{g.name}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Chef·fe: {g.leader?.firstName}</p>
                  <div className="flex -space-x-1.5 mt-2">
                    {g.members?.map(m => <UserAvatar key={m.id} user={m} size={7} />)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )
      default: return null
    }
  })()

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-card fixed inset-y-0 left-0 z-30">{Sidebar}</aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-card z-50 md:hidden">{Sidebar}</aside>
        </>
      )}

      <main className="flex-1 md:ml-64 min-w-0 pb-20 md:pb-8">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 bg-background/95 backdrop-blur border-b p-3 flex items-center justify-between">
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></Button>
          <p className="font-bold text-sm">EPCO Hub</p>
          <Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)}><Plus className="w-5 h-5" /></Button>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="hidden md:flex justify-end mb-4">
            <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nouvelle tâche</Button>
          </div>
          {currentView}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t z-30 flex justify-around">
          {NAV.slice(0, 4).map(n => (
            <button key={n.key} onClick={() => setView(n.key)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${view === n.key ? 'text-primary' : 'text-muted-foreground'}`}>
              <n.icon className="w-5 h-5" />
              <span className="text-[10px]">{n.label}</span>
            </button>
          ))}
        </nav>
      </main>

      <TaskDialog task={taskOpen} open={!!taskOpen} onClose={() => setTaskOpen(null)}
        me={me} users={users} groups={groups} onUpdated={taskUpdated} />
      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)}
        me={me} group={groups.find(g => g.id === me.groupId)} groups={groups}
        onCreated={() => refresh()} />
    </div>
  )
}
