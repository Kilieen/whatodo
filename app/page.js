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
  Clock, CheckCircle2, AlertCircle, Paperclip, Send, CheckCheck,
  Upload, FileText, Edit3, Loader2, Shield, Search, BarChart3, Settings,
  User as UserIcon, ArrowUpRight, GanttChart, MoreHorizontal, Filter
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ================================================================
// LOGO
// ================================================================
function WhatodoLogo({ size = 40, className = '', stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} fill="none">
      <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="29" r="4.2"/>
        <path d="M26 39c1.2-2.8 3.3-4.1 6-4.1s4.8 1.3 6 4.1"/>
        <path d="M47 25a15 15 0 0 0-25-4"/>
        <path d="M17 41a15 15 0 0 0 25 4"/>
        <path d="M47 25l-1-4.5M47 25l-4.5 1"/>
        <path d="M17 41l1 4.5M17 41l4.5-1"/>
      </g>
    </svg>
  )
}

// ================================================================
// API
// ================================================================
const API = '/api'
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('whatodo_token') : null }
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

// ================================================================
// CONSTANTS
// ================================================================
const STATUS = {
  todo:        { label: 'À faire',   dot: 'dot-todo',    color: '#94a3b8' },
  in_progress: { label: 'En cours',  dot: 'dot-progress',color: '#60a5fa' },
  review:      { label: 'À valider', dot: 'dot-review',  color: '#f59e0b' },
  blocked:     { label: 'Bloqué',    dot: 'dot-blocked', color: '#ef4444' },
  done:        { label: 'Terminé',   dot: 'dot-done',    color: '#34d399' },
}
const STATUS_ORDER = ['todo', 'in_progress', 'review', 'blocked', 'done']

const PRIORITY = {
  low:    { label: 'Basse',   cls: 'text-white/50 bg-white/[0.04] border-white/[0.06]' },
  medium: { label: 'Moyenne', cls: 'text-sky-300 bg-sky-400/10 border-sky-400/15' },
  high:   { label: 'Haute',   cls: 'text-orange-200 bg-orange-400/10 border-orange-400/15' },
  urgent: { label: 'Urgente', cls: 'text-red-200 bg-red-400/10 border-red-400/15' },
}

const ROLE_LABEL = { admin: 'Administrateur', leader: 'Chef de groupe', student: 'Élève', teacher: 'Enseignant' }

function initials(name = '') {
  return name.split(' ').filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
}
function fmtDateFull(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
}
function isOverdue(t) { return t.status !== 'done' && new Date(t.dueDate) < new Date() }
function sameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// ================================================================
// PRIMITIVES
// ================================================================
function UserAvatar({ user, size = 30 }) {
  if (!user) return null
  return (
    <div
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ring-2 ring-[color:var(--w-surface)]"
      style={{ backgroundColor: user.avatarColor || '#3a5375', width: size, height: size, fontSize: size * 0.38 }}
      title={user.firstName}>
      {initials(user.firstName)}
    </div>
  )
}

function StatusDot({ status, withLabel }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-2">
      <span className={`dot ${STATUS[status].dot}`} />
      {withLabel && STATUS[status].label}
    </span>
  )
}

// ================================================================
// LOGIN
// ================================================================
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
      localStorage.setItem('whatodo_token', data.token)
      onLogin(data)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  function quickPick(u) {
    setEmail(u.email); setPassword(u.role === 'admin' ? 'admin2026' : 'epco2026')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm anim-fade-up">
        <div className="flex flex-col items-center mb-10">
          <WhatodoLogo size={64} stroke="#ffffff" className="mb-6 opacity-95" />
          <h1 className="text-4xl font-bold tracking-tight">Whatodo</h1>
          <p className="text-sm text-2 mt-2">Organisez. Collaborez. Avancez.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <input id="email" type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="email"
              className="w-full h-11 px-4 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-white placeholder:text-3 focus:outline-none focus:border-white/25 transition" />
          </div>
          <div>
            <input id="password" type="password" placeholder="Mot de passe" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              className="w-full h-11 px-4 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-white placeholder:text-3 focus:outline-none focus:border-white/25 transition" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-xl btn-primary text-sm">
            {loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Se connecter'}
          </button>
        </form>

        {users.length > 0 && (
          <div className="mt-10 anim-fade" style={{ animationDelay: '0.15s' }}>
            <p className="t-meta text-center mb-3">
              Accès démo · <span className="font-mono">epco2026</span> · admin <span className="font-mono">admin2026</span>
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {users.map(u => (
                <button key={u.email} onClick={() => quickPick(u)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                    u.role === 'admin' ? 'bg-white text-[#0a1428] border-white' :
                    u.role === 'leader' ? 'border-white/25 text-white' :
                    'border-white/10 text-white/50 hover:text-white hover:border-white/20'
                  }`}>{u.firstName}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ================================================================
// TASK CARD (compact)
// ================================================================
function TaskCard({ task, users, onOpen, isDragging }) {
  const assignees = (task.assignees || []).map(id => users[id]).filter(Boolean)
  const overdue = isOverdue(task)
  return (
    <div
      onClick={() => onOpen?.(task)}
      className={`group rounded-xl border border-[color:var(--w-border)] bg-[color:var(--w-surface)] p-3 cursor-pointer transition-all
        hover:border-white/15 hover:bg-[color:var(--w-surface-2)] ${isDragging ? 'shadow-2xl ring-1 ring-white/20 rotate-1 scale-[1.02]' : ''}`}>
      <div className="flex items-start gap-2 mb-3">
        <span className={`dot ${STATUS[task.status].dot} mt-1.5`} />
        <p className="text-[13.5px] font-medium leading-snug text-white flex-1">{task.title}</p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map(u => <UserAvatar key={u.id} user={u} size={20} />)}
          </div>
          {task.priority !== 'medium' && task.priority !== 'low' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${PRIORITY[task.priority]?.cls}`}>
              {PRIORITY[task.priority]?.label}
            </span>
          )}
          {task.proofRequired && (
            <Paperclip className={`w-3 h-3 ${task.proofs?.length ? 'text-emerald-400' : 'text-amber-400'}`} />
          )}
        </div>
        <span className={`text-[11px] ${overdue ? 'text-red-300 font-medium' : 'text-3'}`}>
          {fmtDate(task.dueDate)}
        </span>
      </div>
    </div>
  )
}

// ================================================================
// KANBAN
// ================================================================
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
      className={`rounded-2xl p-3 min-h-[320px] transition-all border ${
        isOver ? 'border-white/25 bg-white/[0.02]' : 'border-transparent'
      }`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`dot ${STATUS[id].dot}`} />
          <h3 className="text-[13px] font-semibold text-white">{STATUS[id].label}</h3>
          <span className="text-[11px] text-3 tabular-nums">{count}</span>
        </div>
        <button className="icon-btn" style={{ width: 24, height: 24 }}><Plus className="w-3 h-3" /></button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function KanbanBoard({ tasks, users, onOpen, onStatusChange }) {
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={e => setActiveTask(e.active.data.current?.task)}
      onDragEnd={e => {
        setActiveTask(null)
        const overId = e.over?.id
        const task = e.active.data.current?.task
        if (overId && task && overId !== task.status) onStatusChange?.(task, overId)
      }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STATUS_ORDER.map(s => (
          <DroppableColumn key={s} id={s} count={grouped[s].length}>
            {grouped[s].map(t => <DraggableCard key={t.id} task={t} users={users} onOpen={onOpen} />)}
            {grouped[s].length === 0 && <div className="text-xs text-3 text-center py-4">—</div>}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeTask ? <TaskCard task={activeTask} users={users} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// ================================================================
// DONUT CHART
// ================================================================
function Donut({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const stroke = 22
  const r = (size - stroke) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative inline-block">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const frac = d.value / total
          const dash = frac * circumference
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.22,1,0.36,1)' }} />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-[11px] text-3">tâches</span>
      </div>
    </div>
  )
}

// ================================================================
// MINI CALENDAR
// ================================================================
function MiniCalendar({ markers = [], onDayClick, compact = false }) {
  const [ref, setRef] = useState(new Date())
  const year = ref.getFullYear(), month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
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
  const isToday = d => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold capitalize">
          {ref.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
        </p>
        <div className="flex gap-1">
          <button onClick={() => setRef(new Date(year, month - 1, 1))} className="icon-btn" style={{ width: 26, height: 26 }}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setRef(new Date(year, month + 1, 1))} className="icon-btn" style={{ width: 26, height: 26 }}>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-3 mb-1.5">
        {['Lu','Ma','Me','Je','Ve','Sa','Di'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const marks = d ? markerByDay[d] : null
          const active = d && isToday(d)
          return (
            <button key={i} disabled={!d}
              onClick={() => d && onDayClick?.(new Date(year, month, d), marks || [])}
              className={`aspect-square rounded-lg text-[12px] flex flex-col items-center justify-center transition-all ${
                !d ? 'invisible' :
                active ? 'bg-white text-[#0a1428] font-semibold' :
                marks ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium' :
                'text-white/50 hover:bg-white/[0.03] hover:text-white'
              }`}>
              <span>{d}</span>
              {marks && !active && (
                <div className="flex gap-0.5 mt-0.5">
                  {marks.slice(0, 3).map((mk, k) => <span key={k} className={`dot ${STATUS[mk.status]?.dot}`} style={{ width: 3, height: 3 }} />)}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================
// DASHBOARD
// ================================================================
function DashboardView({ me, group, users, onOpenTask, onNavigate, onCreate }) {
  const [data, setData] = useState(null)
  const [taskFilter, setTaskFilter] = useState('today') // today | week | all
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    apiFetch('/dashboard').then(setData).catch(e => toast.error(e.message))
  }, [])

  if (!data) return <div className="p-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>

  const stats = data.stats
  const now = new Date()
  const in7 = new Date(Date.now() + 7 * 86400000)

  const myTasks = data.upcoming
  const filteredTasks = myTasks.filter(t => {
    if (taskFilter === 'today') return sameDay(t.dueDate, now)
    if (taskFilter === 'week') return new Date(t.dueDate) <= in7
    return true
  })

  const donutData = [
    { label: 'En cours', value: stats.in_progress, color: '#60a5fa' },
    { label: 'À valider', value: stats.review, color: '#f59e0b' },
    { label: 'Terminé', value: stats.done, color: '#34d399' },
    { label: 'À faire', value: stats.todo, color: '#475569' },
  ]

  const daysToEvent = Math.ceil((new Date('2026-11-11') - now) / 86400000)

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-2 mb-1">Bonjour {me.firstName},</p>
          <h1 className="t-h1">Dashboard</h1>
          <p className="text-sm text-2 mt-2">
            {group ? `${group.name}` : 'Sans groupe'} · {ROLE_LABEL[me.role]}
            {group?.leaderName && me.role !== 'leader' && me.role !== 'admin' && <> · Chef·fe {group.leaderName}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-3" />
            <input placeholder="Rechercher…"
              className="h-9 pl-8 pr-3 rounded-full bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-[12.5px] text-white placeholder:text-3 focus:outline-none focus:border-white/20 transition w-40 md:w-56" />
          </div>
          <button onClick={onCreate} className="h-9 px-4 rounded-full btn-primary text-[12.5px] hidden sm:inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Tâche
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* My Tasks */}
        <div className="surface p-5 lg:col-span-1 stagger">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="t-h2">Mes tâches</h2>
              <span className="text-[11px] w-5 h-5 rounded-full bg-white/10 flex items-center justify-center tabular-nums">
                {myTasks.length}
              </span>
            </div>
            <button className="icon-btn" onClick={onCreate}><Plus className="w-4 h-4" /></button>
          </div>
          <div className="pill-group mb-4">
            <button className={`pill ${taskFilter === 'today' ? 'pill-active' : ''}`} onClick={() => setTaskFilter('today')}>Aujourd'hui</button>
            <button className={`pill ${taskFilter === 'week' ? 'pill-active' : ''}`} onClick={() => setTaskFilter('week')}>Cette semaine</button>
            <button className={`pill ${taskFilter === 'all' ? 'pill-active' : ''}`} onClick={() => setTaskFilter('all')}>Toutes</button>
          </div>
          <div className="space-y-2">
            {filteredTasks.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-2">Rien pour {taskFilter === 'today' ? 'aujourd\'hui' : taskFilter === 'week' ? 'cette semaine' : 'le moment'}.</p>
              </div>
            )}
            {filteredTasks.slice(0, 5).map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)}
                className="group flex items-start gap-3 p-3 rounded-xl border border-[color:var(--w-border)] hover:border-white/15 hover:bg-white/[0.02] cursor-pointer transition">
                <span className={`dot ${STATUS[t.status].dot} mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium leading-snug">{t.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-3 mt-1">
                    <span>{STATUS[t.status].label}</span>
                    <span>·</span>
                    <span className={isOverdue(t) ? 'text-red-300' : ''}>{fmtDate(t.dueDate)}</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-3 opacity-0 group-hover:opacity-100 transition mt-1" />
              </div>
            ))}
            {filteredTasks.length > 5 && (
              <button onClick={() => onNavigate('tasks')} className="w-full text-[12px] text-2 hover:text-white pt-1 transition">
                Voir les {filteredTasks.length - 5} autres →
              </button>
            )}
          </div>
        </div>

        {/* Progress overview */}
        <div className="surface p-5 stagger">
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-h2">Progression</h2>
            <button className="icon-btn"><MoreHorizontal className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-6">
            <Donut data={donutData} size={160} />
            <div className="space-y-2.5 flex-1">
              {donutData.map(d => (
                <div key={d.label} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 text-2">{d.label}</span>
                  <span className="tabular-nums text-white font-medium">{d.value}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-[color:var(--w-border)] flex items-center gap-2 text-[12.5px]">
                <span className="flex-1 text-2">En retard</span>
                <span className={`tabular-nums font-medium ${stats.overdue > 0 ? 'text-red-300' : 'text-white'}`}>{stats.overdue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="surface p-5 stagger">
          <MiniCalendar markers={data.calendarMarkers} onDayClick={(d, marks) => setSelectedDay({ d, marks })} />
          {selectedDay && (
            <div className="mt-4 pt-4 border-t border-[color:var(--w-border)] anim-fade">
              <p className="text-[12px] text-2 mb-2">{fmtDateFull(selectedDay.d)}</p>
              <div className="space-y-1">
                {selectedDay.marks.length === 0 && <p className="text-[12px] text-3">Aucune tâche.</p>}
                {selectedDay.marks.map(m => (
                  <div key={m.taskId} className="text-[12.5px] flex items-center gap-2 py-1 cursor-pointer hover:text-white"
                    onClick={() => {
                      const task = myTasks.find(t => t.id === m.taskId)
                      if (task) onOpenTask(task)
                    }}>
                    <span className={`dot ${STATUS[m.status]?.dot}`} />
                    <span className="truncate text-2">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="surface p-5 lg:col-span-2 stagger">
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-h2">Échéances à venir</h2>
            <button onClick={() => onNavigate('tasks')} className="text-[12px] text-2 hover:text-white transition inline-flex items-center gap-1">
              Voir tout <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {myTasks.length === 0 && (
              <p className="text-sm text-2 py-8 text-center">Tu n'as aucune tâche en retard.</p>
            )}
            {myTasks.slice(0, 6).map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)}
                className="flex items-center gap-4 py-3 cursor-pointer hover:bg-white/[0.015] -mx-2 px-2 rounded transition">
                <div className="w-10 text-center">
                  <p className="text-[11px] text-3 leading-tight">{new Date(t.dueDate).toLocaleDateString('fr-CH', { month: 'short' }).replace('.','').toUpperCase()}</p>
                  <p className={`text-lg font-bold tabular-nums leading-tight ${isOverdue(t) ? 'text-red-300' : ''}`}>{new Date(t.dueDate).getDate()}</p>
                </div>
                <div className="w-px h-8 bg-[color:var(--w-border)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{t.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-3 mt-0.5">
                    <StatusDot status={t.status} withLabel />
                    <span>·</span>
                    <span>{PRIORITY[t.priority]?.label}</span>
                  </div>
                </div>
                <div className="flex -space-x-1.5">
                  {(t.assignees || []).slice(0, 3).map(id => <UserAvatar key={id} user={users[id]} size={22} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="surface p-5 stagger">
          <h2 className="t-h2 mb-4">Activité récente</h2>
          <div className="space-y-3">
            {data.activity.length === 0 && <p className="text-sm text-3">Aucune activité.</p>}
            {data.activity.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px]">
                <div className="w-1.5 h-1.5 rounded-full bg-white/25 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">
                    <span className="font-medium">{a.userName}</span>
                    <span className="text-2">
                      {a.action === 'created' && ' a créé '}
                      {a.action === 'status_change' && ' a déplacé '}
                      {a.action === 'validated' && ' a validé '}
                      {a.action === 'rejected' && ' a refusé '}
                    </span>
                    <span className="text-white/85">{a.taskTitle}</span>
                    {a.action === 'status_change' && a.to && (
                      <span className="text-2"> → <span className="text-white/85">{STATUS[a.to]?.label}</span></span>
                    )}
                  </p>
                  <p className="text-[10.5px] text-3 mt-0.5">{new Date(a.at).toLocaleString('fr-CH')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Event footer bar */}
      <div className="surface-flat px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] text-3 uppercase tracking-wider mb-0.5">Événement</p>
          <p className="text-sm font-semibold">Speed Dating Entreprises — <span className="serif italic text-white/90">11 novembre 2026</span></p>
        </div>
        <p className="text-sm text-2">Dans <span className="text-white font-semibold tabular-nums">{daysToEvent}</span> jours</p>
      </div>
    </div>
  )
}

// ================================================================
// TASKS VIEW
// ================================================================
function TasksView({ me, users, onOpenTask, refreshKey }) {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('kanban')
  const [scope, setScope] = useState('mine')

  async function load() {
    try { setTasks(await apiFetch(`/tasks?scope=${scope}`)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [scope, refreshKey])

  async function handleStatusChange(task, newStatus) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      const updated = await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Vue personnelle</p>
          <h1 className="t-h1">Tâches</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="pill-group">
            <button className={`pill ${scope === 'mine' ? 'pill-active' : ''}`} onClick={() => setScope('mine')}>À moi</button>
            <button className={`pill ${scope === 'group' ? 'pill-active' : ''}`} onClick={() => setScope('group')}>Groupe</button>
            {(me.role === 'admin' || me.role === 'teacher') && (
              <button className={`pill ${scope === 'visible' ? 'pill-active' : ''}`} onClick={() => setScope('visible')}>Tout</button>
            )}
          </div>
          <div className="pill-group">
            <button className={`pill ${view === 'kanban' ? 'pill-active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
            <button className={`pill ${view === 'list' ? 'pill-active' : ''}`} onClick={() => setView('list')}>Liste</button>
          </div>
        </div>
      </div>

      {view === 'kanban' && (
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      )}
      {view === 'list' && (
        <div className="surface divide-y divide-[color:var(--w-border)] overflow-hidden">
          {tasks.length === 0 && <div className="p-10 text-center text-sm text-2">Aucune tâche.</div>}
          {tasks.map(t => (
            <div key={t.id} onClick={() => onOpenTask(t)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition">
              <span className={`dot ${STATUS[t.status].dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate">{t.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-3 mt-0.5">
                  <span>{STATUS[t.status].label}</span>
                  <span>·</span>
                  <span className={isOverdue(t) ? 'text-red-300' : ''}>{fmtDate(t.dueDate)}</span>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-md border ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
              <div className="flex -space-x-1.5">
                {(t.assignees || []).slice(0, 3).map(id => <UserAvatar key={id} user={users[id]} size={22} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ================================================================
// GROUP VIEW
// ================================================================
function GroupView({ me, users, onOpenTask, refreshKey, groupId, onCreate }) {
  const [group, setGroup] = useState(null)
  const gid = groupId || me.groupId

  async function load() {
    if (!gid) return
    try { setGroup(await apiFetch(`/groups/${gid}`)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [gid, refreshKey])

  if (!gid) return <div className="text-center py-16 text-2">Vous n'êtes dans aucun groupe.</div>
  if (!group) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>

  const tasks = group.tasks || []
  const doneCount = tasks.filter(t => t.status === 'done').length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
  const openCount = tasks.filter(t => t.status !== 'done').length
  const overdueCount = tasks.filter(isOverdue).length

  async function handleStatusChange(task, newStatus) {
    setGroup(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t) }))
    try {
      const updated = await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      setGroup(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }))
    } catch (e) { toast.error(e.message); load() }
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Groupe</p>
          <h1 className="t-h1">{group.name}</h1>
          <p className="text-sm text-2 mt-2">{group.leader?.firstName} · {group.members?.length} membres</p>
        </div>
        <button onClick={onCreate} className="h-9 px-4 rounded-full btn-primary text-[12.5px] inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
        </button>
      </div>

      {/* Compact stats row */}
      <div className="surface px-5 py-4 flex items-center gap-8 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-3">Progression</span>
            <span className="text-[13px] font-semibold tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[11px] text-3">Ouvertes</p>
            <p className="text-xl font-bold tabular-nums">{openCount}</p>
          </div>
          <div className="w-px h-8 bg-[color:var(--w-border)]" />
          <div>
            <p className="text-[11px] text-3">En retard</p>
            <p className={`text-xl font-bold tabular-nums ${overdueCount > 0 ? 'text-red-300' : ''}`}>{overdueCount}</p>
          </div>
          <div className="w-px h-8 bg-[color:var(--w-border)]" />
          <div>
            <p className="text-[11px] text-3">Terminées</p>
            <p className="text-xl font-bold tabular-nums text-emerald-300">{doneCount}</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="flex flex-wrap gap-2">
        {group.members?.map(m => (
          <div key={m.id} className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border border-[color:var(--w-border)] bg-[color:var(--w-surface)]">
            <UserAvatar user={m} size={26} />
            <span className="text-[12.5px] pr-1">
              {m.firstName}
              {m.id === group.leaderId && <span className="text-amber-300 ml-1">·</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="t-h2">Kanban</h2>
          <button className="icon-btn"><Filter className="w-4 h-4" /></button>
        </div>
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
}

// ================================================================
// VALIDATION
// ================================================================
function ValidationView({ users, groups, onOpenTask, refreshKey }) {
  const [tasks, setTasks] = useState([])
  useEffect(() => { apiFetch('/validation-queue').then(setTasks).catch(e => toast.error(e.message)) }, [refreshKey])

  return (
    <div className="space-y-5 anim-fade-up">
      <div>
        <p className="text-sm text-2 mb-1">En attente d'approbation</p>
        <h1 className="t-h1">Validation</h1>
      </div>
      {tasks.length === 0 && (
        <div className="surface p-16 text-center">
          <CheckCheck className="w-6 h-6 mx-auto text-white/25 mb-2" />
          <p className="text-sm text-2">Aucune tâche à valider.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map(t => {
          const g = groups.find(gr => gr.id === t.groupId)
          return (
            <div key={t.id} onClick={() => onOpenTask(t)}
              className="surface surface-interactive p-4 cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold">{t.title}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-[color:var(--w-border)] text-2">{g?.name}</span>
              </div>
              <p className="text-[12px] text-3 mb-3">Échéance {fmtDate(t.dueDate)}</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-1.5">
                  {(t.assignees || []).map(id => <UserAvatar key={id} user={users[id]} size={22} />)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-2">
                  <Paperclip className={`w-3 h-3 ${t.proofs?.length ? 'text-emerald-400' : 'text-amber-400'}`} />
                  {t.proofs?.length || 0} preuve(s)
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AllGroupsView({ groups, onOpenGroup }) {
  return (
    <div className="space-y-5 anim-fade-up">
      <div>
        <p className="text-sm text-2 mb-1">Vue admin</p>
        <h1 className="t-h1">Groupes</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map(g => (
          <div key={g.id} onClick={() => onOpenGroup(g.id)}
            className="surface surface-interactive p-5 cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <h3 className="t-h2">{g.name}</h3>
              <ArrowUpRight className="w-4 h-4 text-3" />
            </div>
            <p className="text-[12px] text-3 mb-4">Chef·fe · {g.leader?.firstName}</p>
            <div className="flex -space-x-2">
              {g.members?.map(m => <UserAvatar key={m.id} user={m} size={28} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// TASK DIALOG
// ================================================================
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
    let commentValue = ''
    if (!approved) {
      commentValue = window.prompt('Commentaire pour la correction:') || ''
      if (!commentValue) return
    }
    try {
      const updated = await apiFetch(`/tasks/${task.id}/validate`, {
        method: 'POST', body: JSON.stringify({ approved, comment: commentValue }),
      })
      toast.success(approved ? 'Validée' : 'Correction demandée')
      onUpdated(updated)
    } catch (e) { toast.error(e.message) }
  }

  const inputCls = "w-full h-10 px-3 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-white text-sm placeholder:text-3 focus:outline-none focus:border-white/20 transition"
  const labelCls = "text-[11px] text-3 mb-1.5 block"

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-glass max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border-white/10 p-0">
        <div className="p-6 pb-4 border-b border-[color:var(--w-border)]">
          <div className="flex items-center gap-2 text-xs text-2 mb-2">
            <StatusDot status={task.status} withLabel />
            <span>·</span>
            <span>{group?.name}</span>
            <span>·</span>
            <span className={`px-2 py-0.5 rounded-md border ${PRIORITY[task.priority]?.cls}`}>{PRIORITY[task.priority]?.label}</span>
          </div>
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-semibold">{task.title}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {canEdit && (
            <div>
              <label className={labelCls}>Titre</label>
              <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                disabled={!canManage} className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={editing.description || ''} rows={3}
              onChange={e => setEditing({ ...editing, description: e.target.value })} disabled={!canManage}
              className={`${inputCls} h-auto py-2`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priorité</label>
              <Select value={editing.priority} onValueChange={v => setEditing({ ...editing, priority: v })} disabled={!canManage}>
                <SelectTrigger className={inputCls + ' h-10'}><SelectValue /></SelectTrigger>
                <SelectContent className="w-glass border-white/10">
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <Select value={editing.status} onValueChange={v => patch({ status: v })} disabled={!canEdit}>
                <SelectTrigger className={inputCls + ' h-10'}><SelectValue /></SelectTrigger>
                <SelectContent className="w-glass border-white/10">
                  {STATUS_ORDER.map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Début</label>
              <input type="date" disabled={!canManage}
                value={editing.startDate ? new Date(editing.startDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, startDate: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Échéance</label>
              <input type="date" disabled={!canManage}
                value={editing.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, dueDate: e.target.value })}
                className={inputCls} />
            </div>
          </div>

          {canManage && group && (
            <div>
              <label className={labelCls}>Assigné à</label>
              <div className="flex flex-wrap gap-1.5">
                {group.members?.map(m => {
                  const on = editing.assignees?.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const set = new Set(editing.assignees || [])
                        on ? set.delete(m.id) : set.add(m.id)
                        setEditing({ ...editing, assignees: [...set] })
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition ${
                        on ? 'bg-white text-[#0a1428] border-white' : 'border-[color:var(--w-border)] text-2 hover:text-white hover:border-white/25'
                      }`}>
                      <UserAvatar user={m} size={18} />{m.firstName}
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
              <label htmlFor="pr" className="cursor-pointer text-sm">Preuve obligatoire pour valider</label>
            </div>
          )}

          {canManage && (
            <button onClick={saveEdits} disabled={saving}
              className="h-9 px-4 rounded-xl btn-primary text-sm inline-flex items-center gap-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </button>
          )}

          {/* Proofs */}
          <div className="border-t border-[color:var(--w-border)] pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-2" /> Preuves
                {task.proofRequired && <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-amber-400/25 text-amber-300 bg-amber-400/10">Obligatoire</span>}
              </h3>
              {canEdit && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-ghost text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Ajouter
                  <input type="file" className="hidden" onChange={e => uploadProof(e.target.files?.[0])} />
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              {(task.proofs || []).map(p => (
                <div key={p.id} className="surface-flat px-3 py-2 flex items-center gap-2 text-sm">
                  <FileText className="w-3.5 h-3.5 text-2" />
                  {p.fileData ? (
                    <a href={p.fileData} download={p.fileName} target="_blank" rel="noreferrer"
                      className="flex-1 truncate hover:underline">{p.fileName}</a>
                  ) : (
                    <span className="flex-1 truncate">{p.text || p.linkUrl}</span>
                  )}
                  <span className="text-[11px] text-3">par {p.userName}</span>
                </div>
              ))}
              {(!task.proofs || task.proofs.length === 0) && (
                <p className="text-[12px] text-3">Aucune preuve pour le moment.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isAssignee && task.status !== 'review' && task.status !== 'done' && (
              <button onClick={() => patch({ status: 'review' })}
                className="h-9 px-4 rounded-xl btn-primary text-sm inline-flex items-center gap-1">
                <CheckCheck className="w-4 h-4" /> Passer À valider
              </button>
            )}
            {canManage && task.status === 'review' && (
              <>
                <button onClick={() => validate(true)}
                  className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm inline-flex items-center gap-1 transition">
                  <CheckCircle2 className="w-4 h-4" /> Valider
                </button>
                <button onClick={() => validate(false)}
                  className="h-9 px-4 rounded-xl btn-ghost text-red-300 hover:text-red-200 text-sm inline-flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Correction
                </button>
              </>
            )}
          </div>

          {/* Comments */}
          <div className="border-t border-[color:var(--w-border)] pt-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-2" /> Commentaires
              <span className="text-3 text-[11px]">{task.comments?.length || 0}</span>
            </h3>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {(task.comments || []).map(c => (
                <div key={c.id} className="flex gap-2">
                  <UserAvatar user={users[c.userId]} size={24} />
                  <div className="flex-1 surface-flat px-3 py-2">
                    <p className="text-[12px] font-medium">{c.userName || users[c.userId]?.firstName}</p>
                    <p className="text-sm mt-0.5">{c.content}</p>
                    <p className="text-[10px] text-3 mt-1">{new Date(c.createdAt).toLocaleString('fr-CH')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder="Écrire un commentaire…" value={comment}
                onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()}
                className={inputCls} />
              <button onClick={sendComment}
                className="w-10 h-10 rounded-xl btn-primary inline-flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ================================================================
// CREATE TASK DIALOG
// ================================================================
function CreateTaskDialog({ open, onClose, me, groups, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', groupId: '', assignees: [], dueDate: '', proofRequired: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const gid = (me.role === 'admin' ? groups[0]?.id : me.groupId) || ''
      const dt = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      setForm({ title: '', description: '', priority: 'medium', groupId: gid, assignees: [me.id], dueDate: dt, proofRequired: false })
    }
  }, [open])

  const selectedGroup = groups.find(g => g.id === form.groupId)
  const inputCls = "w-full h-10 px-3 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/20 transition"
  const labelCls = "text-[11px] text-3 mb-1.5 block"

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
      <DialogContent className="w-glass max-w-lg rounded-2xl border-white/10">
        <DialogHeader><DialogTitle className="text-lg">Nouvelle tâche</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Titre</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Réserver la salle" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className={`${inputCls} h-auto py-2`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Groupe</label>
              <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v, assignees: [] })}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent className="w-glass border-white/10">
                  {groups.filter(g => me.role === 'admin' || g.id === me.groupId).map(g =>
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Priorité</label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent className="w-glass border-white/10">
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Échéance</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className={inputCls} />
            </div>
            <div className="flex items-end gap-2 pb-1.5">
              <Checkbox checked={form.proofRequired} onCheckedChange={v => setForm({ ...form, proofRequired: !!v })} id="npr" />
              <label htmlFor="npr" className="cursor-pointer text-sm">Preuve obligatoire</label>
            </div>
          </div>
          {selectedGroup && (
            <div>
              <label className={labelCls}>Assigner à</label>
              <div className="flex flex-wrap gap-1.5">
                {selectedGroup.members?.map(m => {
                  const on = form.assignees.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const s = new Set(form.assignees)
                        on ? s.delete(m.id) : s.add(m.id)
                        setForm({ ...form, assignees: [...s] })
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition ${
                        on ? 'bg-white text-[#0a1428] border-white' : 'border-[color:var(--w-border)] text-2 hover:text-white'
                      }`}>
                      <UserAvatar user={m} size={18} />{m.firstName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-9 px-4 rounded-xl btn-ghost text-sm">Annuler</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-xl btn-primary text-sm inline-flex items-center gap-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Créer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ================================================================
// APP SHELL
// ================================================================
export default function App() {
  const [me, setMe] = useState(null)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [users, setUsers] = useState({})
  const [groups, setGroups] = useState([])
  const [taskOpen, setTaskOpen] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewGroupId, setViewGroupId] = useState(null)
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
      } catch { localStorage.removeItem('whatodo_token') }
    }
    setLoading(false)
  }

  useEffect(() => { bootstrap() }, [])

  function onLogin() { bootstrap() }
  function logout() { localStorage.removeItem('whatodo_token'); setMe(null); setView('dashboard') }
  function refresh() { setRefreshKey(k => k + 1) }
  function openTask(t) { setTaskOpen(t) }
  function taskUpdated(t) { setTaskOpen(t); refresh() }
  function goto(k) { setView(k); setSidebarOpen(false); setViewGroupId(null) }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <WhatodoLogo size={40} stroke="#ffffff" className="opacity-80" />
    </div>
  )
  if (!me) return <LoginScreen onLogin={onLogin} />

  const canValidate = me.role === 'admin' || me.role === 'leader'

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Mes tâches', icon: ListChecks },
    { key: 'group', label: 'Mon groupe', icon: Users, hidden: !me.groupId },
    ...(canValidate ? [{ key: 'validation', label: 'Validation', icon: CheckCheck }] : []),
    ...(me.role === 'admin' ? [{ key: 'admin_groups', label: 'Tous groupes', icon: Shield }] : []),
    { key: 'calendar', label: 'Calendrier', icon: CalIcon, soon: true },
    { key: 'gantt', label: 'Gantt', icon: GanttChart, soon: true },
    { key: 'chat', label: 'Chat', icon: MessageSquare, soon: true },
    { key: 'notifs', label: 'Notifications', icon: Bell, soon: true },
  ].filter(n => !n.hidden)

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center gap-2.5">
        <WhatodoLogo size={26} stroke="#ffffff" className="opacity-95" />
        <p className="font-semibold text-[15px] tracking-tight">Whatodo</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(n => (
          <button key={n.key}
            onClick={() => !n.soon && goto(n.key)}
            disabled={n.soon}
            className={`nav-item w-full ${view === n.key ? 'nav-item-active' : ''} ${n.soon ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}>
            <n.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{n.label}</span>
            {n.soon && <span className="text-[9px] uppercase tracking-widest text-3">soon</span>}
          </button>
        ))}
      </nav>
      <div className="p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition cursor-pointer">
          <UserAvatar user={me} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate">{me.firstName}</p>
            <p className="text-[10.5px] text-3 truncate">{ROLE_LABEL[me.role]}</p>
          </div>
          <button onClick={logout} className="icon-btn" title="Déconnexion">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  const currentView = (() => {
    switch (view) {
      case 'dashboard': return <DashboardView me={me} group={group} users={users} onOpenTask={openTask} onNavigate={goto} onCreate={() => setCreateOpen(true)} />
      case 'tasks': return <TasksView me={me} users={users} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'group': return <GroupView me={me} users={users} onOpenTask={openTask} refreshKey={refreshKey} groupId={viewGroupId} onCreate={() => setCreateOpen(true)} />
      case 'validation': return <ValidationView users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'admin_groups': return <AllGroupsView groups={groups} onOpenGroup={gid => { setViewGroupId(gid); setView('group') }} />
      default: return (
        <div className="anim-fade-up surface p-16 text-center">
          <p className="text-sm text-2">Cette section arrive bientôt.</p>
        </div>
      )
    }
  })()

  const bottomNav = NAV.filter(n => !n.soon).slice(0, 4)

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-[220px] fixed inset-y-0 left-0 border-r border-[color:var(--w-border)] bg-[color:var(--w-bg)] z-30">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40 md:hidden anim-fade" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[260px] bg-[color:var(--w-bg)] border-r border-[color:var(--w-border)] z-50 md:hidden anim-fade">
            {Sidebar}
          </aside>
        </>
      )}

      <main className="flex-1 md:ml-[220px] min-w-0 pb-24 md:pb-8 relative z-10">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-[color:var(--w-bg)]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[color:var(--w-border)]">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <WhatodoLogo size={20} stroke="#ffffff" />
            <p className="font-semibold text-sm">Whatodo</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 md:px-10 py-6 md:py-10 max-w-[1400px] mx-auto">
          {currentView}
        </div>

        {/* Mobile bottom nav (glass) */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 w-glass rounded-2xl p-1.5 flex justify-around">
          {bottomNav.map(n => (
            <button key={n.key} onClick={() => goto(n.key)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 rounded-xl transition ${
                view === n.key ? 'bg-white text-[#0a1428]' : 'text-2'
              }`}>
              <n.icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{n.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </main>

      <TaskDialog task={taskOpen} open={!!taskOpen} onClose={() => setTaskOpen(null)}
        me={me} users={users} groups={groups} onUpdated={taskUpdated} />
      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)}
        me={me} groups={groups} onCreated={() => refresh()} />
    </div>
  )
}
