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
  Upload, FileText, Edit3, Loader2, Shield, Sparkles, BarChart3, Settings,
  User as UserIcon, ArrowRight, GanttChart
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ================================================================
// LOGO / BRANDING
// ================================================================
function WhatodoMark({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
      <defs>
        <linearGradient id="whatodoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3564"/>
          <stop offset="100%" stopColor="#0a1628"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#whatodoBg)"/>
      <g fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="30" r="4.5"/>
        <path d="M25.5 40c1.4-3 3.5-4.4 6.5-4.4s5.1 1.4 6.5 4.4"/>
        <path d="M47 25a15 15 0 0 0-25-4"/>
        <path d="M17 41a15 15 0 0 0 25 4"/>
        <path d="M47 25l-1.2-5M47 25l-5 1.2"/>
        <path d="M17 41l1.2 5M17 41l5-1.2"/>
      </g>
    </svg>
  )
}

// ================================================================
// API HELPERS (unchanged)
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
  todo:        { label: 'À faire',    dot: 'bg-slate-400',    col: 'col-todo' },
  in_progress: { label: 'En cours',   dot: 'bg-blue-400',     col: 'col-progress' },
  review:      { label: 'À valider',  dot: 'bg-amber-400',    col: 'col-review' },
  blocked:     { label: 'Bloqué',     dot: 'bg-red-400',      col: 'col-blocked' },
  done:        { label: 'Terminé',    dot: 'bg-emerald-400',  col: 'col-done' },
}
const STATUS_ORDER = ['todo', 'in_progress', 'review', 'blocked', 'done']

const PRIORITY = {
  low:    { label: 'Basse',   cls: 'bg-white/[0.06] text-white/70 border-white/10' },
  medium: { label: 'Moyenne', cls: 'bg-sky-400/10 text-sky-200 border-sky-400/20' },
  high:   { label: 'Haute',   cls: 'bg-orange-400/10 text-orange-200 border-orange-400/20' },
  urgent: { label: 'Urgente', cls: 'bg-red-400/10 text-red-200 border-red-400/20' },
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
function isOverdue(t) {
  return t.status !== 'done' && new Date(t.dueDate) < new Date()
}

// ================================================================
// PRIMITIVES
// ================================================================
function GlassCard({ className = '', children, hover = false, ...props }) {
  return (
    <div className={`glass rounded-2xl ${hover ? 'glass-hover' : ''} ${className}`} {...props}>
      {children}
    </div>
  )
}

function UserAvatar({ user, size = 32, ring = false }) {
  if (!user) return null
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ${ring ? 'ring-2 ring-white/20' : ''}`}
      style={{ backgroundColor: user.avatarColor || '#3a5375', width: size, height: size, fontSize: size * 0.4 }}
      title={user.firstName}>
      {initials(user.firstName)}
    </div>
  )
}

function StatusPill({ status }) {
  const s = STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className="text-white/70">{s.label}</span>
    </span>
  )
}

// ================================================================
// LOGIN SCREEN
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
      toast.success(`Bienvenue ${data.user.firstName}`)
      onLogin(data)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  function quickPick(u) {
    setEmail(u.email)
    setPassword(u.role === 'admin' ? 'admin2026' : 'epco2026')
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb" style={{ width: 500, height: 500, top: '-10%', left: '-10%', background: 'radial-gradient(circle, #1e40af, transparent)' }} />
      <div className="orb" style={{ width: 400, height: 400, bottom: '-10%', right: '-10%', background: 'radial-gradient(circle, #6366f1, transparent)', animationDelay: '4s' }} />
      <div className="orb" style={{ width: 300, height: 300, top: '50%', right: '30%', background: 'radial-gradient(circle, #0ea5e9, transparent)', animationDelay: '8s' }} />

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex mb-6">
            <WhatodoMark size={72} className="drop-shadow-2xl" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gradient mb-2">Whatodo</h1>
          <p className="text-sm text-white/50 font-medium">Task & team coordination</p>
        </div>

        <GlassCard className="p-8 animate-scale-in">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-white/50 font-medium">Email</Label>
              <Input id="email" type="email" placeholder="prenom@epco.ch" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="glass-subtle border-white/10 h-11 rounded-xl focus-visible:ring-white/20 focus-visible:border-white/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-white/50 font-medium">Mot de passe</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                className="glass-subtle border-white/10 h-11 rounded-xl focus-visible:ring-white/20 focus-visible:border-white/20" />
            </div>
            <Button type="submit"
              className="w-full h-11 rounded-xl bg-white text-navy-900 hover:bg-white/90 font-semibold shadow-lg shadow-black/20 transition-all hover:scale-[1.01]"
              disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1 order-2" />}
              <span className="order-1">Se connecter</span>
            </Button>
          </form>
        </GlassCard>

        {users.length > 0 && (
          <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <p className="text-xs text-center text-white/40 mb-3">
              Accès rapide · mot de passe: <span className="font-mono text-white/60">epco2026</span> (admin: <span className="font-mono text-white/60">admin2026</span>)
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 max-h-40 overflow-y-auto pb-2">
              {users.map(u => (
                <button key={u.email} onClick={() => quickPick(u)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all hover:scale-105 ${
                    u.role === 'admin' ? 'bg-white text-navy-900 border-white' :
                    u.role === 'leader' ? 'glass-subtle text-white border-white/20' :
                    'glass-subtle text-white/70 border-white/10'
                  }`}>
                  {u.firstName}{u.role === 'leader' ? ' ·' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ================================================================
// TASK CARD
// ================================================================
function TaskCard({ task, users, onOpen, isDragging }) {
  const assignees = (task.assignees || []).map(id => users[id]).filter(Boolean)
  const overdue = isOverdue(task)
  return (
    <div
      onClick={() => onOpen?.(task)}
      className={`glass glass-hover rounded-xl p-3 cursor-pointer select-none ${isDragging ? 'shadow-2xl ring-1 ring-white/20 rotate-2 scale-105' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm font-medium leading-snug text-white/95 flex-1">{task.title}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap border ${PRIORITY[task.priority]?.cls}`}>
          {PRIORITY[task.priority]?.label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map(u => <UserAvatar key={u.id} user={u} size={20} ring />)}
            {assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full glass-subtle flex items-center justify-center text-[9px] text-white/70 ring-2 ring-white/10">+{assignees.length - 3}</div>
            )}
          </div>
          {task.proofRequired && (
            <Paperclip className={`w-3 h-3 ${task.proofs?.length ? 'text-emerald-400' : 'text-amber-400'}`} />
          )}
          {task.comments?.length > 0 && (
            <span className="flex items-center gap-0.5 text-white/50">
              <MessageSquare className="w-3 h-3" />{task.comments.length}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1 ${overdue ? 'text-red-300 font-semibold' : 'text-white/50'}`}>
          <Clock className="w-3 h-3" />{fmtDate(task.dueDate)}
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
      className={`rounded-2xl p-3 min-h-[320px] transition-all border ${STATUS[id].col} ${
        isOver ? 'border-white/30 shadow-xl scale-[1.01]' : 'border-white/5'
      }`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${STATUS[id].dot}`} />
          <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">{STATUS[id].label}</h3>
        </div>
        <span className="text-xs text-white/40 font-medium tabular-nums">{count}</span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 stagger">
        {STATUS_ORDER.map(s => (
          <DroppableColumn key={s} id={s} count={grouped[s].length}>
            {grouped[s].map(t => <DraggableCard key={t.id} task={t} users={users} onOpen={onOpen} />)}
            {grouped[s].length === 0 && (
              <div className="text-xs text-white/25 text-center py-6">—</div>
            )}
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
// MINI CALENDAR
// ================================================================
function MiniCalendar({ markers = [], onDayClick }) {
  const [ref, setRef] = useState(new Date())
  const year = ref.getFullYear()
  const month = ref.getMonth()
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
  const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold capitalize text-white/90">
          {ref.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
        </p>
        <div className="flex gap-1">
          <button onClick={() => setRef(new Date(year, month - 1, 1))}
            className="w-7 h-7 rounded-lg glass-subtle hover:bg-white/10 flex items-center justify-center transition">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setRef(new Date(year, month + 1, 1))}
            className="w-7 h-7 rounded-lg glass-subtle hover:bg-white/10 flex items-center justify-center transition">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 mb-1.5 uppercase font-medium tracking-wider">
        {['L','M','M','J','V','S','D'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const marks = d ? markerByDay[d] : null
          return (
            <button key={i} disabled={!d}
              onClick={() => d && onDayClick?.(new Date(year, month, d), marks || [])}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-all ${
                !d ? 'invisible' :
                isToday(d) ? 'bg-white text-navy-900 font-bold shadow-lg shadow-white/20' :
                marks ? 'glass-subtle hover:bg-white/10 font-medium text-white/90' :
                'text-white/60 hover:bg-white/5'
              }`}>
              <span>{d}</span>
              {marks && !isToday(d) && (
                <div className="flex gap-0.5 mt-0.5">
                  {marks.slice(0, 3).map((mk, k) => (
                    <div key={k} className={`w-1 h-1 rounded-full ${STATUS[mk.status]?.dot}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ================================================================
// DASHBOARD
// ================================================================
function DashboardView({ me, group, users, onOpenTask, onNavigate }) {
  const [data, setData] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  async function load() {
    try { setData(await apiFetch('/dashboard')) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  if (!data) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>

  const stats = data.stats
  const cards = [
    { label: 'À faire',    value: stats.todo,        dot: 'bg-slate-400' },
    { label: 'En cours',   value: stats.in_progress, dot: 'bg-blue-400' },
    { label: 'À valider',  value: stats.review,      dot: 'bg-amber-400' },
    { label: 'En retard',  value: stats.overdue,     dot: 'bg-red-400', danger: true },
    { label: 'Terminées',  value: stats.done,        dot: 'bg-emerald-400' },
  ]

  const daysToEvent = Math.ceil((new Date('2026-11-11') - new Date()) / 86400000)

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient tracking-tight">Bonjour {me.firstName}</h1>
          <p className="text-sm text-white/50 mt-2">
            {ROLE_LABEL[me.role]}
            {group && <> · <span className="text-white/70">{group.name}</span></>}
            {group?.leaderName && <> · Chef·fe <span className="text-white/70">{group.leaderName}</span></>}
          </p>
        </div>
        <GlassCard className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Événement</p>
          <p className="text-sm font-semibold text-white/90 mt-0.5">Speed Dating · 11 nov 2026</p>
          <p className="text-xs text-white/50">Dans {daysToEvent} jours</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">
        {cards.map(c => (
          <GlassCard key={c.label} className="p-4" hover>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-medium">{c.label}</span>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${c.danger && c.value > 0 ? 'text-red-300' : 'text-white'}`}>
              {c.value}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white/90">Prochaines échéances</h2>
              <button onClick={() => onNavigate('tasks')}
                className="text-xs text-white/50 hover:text-white transition flex items-center gap-1">
                Voir tout <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {data.upcoming.length === 0 && (
                <p className="text-sm text-white/50 text-center py-8">Aucune tâche à venir · profite du calme ✨</p>
              )}
              {data.upcoming.map(t => (
                <div key={t.id} onClick={() => onOpenTask(t)}
                  className="flex items-center gap-3 p-3 rounded-xl glass-hover cursor-pointer">
                  <div className={`w-1 h-10 rounded-full ${STATUS[t.status].dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white/95 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusPill status={t.status} />
                      <span className="text-xs text-white/40">·</span>
                      <span className={`text-xs ${isOverdue(t) ? 'text-red-300 font-semibold' : 'text-white/50'}`}>
                        {fmtDate(t.dueDate)}{isOverdue(t) && ' · retard'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY[t.priority]?.cls}`}>
                    {PRIORITY[t.priority]?.label}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="font-semibold text-white/90 mb-4">Activité récente</h2>
            <div className="space-y-3">
              {data.activity.length === 0 && (
                <p className="text-sm text-white/40 text-center py-4">Aucune activité pour l'instant.</p>
              )}
              {data.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-7 h-7 rounded-full glass-subtle flex items-center justify-center shrink-0">
                    {a.action === 'validated' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> :
                     a.action === 'rejected' ? <X className="w-3.5 h-3.5 text-red-400" /> :
                     a.action === 'created' ? <Plus className="w-3.5 h-3.5 text-white/70" /> :
                     <Edit3 className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm truncate">
                      <span className="font-medium">{a.userName}</span>{' '}
                      {a.action === 'created' && 'a créé '}
                      {a.action === 'status_change' && 'a déplacé '}
                      {a.action === 'validated' && 'a validé '}
                      {a.action === 'rejected' && 'a refusé '}
                      <span className="text-white/60">"{a.taskTitle}"</span>
                      {a.action === 'status_change' && a.to && (
                        <> → <span className="text-white/90">{STATUS[a.to]?.label}</span></>
                      )}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{new Date(a.at).toLocaleString('fr-CH')}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-4">
          <MiniCalendar markers={data.calendarMarkers} onDayClick={(d, marks) => setSelectedDay({ d, marks })} />
          {selectedDay && (
            <GlassCard className="p-4 animate-scale-in">
              <p className="text-sm font-semibold text-white/90 mb-2">{fmtDateFull(selectedDay.d)}</p>
              <div className="space-y-1.5">
                {selectedDay.marks.length === 0 && <p className="text-xs text-white/40">Aucune tâche.</p>}
                {selectedDay.marks.map(m => (
                  <div key={m.taskId}
                    className="text-sm p-2 rounded-lg glass-subtle flex items-center gap-2 cursor-pointer hover:bg-white/10"
                    onClick={() => {
                      const task = data.upcoming.find(t => t.id === m.taskId)
                      if (task) onOpenTask(task)
                    }}>
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS[m.status]?.dot}`} />
                    <span className="truncate text-white/85">{m.title}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
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
      toast.success('Mis à jour')
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
      toast.success(approved ? 'Tâche validée' : 'Correction demandée')
      onUpdated(updated)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-strong border-white/10 max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS[task.status].dot}`} />
            <DialogTitle className="text-left text-white/95">{task.title}</DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/50 pt-1">
            <span>{group?.name}</span>
            <span>·</span>
            <StatusPill status={task.status} />
            <span>·</span>
            <span className={`px-2 py-0.5 rounded-full border ${PRIORITY[task.priority]?.cls}`}>{PRIORITY[task.priority]?.label}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {canEdit && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Titre</Label>
              <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                disabled={!canManage}
                className="glass-subtle border-white/10 rounded-xl" />
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wider text-white/50">Description</Label>
            <Textarea value={editing.description || ''} rows={3}
              onChange={e => setEditing({ ...editing, description: e.target.value })} disabled={!canManage}
              className="glass-subtle border-white/10 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Priorité</Label>
              <Select value={editing.priority} onValueChange={v => setEditing({ ...editing, priority: v })} disabled={!canManage}>
                <SelectTrigger className="glass-subtle border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Statut</Label>
              <Select value={editing.status} onValueChange={v => patch({ status: v })} disabled={!canEdit}>
                <SelectTrigger className="glass-subtle border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  {STATUS_ORDER.map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Début</Label>
              <Input type="date" disabled={!canManage}
                value={editing.startDate ? new Date(editing.startDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, startDate: e.target.value })}
                className="glass-subtle border-white/10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Échéance</Label>
              <Input type="date" disabled={!canManage}
                value={editing.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : ''}
                onChange={e => setEditing({ ...editing, dueDate: e.target.value })}
                className="glass-subtle border-white/10 rounded-xl" />
            </div>
          </div>

          {canManage && group && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">Assigné à</Label>
              <div className="flex flex-wrap gap-2">
                {group.members?.map(m => {
                  const on = editing.assignees?.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const set = new Set(editing.assignees || [])
                        on ? set.delete(m.id) : set.add(m.id)
                        setEditing({ ...editing, assignees: [...set] })
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                        on ? 'bg-white text-navy-900 border-white' : 'glass-subtle text-white/70 border-white/10 hover:border-white/20'
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
              <Label htmlFor="pr" className="cursor-pointer text-sm text-white/80">Preuve obligatoire pour valider</Label>
            </div>
          )}

          {canManage && (
            <Button onClick={saveEdits} disabled={saving} size="sm"
              className="bg-white text-navy-900 hover:bg-white/90 rounded-xl">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enregistrer
            </Button>
          )}

          {/* PROOFS */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="font-semibold text-sm text-white/90 mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Preuves
              {task.proofRequired && <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300 bg-amber-400/10">Obligatoire</span>}
            </h3>
            <div className="space-y-2 mb-3">
              {(task.proofs || []).map(p => (
                <div key={p.id} className="glass-subtle rounded-xl p-2.5 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-white/50" />
                  {p.fileData ? (
                    <a href={p.fileData} download={p.fileName} target="_blank" rel="noreferrer"
                      className="flex-1 truncate text-white hover:underline">{p.fileName}</a>
                  ) : (
                    <span className="flex-1 truncate text-white/80">{p.text || p.linkUrl}</span>
                  )}
                  <span className="text-xs text-white/40">par {p.userName}</span>
                </div>
              ))}
              {(!task.proofs || task.proofs.length === 0) && (
                <p className="text-xs text-white/40">Aucune preuve pour le moment.</p>
              )}
            </div>
            {canEdit && (
              <label className="inline-flex items-center gap-2 px-3 py-2 glass-subtle rounded-xl cursor-pointer hover:bg-white/10 text-sm transition">
                <Upload className="w-4 h-4" /> Ajouter une preuve
                <input type="file" className="hidden" onChange={e => uploadProof(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {/* ACTIONS */}
          <div className="border-t border-white/10 pt-4 flex flex-wrap gap-2">
            {isAssignee && task.status !== 'review' && task.status !== 'done' && (
              <Button size="sm" onClick={() => patch({ status: 'review' })}
                className="bg-white text-navy-900 hover:bg-white/90 rounded-xl">
                <CheckCheck className="w-4 h-4 mr-1" /> Passer À valider
              </Button>
            )}
            {canManage && task.status === 'review' && (
              <>
                <Button size="sm" onClick={() => validate(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                </Button>
                <Button size="sm" variant="destructive" onClick={() => validate(false)}
                  className="rounded-xl">
                  <AlertCircle className="w-4 h-4 mr-1" /> Demander correction
                </Button>
              </>
            )}
          </div>

          {/* COMMENTS */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="font-semibold text-sm text-white/90 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Commentaires ({task.comments?.length || 0})
            </h3>
            <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
              {(task.comments || []).map(c => (
                <div key={c.id} className="flex gap-2">
                  <UserAvatar user={users[c.userId]} size={24} />
                  <div className="flex-1 glass-subtle rounded-xl p-2.5">
                    <p className="text-xs font-medium text-white/90">{c.userName || users[c.userId]?.firstName}</p>
                    <p className="text-sm text-white/80 mt-0.5">{c.content}</p>
                    <p className="text-[10px] text-white/40 mt-1">{new Date(c.createdAt).toLocaleString('fr-CH')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ajouter un commentaire..." value={comment}
                onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()}
                className="glass-subtle border-white/10 rounded-xl" />
              <Button size="icon" onClick={sendComment}
                className="bg-white text-navy-900 hover:bg-white/90 rounded-xl">
                <Send className="w-4 h-4" />
              </Button>
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
      <DialogContent className="glass-strong border-white/10 max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle className="text-white/95">Nouvelle tâche</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-white/50">Titre</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Réserver la salle"
              className="glass-subtle border-white/10 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-white/50">Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="glass-subtle border-white/10 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Groupe</Label>
              <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v, assignees: [] })}>
                <SelectTrigger className="glass-subtle border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  {groups.filter(g => me.role === 'admin' || g.id === me.groupId).map(g =>
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Priorité</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger className="glass-subtle border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50">Échéance</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="glass-subtle border-white/10 rounded-xl" />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox checked={form.proofRequired} onCheckedChange={v => setForm({ ...form, proofRequired: !!v })} id="npr" />
              <Label htmlFor="npr" className="cursor-pointer text-sm text-white/80">Preuve obligatoire</Label>
            </div>
          </div>
          {selectedGroup && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">Assigner à</Label>
              <div className="flex flex-wrap gap-2">
                {selectedGroup.members?.map(m => {
                  const on = form.assignees.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        const s = new Set(form.assignees)
                        on ? s.delete(m.id) : s.add(m.id)
                        setForm({ ...form, assignees: [...s] })
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                        on ? 'bg-white text-navy-900 border-white' : 'glass-subtle text-white/70 border-white/10'
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
          <Button variant="outline" onClick={onClose} className="glass-subtle border-white/10 hover:bg-white/10 rounded-xl">Annuler</Button>
          <Button onClick={submit} disabled={saving}
            className="bg-white text-navy-900 hover:bg-white/90 rounded-xl">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      toast.success(`→ ${STATUS[newStatus].label}`)
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.error(e.message)
    }
  }

  const Pill = ({ v, active, onClick, children }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
        active ? 'bg-white text-navy-900 shadow-lg shadow-white/10' : 'text-white/60 hover:text-white'
      }`}>{children}</button>
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gradient tracking-tight">Mes tâches</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="glass rounded-full p-1 flex">
            <Pill active={scope === 'mine'} onClick={() => setScope('mine')}>À moi</Pill>
            <Pill active={scope === 'group'} onClick={() => setScope('group')}>Groupe</Pill>
            {(me.role === 'admin' || me.role === 'teacher') && (
              <Pill active={scope === 'visible'} onClick={() => setScope('visible')}>Tout</Pill>
            )}
          </div>
          <div className="glass rounded-full p-1 flex">
            <Pill active={view === 'kanban'} onClick={() => setView('kanban')}>Kanban</Pill>
            <Pill active={view === 'list'} onClick={() => setView('list')}>Liste</Pill>
          </div>
        </div>
      </div>

      {view === 'kanban' && (
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      )}
      {view === 'list' && (
        <GlassCard className="divide-y divide-white/5 overflow-hidden">
          {tasks.length === 0 && <div className="p-10 text-center text-sm text-white/40">Aucune tâche.</div>}
          {tasks.map(t => (
            <div key={t.id} onClick={() => onOpenTask(t)}
              className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition">
              <div className={`w-1 h-10 rounded-full ${STATUS[t.status].dot}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-white/95">{t.title}</p>
                <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                  <StatusPill status={t.status} />
                  <span>·</span>
                  <span className={isOverdue(t) ? 'text-red-300 font-medium' : ''}>{fmtDate(t.dueDate)}</span>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
              <div className="flex -space-x-1.5">
                {(t.assignees || []).slice(0, 3).map(id => <UserAvatar key={id} user={users[id]} size={22} ring />)}
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  )
}

// ================================================================
// GROUP VIEW
// ================================================================
function GroupView({ me, users, onOpenTask, refreshKey, groupId }) {
  const [group, setGroup] = useState(null)
  const gid = groupId || me.groupId

  async function load() {
    if (!gid) return
    try { setGroup(await apiFetch(`/groups/${gid}`)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [gid, refreshKey])

  if (!gid) return <div className="text-center py-16 text-white/50">Vous n'êtes dans aucun groupe.</div>
  if (!group) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/40" /></div>

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
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient tracking-tight">{group.name}</h1>
        <p className="text-sm text-white/50 mt-2">
          Chef·fe · <span className="text-white/80">{group.leader?.firstName}</span> · {group.members?.length} membres
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 stagger">
        <GlassCard className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Progression</span>
            <span className="text-lg font-bold tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/40 mt-2">{doneCount} / {tasks.length} tâches terminées</p>
        </GlassCard>
        <GlassCard className="p-5">
          <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Ouvertes</span>
          <p className="text-3xl font-bold mt-1 tabular-nums">{tasks.filter(t => t.status !== 'done').length}</p>
        </GlassCard>
        <GlassCard className="p-5">
          <span className="text-xs uppercase tracking-wider text-white/50 font-medium">En retard</span>
          <p className={`text-3xl font-bold mt-1 tabular-nums ${tasks.filter(isOverdue).length > 0 ? 'text-red-300' : ''}`}>
            {tasks.filter(isOverdue).length}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-white/90 mb-3">Membres</h2>
        <div className="flex flex-wrap gap-3">
          {group.members?.map(m => (
            <div key={m.id} className="flex items-center gap-2.5 pr-3 pl-1 py-1 glass-subtle rounded-full">
              <UserAvatar user={m} size={32} ring />
              <div className="pr-1">
                <p className="text-sm font-medium leading-tight">{m.firstName} {m.id === group.leaderId && <span className="text-amber-300">·</span>}</p>
                <p className="text-[10px] text-white/50 leading-tight">{ROLE_LABEL[m.role]}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div>
        <h2 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-3">Kanban du groupe</h2>
        <KanbanBoard tasks={tasks} users={users} onOpen={onOpenTask} onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
}

// ================================================================
// VALIDATION VIEW
// ================================================================
function ValidationView({ users, groups, onOpenTask, refreshKey }) {
  const [tasks, setTasks] = useState([])
  async function load() { try { setTasks(await apiFetch('/validation-queue')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [refreshKey])

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient tracking-tight">Validation</h1>
        <p className="text-sm text-white/50 mt-2">Tâches en attente d'approbation</p>
      </div>
      {tasks.length === 0 && (
        <GlassCard className="p-12 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-white/30 mb-3" />
          <p className="text-white/60">Aucune tâche à valider</p>
        </GlassCard>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
        {tasks.map(t => {
          const g = groups.find(gr => gr.id === t.groupId)
          return (
            <GlassCard key={t.id} className="p-5 cursor-pointer" hover onClick={() => onOpenTask(t)}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-white/95">{t.title}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full glass-subtle text-white/70">{g?.name}</span>
              </div>
              <p className="text-xs text-white/50">Échéance {fmtDate(t.dueDate)}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex -space-x-1.5">
                  {(t.assignees || []).map(id => <UserAvatar key={id} user={users[id]} size={24} ring />)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <Paperclip className={`w-3 h-3 ${t.proofs?.length ? 'text-emerald-400' : 'text-amber-400'}`} />
                  {t.proofs?.length || 0} preuve(s)
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================
// GROUPS OVERVIEW (admin)
// ================================================================
function AllGroupsView({ groups, onOpenGroup }) {
  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient tracking-tight">Tous les groupes</h1>
        <p className="text-sm text-white/50 mt-2">Vue d'ensemble des équipes</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {groups.map(g => (
          <GlassCard key={g.id} className="p-5 cursor-pointer" hover onClick={() => onOpenGroup(g.id)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white/95">{g.name}</h3>
              <ArrowRight className="w-4 h-4 text-white/40" />
            </div>
            <p className="text-xs text-white/50 mb-3">Chef·fe · {g.leader?.firstName}</p>
            <div className="flex -space-x-2">
              {g.members?.map(m => <UserAvatar key={m.id} user={m} size={30} ring />)}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <WhatodoMark size={56} />
        <Loader2 className="animate-spin text-white/30" />
      </div>
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
    // Placeholder soon
    { key: 'calendar', label: 'Calendrier', icon: CalIcon, soon: true },
    { key: 'gantt', label: 'Gantt', icon: GanttChart, soon: true },
    { key: 'chat', label: 'Chat', icon: MessageSquare, soon: true },
    { key: 'notifs', label: 'Notifications', icon: Bell, soon: true },
  ].filter(n => !n.hidden)

  function goto(k) {
    setView(k); setSidebarOpen(false); setViewGroupId(null)
  }

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center gap-3 border-b border-white/5">
        <WhatodoMark size={36} />
        <div>
          <p className="font-bold text-white/95 tracking-tight leading-tight">Whatodo</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Task & team</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(n => (
          <button key={n.key}
            onClick={() => !n.soon && goto(n.key)}
            disabled={n.soon}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
              view === n.key
                ? 'bg-white text-navy-900 font-semibold shadow-lg shadow-black/20'
                : n.soon ? 'text-white/25 cursor-not-allowed' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}>
            <n.icon className="w-4 h-4" />
            <span className="flex-1 text-left">{n.label}</span>
            {n.soon && <span className="text-[9px] uppercase tracking-widest text-white/30">Soon</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="glass-subtle rounded-xl p-2.5 flex items-center gap-2.5">
          <UserAvatar user={me} size={36} ring />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-white/95">{me.firstName}</p>
            <p className="text-[10px] text-white/50 truncate uppercase tracking-wider">{ROLE_LABEL[me.role]}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex-1 glass-subtle rounded-xl h-9 flex items-center justify-center hover:bg-white/10 transition">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={logout}
            className="flex-1 glass-subtle rounded-xl h-9 flex items-center justify-center hover:bg-white/10 transition text-white/80">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const currentView = (() => {
    switch (view) {
      case 'dashboard': return <DashboardView me={me} group={group} users={users} onOpenTask={openTask} onNavigate={goto} />
      case 'tasks': return <TasksView me={me} users={users} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'group': return <GroupView me={me} users={users} onOpenTask={openTask} refreshKey={refreshKey} groupId={viewGroupId} />
      case 'validation': return <ValidationView users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'admin_groups': return <AllGroupsView groups={groups} onOpenGroup={gid => { setViewGroupId(gid); setView('group') }} />
      default: return (
        <div className="animate-fade-up">
          <GlassCard className="p-12 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-white/30 mb-3" />
            <h2 className="text-xl font-semibold mb-1">Bientôt disponible</h2>
            <p className="text-sm text-white/50">Cette section arrive dans la prochaine étape de la roadmap.</p>
          </GlassCard>
        </div>
      )
    }
  })()

  const bottomNav = NAV.filter(n => !n.soon).slice(0, 4)

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 fixed inset-y-4 left-4 glass-strong rounded-3xl z-30 overflow-hidden">
        {Sidebar}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-4 left-4 w-72 glass-strong rounded-3xl z-50 md:hidden animate-scale-in overflow-hidden">
            {Sidebar}
          </aside>
        </>
      )}

      <main className="flex-1 md:ml-72 min-w-0 pb-24 md:pb-8">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 px-4 pt-4">
          <div className="glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
            <button onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-xl glass-subtle flex items-center justify-center hover:bg-white/10 transition">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <WhatodoMark size={22} />
              <p className="font-semibold text-sm">Whatodo</p>
            </div>
            <button onClick={() => setCreateOpen(true)}
              className="w-9 h-9 rounded-xl bg-white text-navy-900 flex items-center justify-center shadow-lg shadow-white/10">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="hidden md:flex justify-end mb-6">
            <Button onClick={() => setCreateOpen(true)}
              className="bg-white text-navy-900 hover:bg-white/90 rounded-xl shadow-lg shadow-black/20 h-10 px-5 font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> Nouvelle tâche
            </Button>
          </div>
          {currentView}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-4 inset-x-4 z-30">
          <div className="glass-strong rounded-2xl flex justify-around p-1.5">
            {bottomNav.map(n => (
              <button key={n.key} onClick={() => goto(n.key)}
                className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 rounded-xl transition ${
                  view === n.key ? 'bg-white text-navy-900' : 'text-white/60'
                }`}>
                <n.icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{n.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </main>

      <TaskDialog task={taskOpen} open={!!taskOpen} onClose={() => setTaskOpen(null)}
        me={me} users={users} groups={groups} onUpdated={taskUpdated} />
      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)}
        me={me} groups={groups} onCreated={() => refresh()} />
    </div>
  )
}
