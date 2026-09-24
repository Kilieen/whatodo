'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { apiFetch, getToken, getWorkspaceId } from '@/lib/api-client'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCorners
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  LayoutDashboard, ListChecks, Users, MessageSquare, Calendar as CalIcon,
  Bell, LogOut, Moon, Sun, Plus, ChevronLeft, ChevronRight, Menu, X,
  Clock, CheckCircle2, AlertCircle, Paperclip, Send, CheckCheck,
  Upload, FileText, Edit3, Loader2, Shield, Search, BarChart3, Settings,
  User as UserIcon, ArrowUpRight, GanttChart, MoreHorizontal, Filter, Trash2,
  Eye, EyeOff, Camera, Globe, Bell as BellIcon, Lock, LogIn, MoveRight, Copy,
  Info, Archive, Crown, Activity, Trash, DoorOpen, HelpCircle, Sparkles
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
function LoadError({ error, onRetry }) {
  return <div role="alert" className="surface p-6 text-center space-y-3"><p className="text-sm text-2">{error?.message || 'Chargement impossible.'}</p><button className="btn-ghost rounded-xl px-4 py-2 text-sm" onClick={onRetry}>Réessayer</button></div>
}

function useApiData(path, refreshKey = 0) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    setLoading(true); setError(null)
    apiFetch(path).then(value => { if (current) setData(value) }).catch(e => { if (current) setError(e) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [path, refreshKey, attempt])
  return { data, error, loading, retry: () => setAttempt(n => n + 1) }
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

const ROLE_LABEL = { owner: 'Propriétaire', member: 'Membre', viewer: 'Lecture seule', admin: 'Administrateur', leader: 'Chef de groupe', student: 'Élève', teacher: 'Enseignant' }

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
      <span className={`dot ${(STATUS[status] || STATUS.todo).dot}`} />
      {withLabel && (STATUS[status] || STATUS.todo).label}
    </span>
  )
}

// ================================================================
// LOGIN
// ================================================================
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState(null)

  async function submitLogin(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('whatodo_token', data.token)
      onLogin(data)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function submitSignup(e) {
    e?.preventDefault()
    if (!firstName.trim()) return toast.error('Prénom requis')
    if (password.length < 8) return toast.error('Mot de passe : min. 8 caractères')
    if (password !== password2) return toast.error('Les mots de passe ne correspondent pas')
    setLoading(true)
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName }),
      })
      localStorage.setItem('whatodo_token', data.token)
      toast.success(`Bienvenue ${data.user.firstName}`)
      onLogin(data)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function submitForgot(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const r = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
      setInfo(r.message)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const input = "w-full h-11 px-4 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-white placeholder:text-3 focus:outline-none focus:border-white/25 transition"

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm anim-fade-up">
        <div className="flex flex-col items-center mb-10">
          <WhatodoLogo size={64} stroke="#ffffff" className="mb-6 opacity-95" />
          <h1 className="text-4xl font-bold tracking-tight">Whatodo</h1>
          <p className="text-sm text-2 mt-2">Organisez. Collaborez. Avancez.</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={submitLogin} className="space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={input} />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className={input + ' pr-11'} />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-3 hover:text-white transition" tabIndex={-1}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl btn-primary text-sm">
              {loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Se connecter'}
            </button>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setMode('forgot'); setInfo(null) }} className="text-[12px] text-3 hover:text-white transition">Mot de passe oublié ?</button>
              <button type="button" onClick={() => setMode('signup')} className="text-[12px] text-white/80 hover:text-white transition">Créer un compte →</button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={submitSignup} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} required autoComplete="given-name" className={input} />
              <input placeholder="Nom (optionnel)" value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" className={input} />
            </div>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={input} />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} placeholder="Mot de passe (8 caractères min.)" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" className={input + ' pr-11'} />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-3 hover:text-white transition" tabIndex={-1}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input type={showPwd ? 'text' : 'password'} placeholder="Confirmer le mot de passe" value={password2} onChange={e => setPassword2(e.target.value)} required autoComplete="new-password" className={input} />
            {password && password2 && password !== password2 && <p className="text-[11px] text-red-400">Les mots de passe ne correspondent pas</p>}
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl btn-primary text-sm">
              {loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Créer mon compte'}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => setMode('login')} className="text-[12px] text-3 hover:text-white transition">← Déjà un compte ? Se connecter</button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={submitForgot} className="space-y-3">
            <p className="text-[13px] text-2 leading-relaxed">Entrez l'email de votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.</p>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={input} />
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl btn-primary text-sm">
              {loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Envoyer le lien'}
            </button>
            {info && <p className="text-[12px] text-white/80 bg-white/[0.05] border border-white/10 rounded-xl p-3 leading-relaxed">{info}</p>}
            <div className="text-center pt-1">
              <button type="button" onClick={() => setMode('login')} className="text-[12px] text-3 hover:text-white transition">← Retour</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ================================================================
// TASK CARD (compact)
// ================================================================
function TaskCard({ task, users, onOpen, isDragging, isOverlay }) {
  const assignees = (task.assignees || []).map(id => users[id]).filter(Boolean)
  const overdue = isOverdue(task)
  return (
    <div
      onClick={onOpen ? (e) => { e.stopPropagation(); onOpen(task) } : undefined}
      className={`group rounded-xl border p-3 transition-colors
        ${isOverlay
          ? 'border-white/25 bg-[color:var(--w-surface-2)] shadow-2xl cursor-grabbing'
          : 'border-[color:var(--w-border)] bg-[color:var(--w-surface)] cursor-pointer hover:border-white/15 hover:bg-[color:var(--w-surface-2)]'
        }
        ${isDragging && !isOverlay ? 'opacity-0' : ''}`}>
      <div className="flex items-start gap-2 mb-3">
        <span className={`dot ${(STATUS[task.status] || STATUS.todo).dot} mt-1.5`} />
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
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <TaskCard task={task} users={users} onOpen={onOpen} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({ id, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}
      className={`rounded-2xl p-3 min-h-[320px] transition-colors border ${
        isOver ? 'border-white/25 bg-white/[0.02]' : 'border-transparent'
      }`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`dot ${(STATUS[id] || STATUS.todo).dot}`} />
          <h3 className="text-[13px] font-semibold text-white">{(STATUS[id] || STATUS.todo).label}</h3>
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
  const [overlayWidth, setOverlayWidth] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const grouped = useMemo(() => {
    const g = { todo: [], in_progress: [], review: [], blocked: [], done: [] }
    for (const t of tasks) if (g[t.status]) g[t.status].push(t)
    return g
  }, [tasks])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      modifiers={[snapCenterToCursor]}
      onDragStart={e => {
        setActiveTask(e.active.data.current?.task)
        // Measure the source card width for the overlay
        const node = e.active.rect?.current?.initial
        if (node?.width) setOverlayWidth(node.width)
      }}
      onDragCancel={() => { setActiveTask(null); setOverlayWidth(null) }}
      onDragEnd={e => {
        setActiveTask(null); setOverlayWidth(null)
        const overId = e.over?.id
        const task = e.active.data.current?.task
        if (overId && task && overId !== task.status) onStatusChange?.(task, overId)
      }}>
      <div className="kanban-scroll">
        {STATUS_ORDER.map(s => (
          <DroppableColumn key={s} id={s} count={grouped[s].length}>
            {grouped[s].map(t => <DraggableCard key={t.id} task={t} users={users} onOpen={onOpen} />)}
            {grouped[s].length === 0 && <div className="text-xs text-3 text-center py-4">—</div>}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay dropAnimation={null} zIndex={9999}>
        {activeTask ? (
          <div style={{ width: overlayWidth ? `${overlayWidth}px` : undefined, pointerEvents: 'none' }}>
            <TaskCard task={activeTask} users={users} isOverlay />
          </div>
        ) : null}
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
  const { data, error, loading, retry } = useApiData('/dashboard')
  const [taskFilter, setTaskFilter] = useState('today') // today | week | all
  const [selectedDay, setSelectedDay] = useState(null)

  if (error) return <LoadError error={error} onRetry={retry} />
  if (loading || !data) return <div className="p-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>

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
                <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot} mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium leading-snug">{t.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-3 mt-1">
                    <span>{(STATUS[t.status] || STATUS.todo).label}</span>
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


    </div>
  )
}

// ================================================================
// TASKS VIEW
// ================================================================
function TasksView({ me, users, onOpenTask, refreshKey }) {
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('kanban')
  const [scope, setScope] = useState('mine')

  async function load() {
    setError(null)
    try { setTasks(await apiFetch(`/tasks?scope=${scope}`)) } catch (e) { setError(e) }
  }
  useEffect(() => { load() }, [scope, refreshKey])

  async function handleStatusChange(task, newStatus) {
    if (me.role === 'viewer' || me.readOnly) return toast.error('Accès en lecture seule')
    if (newStatus === 'done' && !['owner', 'admin', 'leader'].includes(me.role)) return toast.error('La validation appartient au responsable')
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
      {error && <LoadError error={error} onRetry={load} />}
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
              <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate">{t.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-3 mt-0.5">
                  <span>{(STATUS[t.status] || STATUS.todo).label}</span>
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
  const [error, setError] = useState(null)
  const gid = groupId || me.groupId

  async function load() {
    if (!gid) return
    setError(null)
    try { setGroup(await apiFetch(`/groups/${gid}`)) } catch (e) { setError(e) }
  }
  useEffect(() => { load() }, [gid, refreshKey])

  if (!gid) return <div className="text-center py-16 text-2">Vous n'êtes dans aucun groupe.</div>
  if (error) return <LoadError error={error} onRetry={load} />
  if (!group) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>

  const tasks = group.tasks || []
  const doneCount = tasks.filter(t => t.status === 'done').length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
  const openCount = tasks.filter(t => t.status !== 'done').length
  const overdueCount = tasks.filter(isOverdue).length

  async function handleStatusChange(task, newStatus) {
    if (me.role === 'viewer' || me.readOnly) return toast.error('Accès en lecture seule')
    if (newStatus === 'done' && !['owner', 'admin', 'leader'].includes(me.role)) return toast.error('La validation appartient au responsable')
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
  const { data, error, loading, retry } = useApiData('/validation-queue', refreshKey)
  const tasks = data || []
  if (error) return <LoadError error={error} onRetry={retry} />
  if (loading) return <div className="p-12">Chargement…</div>

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

function AllGroupsView({ groups, users, canManage, onRefresh, onOpenGroup }) {
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const people = Object.values(users)
  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      await apiFetch(editing.id ? `/groups/${editing.id}` : '/groups', { method: editing.id ? 'PATCH' : 'POST', body: JSON.stringify({ name: editing.name, description: editing.description || '', leaderId: editing.leaderId || null, memberIds: editing.memberIds }) })
      setEditing(null); await onRefresh(); toast.success('Groupe enregistré')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function remove(group) {
    if (!window.confirm(`Supprimer le groupe « ${group.name} » ? Ses salons seront archivés et leurs messages conservés. Les groupes contenant des tâches ne peuvent pas être supprimés.`)) return
    setSaving(true)
    try { await apiFetch(`/groups/${group.id}`, { method: 'DELETE' }); await onRefresh(); toast.success('Groupe supprimé') }
    catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  return <div className="space-y-5 anim-fade-up">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-2 mb-1">Espace de travail</p><h1 className="t-h1">Groupes</h1></div>
      {canManage && <button className="btn-primary rounded-full h-9 px-4 text-sm" onClick={() => setEditing({ name: '', description: '', leaderId: '', memberIds: [] })}>+ Nouveau groupe</button>}
    </div>
    {!groups.length && <div className="surface p-10 text-center text-2">Aucun groupe dans cet espace.</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{groups.map(g => <div key={g.id} className="surface p-5">
      <button className="w-full text-left" onClick={() => onOpenGroup(g.id)}><div className="flex justify-between mb-3"><h3 className="t-h2">{g.name}</h3><ArrowUpRight className="w-4 h-4 text-3" /></div>
        <p className="text-xs text-3 mb-4">Chef·fe · {g.leader?.firstName || 'Non assigné'}</p><div className="flex -space-x-2">{g.members?.map(m => <UserAvatar key={m.id} user={m} size={28} />)}</div></button>
      {canManage && <div className="flex gap-3 mt-4"><button className="btn-ghost rounded-lg px-3 py-1 text-sm" onClick={() => setEditing({ ...g, memberIds: (g.members || []).map(m => m.id) })}>Modifier</button><button disabled={saving} className="text-red-300 text-sm" onClick={() => remove(g)}>Supprimer</button></div>}
    </div>)}</div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !saving) setEditing(null) }}><DialogContent><DialogHeader><DialogTitle>{editing?.id ? 'Modifier le groupe' : 'Nouveau groupe'}</DialogTitle></DialogHeader>
      {editing && <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">Nom<Input required maxLength={60} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
        <label className="block text-sm">Description<Textarea maxLength={300} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
        <label className="block text-sm">Leader<select aria-label="Leader" className="w-full bg-[color:var(--w-surface)] border rounded-lg p-2" value={editing.leaderId || ''} onChange={e => setEditing({ ...editing, leaderId: e.target.value, memberIds: [...new Set([...editing.memberIds, e.target.value].filter(Boolean))] })}><option value="">Aucun leader</option>{people.filter(u => ['owner','admin','leader','member'].includes(u.workspaceRole)).map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</select></label>
        <fieldset className="max-h-52 overflow-auto space-y-2"><legend className="text-sm mb-2">Membres</legend>{people.map(u => <label key={u.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.memberIds.includes(u.id)} onChange={e => setEditing({ ...editing, memberIds: e.target.checked ? [...editing.memberIds, u.id] : editing.memberIds.filter(id => id !== u.id), leaderId: !e.target.checked && editing.leaderId === u.id ? null : editing.leaderId })} />{u.firstName} {u.lastName}</label>)}</fieldset>
        <p className="text-xs text-3">Une personne appartient à un seul groupe. L’ajouter ici la retire de son groupe précédent. Choisir un membre comme leader lui attribue le rôle Chef.</p>
        <button disabled={saving} className="btn-primary rounded-xl px-4 py-2 text-sm">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>}
    </DialogContent></Dialog>
  </div>
}

function ChannelEditor({ channel, users, groups, onClose, onSaved }) {
  const [form, setForm] = useState(channel || { name: '', type: 'workspace', groupId: '', memberIds: [] })
  const [saving, setSaving] = useState(false)
  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      const body = channel ? { name: form.name, ...(form.type === 'private' ? { memberIds: form.memberIds || [] } : {}) } : { ...form, groupId: form.groupId || null }
      const value = await apiFetch(channel ? `/channels/${channel.id}` : '/channels', { method: channel ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      await onSaved(value); onClose()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}><DialogContent><DialogHeader><DialogTitle>{channel ? 'Modifier le salon' : 'Nouveau salon'}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm">Nom<Input required maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      {!channel && <label className="block text-sm">Type<select aria-label="Type" className="w-full bg-[color:var(--w-surface)] border rounded-lg p-2" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="workspace">Tout l’espace</option><option value="group">Groupe</option><option value="private">Privé</option></select></label>}
      {form.type === 'group' && !channel && <label className="block text-sm">Groupe<select aria-label="Groupe" required className="w-full bg-[color:var(--w-surface)] border rounded-lg p-2" value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}><option value="">Choisir un groupe</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
      {form.type === 'private' && <fieldset className="max-h-52 overflow-auto space-y-2"><legend className="text-sm mb-2">Membres autorisés</legend>{Object.values(users).map(u => <label key={u.id} className="flex gap-2 text-sm"><input type="checkbox" checked={(form.memberIds || []).includes(u.id)} onChange={e => setForm({ ...form, memberIds: e.target.checked ? [...(form.memberIds || []), u.id] : form.memberIds.filter(id => id !== u.id) })} />{u.firstName} {u.lastName}</label>)}<p className="text-xs text-3">Les owners et admins conservent un accès de gestion.</p></fieldset>}
      <button disabled={saving} className="btn-primary rounded-xl px-4 py-2 text-sm">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  </DialogContent></Dialog>
}

// ================================================================
// TASK DIALOG
// ================================================================
function TaskDialog({ task, open, onClose, me, users, groups, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setEditing(task ? { ...task } : null); setComment(''); setConfirmDelete(false) }, [task])
  if (!task || !editing) return null

  const group = groups.find(g => g.id === task.groupId)
  const canManage = !me.readOnly && (['owner','admin'].includes(me.role) || (me.role === 'leader' && group?.leaderId === me.id))
  const isAssignee = task.assignees?.includes(me.id)
  const isCreator = task.createdBy === me.id
  const canEdit = !me.readOnly && me.role !== 'viewer' && (canManage || isAssignee)
  const canDelete = !me.readOnly && me.role !== 'viewer' && (canManage || isCreator)

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
      proofRequired: editing.proofRequired, groupId: editing.groupId || null,
    })
  }

  async function sendComment() {
    if (me.role === 'viewer' || me.readOnly) return
    if (!comment.trim()) return
    try {
      const c = await apiFetch(`/tasks/${task.id}/comments`, { method: 'POST', body: JSON.stringify({ content: comment }) })
      onUpdated({ ...task, comments: [...(task.comments || []), c] })
      setComment('')
    } catch (e) { toast.error(e.message) }
  }

  async function uploadProof(file) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Fichier max 2 Mo'); return }
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

  async function deleteTask() {
    try {
      await apiFetch(`/tasks/${task.id}`, { method: 'DELETE' })
      toast.success('Tâche supprimée')
      onDeleted?.(task)
      onClose()
    } catch (e) { toast.error(e.message); setConfirmDelete(false) }
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
                  {STATUS_ORDER.filter(k => canManage || k !== 'done').map(k => <SelectItem key={k} value={k}>{(STATUS[k] || STATUS.todo).label}</SelectItem>)}
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

          {canManage && ['owner', 'admin'].includes(me.role) && (
            <label className={labelCls}>Groupe
              <select aria-label="Groupe de la tâche" className={inputCls} value={editing.groupId || ''} onChange={e => setEditing({ ...editing, groupId: e.target.value || null })}>
                <option value="">Sans groupe (créateur et personnes assignées)</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
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
          <div className="flex flex-wrap gap-2 items-center">
            {canEdit && isAssignee && task.status !== 'review' && task.status !== 'done' && (
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
            {canDelete && (
              <button onClick={() => setConfirmDelete(true)}
                className="h-9 px-3 rounded-xl text-red-300/80 hover:text-red-200 hover:bg-red-500/10 text-sm inline-flex items-center gap-1 transition ml-auto">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            )}
          </div>

          {confirmDelete && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/[0.05] anim-scale">
              <p className="text-sm font-medium text-red-200 mb-1">Supprimer cette tâche ?</p>
              <p className="text-[12px] text-2 mb-3">
                La tâche sera déplacée dans la corbeille. Un Owner ou Admin pourra la restaurer.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="h-9 px-4 rounded-xl btn-ghost text-sm">Annuler</button>
                <button onClick={deleteTask}
                  className="h-9 px-4 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium transition inline-flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            </div>
          )}

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
              <button disabled={me.role === 'viewer' || me.readOnly} onClick={sendComment}
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
// GANTT VIEW — interactive (drag + resize)
// ================================================================
function GanttBar({ t, x, w, rowHeight, dayWidth, canManage, done, status, onCommit, onOpen }) {
  const [drag, setDrag] = useState(null) // { mode: 'move'|'resize-l'|'resize-r', startX, x0, w0 }
  const [preview, setPreview] = useState({ x, w })
  useEffect(() => { setPreview({ x, w }) }, [x, w])

  function onDown(mode) {
    return (e) => {
      if (!canManage) return
      e.preventDefault(); e.stopPropagation()
      const startX = e.clientX ?? e.touches?.[0]?.clientX
      setDrag({ mode, startX, x0: x, w0: w })
    }
  }
  useEffect(() => {
    if (!drag) return
    function move(e) {
      const cx = e.clientX ?? e.touches?.[0]?.clientX
      const dx = cx - drag.startX
      if (drag.mode === 'move') setPreview({ x: drag.x0 + dx, w: drag.w0 })
      else if (drag.mode === 'resize-l') setPreview({ x: drag.x0 + dx, w: Math.max(dayWidth, drag.w0 - dx) })
      else if (drag.mode === 'resize-r') setPreview({ x: drag.x0, w: Math.max(dayWidth, drag.w0 + dx) })
    }
    function up() {
      // Snap to day
      const snap = (v) => Math.round(v / dayWidth) * dayWidth
      const nx = snap(preview.x)
      const nw = Math.max(dayWidth, snap(preview.w))
      setPreview({ x: nx, w: nw })
      onCommit({ x: nx, w: nw, mode: drag.mode })
      setDrag(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [drag, preview, dayWidth, onCommit])

  return (
    <div
      onMouseDown={onDown('move')}
      onTouchStart={onDown('move')}
      onClick={(e) => { if (!drag) onOpen() }}
      className={`absolute top-2 rounded-md border transition-shadow overflow-hidden group ${canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${drag ? 'shadow-2xl ring-1 ring-white/40 z-10' : ''}`}
      style={{
        left: preview.x, width: preview.w, height: rowHeight - 16,
        background: done ? 'rgba(52,211,153,0.22)' : 'rgba(96,165,250,0.2)',
        borderColor: done ? 'rgba(52,211,153,0.5)' : 'rgba(96,165,250,0.45)',
        userSelect: 'none',
      }}
      title={t.title}>
      {canManage && (
        <div onMouseDown={onDown('resize-l')} onTouchStart={onDown('resize-l')}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 transition" />
      )}
      <div className="h-full flex items-center px-2 gap-1.5 text-[11px] text-white/95 whitespace-nowrap pointer-events-none">
        <span className={`dot ${(STATUS[status] || STATUS.todo).dot} shrink-0`} />
        <span className="truncate font-medium">{t.title}</span>
      </div>
      {canManage && (
        <div onMouseDown={onDown('resize-r')} onTouchStart={onDown('resize-r')}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 transition" />
      )}
    </div>
  )
}

function GanttView({ me, users, groups, onOpenTask, refreshKey }) {
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState('week') // day | week | month
  const [tick, setTick] = useState(0)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const t = await apiFetch('/tasks?scope=' + (['owner','admin','teacher'].includes(me.role) ? 'visible' : 'group'))
      setTasks(t.filter(x => x.startDate && x.dueDate))
    } catch (e) { setError(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const { minD, maxD, dayWidth, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date(); const later = new Date(now); later.setMonth(later.getMonth() + 2)
      return { minD: now, maxD: later, dayWidth: zoom === 'day' ? 40 : zoom === 'week' ? 20 : 8, totalDays: 60 }
    }
    let min = new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime())))
    let max = new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())))
    min.setDate(min.getDate() - 2); max.setDate(max.getDate() + 4)
    min.setHours(0,0,0,0); max.setHours(23,59,59,999)
    const days = Math.ceil((max - min) / 86400000)
    return { minD: min, maxD: max, dayWidth: zoom === 'day' ? 50 : zoom === 'week' ? 20 : 8, totalDays: days }
  }, [tasks, zoom, tick])

  const rowHeight = 44
  const totalWidth = totalDays * dayWidth
  const today = new Date(); today.setHours(0,0,0,0)
  const todayOffset = ((today - minD) / 86400000) * dayWidth

  function daysToX(date) { return ((new Date(date) - minD) / 86400000) * dayWidth }
  function daysToWidth(start, end) { return Math.max(dayWidth, ((new Date(end) - new Date(start)) / 86400000) * dayWidth) }

  function canManageTask(t) {
    if (me.readOnly) return false
    if (['owner','admin'].includes(me.role)) return true
    const g = groups.find(gr => gr.id === t.groupId)
    if (me.role === 'leader' && g?.leaderId === me.id) return true
    return false
  }

  async function commitBar(t, { x, w, mode }) {
    const newStart = new Date(minD.getTime() + (x / dayWidth) * 86400000)
    const newEnd = new Date(minD.getTime() + ((x + w) / dayWidth) * 86400000)
    const payload = {}
    if (mode === 'move') { payload.startDate = newStart; payload.dueDate = newEnd }
    else if (mode === 'resize-l') payload.startDate = newStart
    else if (mode === 'resize-r') payload.dueDate = newEnd
    // Optimistic update
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...payload } : x))
    try {
      await apiFetch(`/tasks/${t.id}/dates`, { method: 'PATCH', body: JSON.stringify(payload) })
    } catch (e) {
      toast.error(e.message)
      load()
    }
  }

  // Header ticks
  const ticks = []
  const cur = new Date(minD)
  while (cur <= maxD) {
    ticks.push(new Date(cur))
    if (zoom === 'day') cur.setDate(cur.getDate() + 1)
    else if (zoom === 'week') cur.setDate(cur.getDate() + 7)
    else { cur.setMonth(cur.getMonth() + 1); cur.setDate(1) }
  }

  return (
    <div className="space-y-5 anim-fade-up">
      {error && <LoadError error={error} onRetry={load} />}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Chronologie</p>
          <h1 className="t-h1">Gantt</h1>
          <p className="text-sm text-2 mt-2">{tasks.length} tâche(s) affichée(s) · glissez les barres pour ajuster les dates</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="pill-group">
            <button className={`pill ${zoom === 'day' ? 'pill-active' : ''}`} onClick={() => setZoom('day')}>Jour</button>
            <button className={`pill ${zoom === 'week' ? 'pill-active' : ''}`} onClick={() => setZoom('week')}>Semaine</button>
            <button className={`pill ${zoom === 'month' ? 'pill-active' : ''}`} onClick={() => setZoom('month')}>Mois</button>
          </div>
          <button onClick={() => { const el = document.getElementById('gantt-scroll'); if (el) el.scrollLeft = Math.max(0, todayOffset - 200) }}
            className="h-9 px-3 rounded-full btn-ghost text-[12.5px]">Aujourd'hui</button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>
      ) : tasks.length === 0 ? (
        <div className="surface p-12 text-center">
          <GanttChart className="w-8 h-8 mx-auto text-white/25 mb-2" />
          <p className="text-sm text-2">Aucune tâche avec dates.</p>
          <p className="text-[12px] text-3 mt-1">Créez une tâche avec une date de début et une échéance pour la voir apparaître.</p>
        </div>
      ) : (
        <div className="surface p-0 overflow-hidden">
          <div id="gantt-scroll" className="overflow-x-auto">
            <div style={{ width: Math.max(800, totalWidth + 240) }}>
              {/* Header */}
              <div className="flex border-b border-[color:var(--w-border)]">
                <div className="w-[240px] shrink-0 px-4 py-2 text-[11px] uppercase text-3 font-medium border-r border-[color:var(--w-border)]">Tâche</div>
                <div className="relative flex-1" style={{ height: 32 }}>
                  {ticks.map((t, i) => (
                    <div key={i} style={{ left: daysToX(t), position: 'absolute', top: 0, height: '100%' }}
                      className="border-l border-[color:var(--w-border)] pl-1.5 pt-1.5 text-[10px] text-3">
                      {zoom === 'day' ? t.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
                        : zoom === 'week' ? `S${Math.ceil(t.getDate() / 7)} ${t.toLocaleDateString('fr-CH', { month: 'short' })}`
                        : t.toLocaleDateString('fr-CH', { month: 'long', year: '2-digit' })}
                    </div>
                  ))}
                  {/* today line */}
                  <div style={{ left: todayOffset, position: 'absolute', top: 0, height: '100%' }}
                    className="w-px bg-white/30" />
                </div>
              </div>
              {/* Rows */}
              <div className="relative">
                {tasks.map((t) => {
                  const x = daysToX(t.startDate)
                  const w = daysToWidth(t.startDate, t.dueDate)
                  const g = groups.find(gr => gr.id === t.groupId)
                  const done = t.status === 'done'
                  const canManage = canManageTask({ ...t })
                  return (
                    <div key={t.id} className="flex border-b border-[color:var(--w-border)]/50 hover:bg-white/[0.02] transition"
                      style={{ height: rowHeight }}>
                      <div className="w-[240px] shrink-0 px-4 flex flex-col justify-center border-r border-[color:var(--w-border)]">
                        <p className="text-[12.5px] font-medium truncate">{t.title}</p>
                        <p className="text-[10px] text-3 truncate">{g?.name || '—'}</p>
                      </div>
                      <div className="relative flex-1" style={{ height: rowHeight }}>
                        <GanttBar t={t} x={x} w={w} rowHeight={rowHeight} dayWidth={dayWidth}
                          canManage={canManage} done={done} status={t.status}
                          onCommit={(payload) => commitBar(t, payload)}
                          onOpen={() => onOpenTask(t)} />
                        <div style={{ left: todayOffset, position: 'absolute', top: 0, height: '100%' }}
                          className="w-px bg-white/25 pointer-events-none" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ================================================================
// CHAT VIEW
// ================================================================
function ChatView({ me, users, groups, refreshKey }) {
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)
  const [channelError, setChannelError] = useState(null)
  const [editor, setEditor] = useState(null)
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const activeId = useRef(null)
  const channelBusy = useRef(false)
  const messageBusy = useRef(null)
  const canManage = ['owner', 'admin'].includes(me.role) && !me.readOnly
  const canWrite = me.role !== 'viewer' && !me.readOnly && !active?.archivedAt

  async function loadChannels() {
    if (channelBusy.current) return
    channelBusy.current = true
    try {
      const chs = await apiFetch('/channels')
      setChannelError(null); setChannels(chs)
      setActive(previous => chs.find(c => c.id === previous?.id) || chs.find(c => !c.archivedAt) || chs[0] || null)
      if (!chs.length) setLoading(false)
    } catch (e) { setChannelError(e); setLoading(false) } finally { channelBusy.current = false }
  }
  useEffect(() => { loadChannels(); const int = setInterval(loadChannels, 10000); return () => clearInterval(int) }, [refreshKey])

  async function loadMessages(channelId, initial = false) {
    if (!channelId || messageBusy.current === channelId) return
    messageBusy.current = channelId
    try {
      const ms = await apiFetch(`/channels/${channelId}/messages`)
      if (activeId.current !== channelId) return
      setError(null)
      setMessages(previous => initial ? ms : [...new Map([...previous, ...ms].map(m => [m.id, m])).values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id)))
      if (initial) setHasOlder(ms.length === 200)
    } catch (e) { if (activeId.current === channelId) setError(e) }
    finally { if (messageBusy.current === channelId) messageBusy.current = null; if (activeId.current === channelId) setLoading(false) }
  }
  useEffect(() => {
    activeId.current = active?.id || null
    setMessages([]); setError(null); setHasOlder(false)
    if (!active?.id) { setLoading(false); return }
    setLoading(true); loadMessages(active.id, true)
    const int = setInterval(() => loadMessages(active.id), 3500)
    return () => { clearInterval(int); activeId.current = null }
  }, [active?.id])

  async function loadOlder() {
    const first = messages[0]; const channelId = active?.id
    if (!first || olderLoading) return
    setOlderLoading(true)
    try {
      const ms = await apiFetch(`/channels/${channelId}/messages?before=${encodeURIComponent(first.createdAt)}&beforeId=${encodeURIComponent(first.id)}`)
      if (activeId.current !== channelId) return
      setMessages(previous => [...new Map([...ms, ...previous].map(m => [m.id, m])).values()]); setHasOlder(ms.length === 200); setError(null)
    } catch (e) { if (activeId.current === channelId) setError(e) } finally { setOlderLoading(false) }
  }
  useEffect(() => {
    if (olderLoading) return
    const el = document.getElementById('chat-scroll')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages[messages.length - 1]?.id])

  async function send() {
    if (!input.trim() || !active || sending || !canWrite) return
    const content = input; const channelId = active.id; setSending(true)
    try {
      const msg = await apiFetch(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) })
      if (activeId.current === channelId) { setMessages(prev => [...new Map([...prev, msg].map(m => [m.id, m])).values()]); setInput('') }
    } catch (e) { toast.error(e.message) } finally { setSending(false) }
  }
  async function archive() {
    if (!window.confirm(active.archivedAt ? 'Réactiver ce salon ?' : 'Archiver ce salon ? Les messages seront conservés.')) return
    try { await apiFetch(`/channels/${active.id}`, { method: 'PATCH', body: JSON.stringify({ archived: !active.archivedAt }) }); await loadChannels() }
    catch (e) { toast.error(e.message) }
  }

  return (
    <div className="anim-fade-up h-[calc(100vh-140px)] md:h-[calc(100vh-200px)] flex flex-col md:flex-row gap-4">
      {/* Channels */}
      <aside className="surface p-3 md:w-64 md:shrink-0 overflow-y-auto max-h-[180px] md:max-h-none">
        <p className="text-[11px] uppercase text-3 px-2 mb-2 font-medium">Salons</p>
        {canManage && <button className="btn-ghost rounded-lg px-2 py-2 mb-2 text-sm" onClick={() => setEditor({})}>+ Nouveau salon</button>}
        {channelError && <LoadError error={channelError} onRetry={loadChannels} />}
        <div className="space-y-0.5">
          {channels.map(c => (
            <button key={c.id} onClick={() => setActive(c)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[13px] transition ${
                active?.id === c.id ? 'bg-white/[0.06] text-white' : 'text-2 hover:bg-white/[0.03] hover:text-white'
              }`}>
              <span className="text-3">#</span>
              <span className="flex-1 truncate">{c.name}{c.archivedAt ? " · archivé" : ""}</span>
              {c.unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-[#0a1428] font-semibold tabular-nums">{c.unread}</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Messages */}
      <section className="surface flex-1 flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-2">Aucun salon sélectionné</div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-[color:var(--w-border)] flex items-center gap-2">
              <span className="text-3">#</span>
              <h2 className="font-semibold">{active.name}</h2>
              <span className="text-[11px] text-3 ml-2">{active.description}</span>
              {canManage && <div className="ml-auto flex gap-2"><button className="text-xs btn-ghost rounded-lg px-2 py-1" onClick={() => setEditor(active)}>Modifier</button><button className="text-xs btn-ghost rounded-lg px-2 py-1" onClick={archive}>{active.archivedAt ? "Réactiver" : "Archiver"}</button></div>}
            </div>
            <div id="chat-scroll" className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {error && <LoadError error={error} onRetry={() => loadMessages(active.id, messages.length === 0)} />}
              {hasOlder && <button disabled={olderLoading} className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={loadOlder}>{olderLoading ? "Chargement…" : "Messages précédents"}</button>}
              {loading && messages.length === 0 && <p className="text-center text-sm text-3">Chargement…</p>}
              {!loading && messages.length === 0 && <p className="text-center text-sm text-3">Aucun message. Sois le premier à écrire.</p>}
              {messages.map((m, i) => {
                const prev = messages[i - 1]
                const grouped = prev && prev.userId === m.userId && (new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000)
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className="w-8 shrink-0">
                      {!grouped && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                          style={{ background: m.avatarColor || '#3a5375' }}>
                          {initials(m.userName)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {!grouped && (
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-[13px]">{m.userName}</span>
                          <span className="text-[10px] text-3">{new Date(m.createdAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      <p className="text-[13.5px] leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-[color:var(--w-border)] flex gap-2">
              <input disabled={!canWrite || sending} maxLength={4000} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={canWrite ? `Écrire dans #${active.name}…` : "Lecture seule"}
                className="flex-1 h-10 px-3 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25" />
              <button disabled={!canWrite || sending || !input.trim()} onClick={send} className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </section>
      {editor && <ChannelEditor channel={editor.id ? editor : null} users={users} groups={groups} onClose={() => setEditor(null)} onSaved={async channel => { await loadChannels(); setActive(channel) }} />}
    </div>
  )
}

// ================================================================
// NOTIFICATIONS
// ================================================================
function useNotifications(refreshKey, workspaceId, userId) {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState(null)
  const busy = useRef(false)
  async function load() {
    if (!workspaceId || !userId || busy.current) return
    busy.current = true
    setError(null)
    try {
      const n = await apiFetch('/notifications')
      if (getWorkspaceId() === workspaceId && getToken()) { setNotifications(n); setUnread(n.filter(x => !x.read).length) }
    } catch (e) { setError(e) } finally { busy.current = false }
  }
  useEffect(() => { setNotifications([]); setUnread(0); setError(null); if (!workspaceId || !userId) return; load(); const int = setInterval(load, 15000); return () => clearInterval(int) }, [refreshKey, workspaceId, userId])
  return { notifications, unread, error, reload: load }
}

function NotificationsView({ notifications, error, onRetry, onGoto, onMarkRead, onMarkAllRead }) {
  return (
    <div className="space-y-5 anim-fade-up">
      {error && <LoadError error={error} onRetry={onRetry} />}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Alertes & activité</p>
          <h1 className="t-h1">Notifications</h1>
        </div>
        <button onClick={onMarkAllRead} className="h-9 px-4 rounded-full btn-ghost text-[12.5px]">Tout marquer comme lu</button>
      </div>
      <div className="surface divide-y divide-[color:var(--w-border)] overflow-hidden">
        {notifications.length === 0 && <div className="p-10 text-center text-sm text-2">Aucune notification.</div>}
        {notifications.map(n => (
          <button key={n.id} onClick={() => { onMarkRead(n.id); onGoto(n.link) }}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition ${n.read ? '' : 'bg-white/[0.02]'}`}>
            <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.read ? 'bg-white/15' : 'bg-blue-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[13.5px] truncate">{n.title}</p>
              {n.body && <p className="text-[12px] text-2 truncate mt-0.5">{n.body}</p>}
              <p className="text-[10.5px] text-3 mt-1">{new Date(n.createdAt).toLocaleString('fr-CH')}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// PILOT VIEW (admin)
// ================================================================
function PilotView({ users, groups, refreshKey, onOpenTask, onNavigate }) {
  const { data, error, retry } = useApiData('/pilot', refreshKey)
  if (error) return <LoadError error={error} onRetry={retry} />
  if (!data) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>

  const { kpis, byGroup, byMember, critical, trend } = data
  const donutData = [
    { label: 'Terminé', value: kpis.done, color: '#34d399' },
    { label: 'En cours', value: kpis.in_progress, color: '#60a5fa' },
    { label: 'À valider', value: kpis.review, color: '#f59e0b' },
    { label: 'À faire', value: kpis.todo, color: '#475569' },
    { label: 'Bloqué', value: kpis.blocked, color: '#ef4444' },
  ]

  // Simple sparkline for trend
  const maxTrend = Math.max(...trend.map(t => t.done), 1)
  const trendW = 240, trendH = 60
  const pts = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * trendW
    const y = trendH - (t.done / maxTrend) * trendH
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="space-y-6 anim-fade-up">
      <div>
        <p className="text-sm text-2 mb-1">Vue d'ensemble · admin</p>
        <h1 className="t-h1">Pilotage</h1>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { l: 'Total',      v: kpis.total,       dot: 'bg-white/50' },
          { l: 'À faire',    v: kpis.todo,        dot: 'bg-slate-400' },
          { l: 'En cours',   v: kpis.in_progress, dot: 'bg-blue-400' },
          { l: 'À valider',  v: kpis.review,      dot: 'bg-amber-400' },
          { l: 'Bloqué',     v: kpis.blocked,     dot: 'bg-red-400' },
          { l: 'Terminé',    v: kpis.done,        dot: 'bg-emerald-400' },
          { l: 'En retard',  v: kpis.overdue,     dot: 'bg-red-500', danger: true },
        ].map(k => (
          <div key={k.l} className="surface p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${k.dot}`} />
              <span className="text-[10.5px] text-3 font-medium">{k.l}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${k.danger && k.v > 0 ? 'text-red-300' : ''}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By group */}
        <div className="surface p-5 lg:col-span-2">
          <h2 className="t-h2 mb-4">Progression par groupe</h2>
          <div className="space-y-3">
            {byGroup.map(g => (
              <div key={g.groupId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[13.5px]">{g.name}</span>
                    <span className="text-[10.5px] text-3">{g.done}/{g.total}</span>
                    {g.overdue > 0 && <span className="text-[10.5px] text-red-300">· {g.overdue} en retard</span>}
                  </div>
                  <span className="text-[12.5px] font-semibold tabular-nums">{g.progress}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${g.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Donut */}
        <div className="surface p-5">
          <h2 className="t-h2 mb-4">Répartition</h2>
          <div className="flex items-center gap-4">
            <Donut data={donutData} size={140} />
            <div className="space-y-1.5 flex-1 text-[12px]">
              {donutData.map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 text-2">{d.label}</span>
                  <span className="tabular-nums font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="surface p-5">
          <h2 className="t-h2 mb-3">Tâches terminées (30j)</h2>
          <svg width="100%" height={trendH + 20} viewBox={`0 0 ${trendW} ${trendH + 20}`} className="mt-2">
            <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={pts} />
          </svg>
          <p className="text-[11px] text-3">{trend[trend.length - 1]?.done || 0} tâches terminées aujourd'hui</p>
        </div>

        {/* By member */}
        <div className="surface p-5 lg:col-span-2">
          <h2 className="t-h2 mb-3">Charge par personne</h2>
          <div className="space-y-1.5">
            {byMember.map(m => (
              <div key={m.userId} className="flex items-center gap-3 py-1.5">
                <UserAvatar user={m.user} size={26} />
                <span className="text-[13px] font-medium flex-1 truncate">{m.user?.firstName}</span>
                <span className="text-[11px] text-3 w-16 text-right">{m.total} tâches</span>
                <span className="text-[11px] text-2 w-16 text-right">{m.open} ouv.</span>
                <span className={`text-[11px] w-16 text-right ${m.overdue > 0 ? 'text-red-300 font-medium' : 'text-3'}`}>{m.overdue} retard</span>
              </div>
            ))}
          </div>
        </div>

        {/* Critical */}
        <div className="surface p-5 lg:col-span-3">
          <h2 className="t-h2 mb-3">Échéances critiques</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {critical.map(t => (
              <button key={t.id} onClick={() => onOpenTask(t)}
                className="surface-flat p-3 hover:border-white/15 text-left transition flex items-center gap-3">
                <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{t.title}</p>
                  <p className="text-[10.5px] text-3">Échéance {fmtDate(t.dueDate)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-wrap gap-2">
          <button onClick={() => onNavigate('gantt')} className="h-9 px-4 rounded-full btn-ghost text-[12.5px] inline-flex items-center gap-1">
            <GanttChart className="w-3.5 h-3.5" /> Ouvrir Gantt
          </button>
          <button onClick={() => onNavigate('calendar')} className="h-9 px-4 rounded-full btn-ghost text-[12.5px] inline-flex items-center gap-1">
            <CalIcon className="w-3.5 h-3.5" /> Ouvrir Calendrier
          </button>
        </div>
      </div>
    </div>
  )
}


function CalendarView({ me, users, onOpenTask, onCreate, refreshKey }) {
  const [view, setView] = useState('month') // month | week | day
  const [ref, setRef] = useState(new Date())
  const [scope, setScope] = useState('group') // mine | group | all
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)

  const range = useMemo(() => {
    const d = new Date(ref)
    if (view === 'month') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      return { from: first, to: last }
    }
    if (view === 'week') {
      const day = (d.getDay() + 6) % 7
      const start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0,0,0,0)
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
      return { from: start, to: end }
    }
    const s = new Date(d); s.setHours(0,0,0,0)
    const e = new Date(d); e.setHours(23,59,59,999)
    return { from: s, to: e }
  }, [ref, view])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const from = range.from.toISOString()
      const to = range.to.toISOString()
      const t = await apiFetch(`/calendar?from=${from}&to=${to}&scope=${scope}`)
      setTasks(t)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [ref, view, scope, refreshKey])

  function shift(delta) {
    const d = new Date(ref)
    if (view === 'month') d.setMonth(d.getMonth() + delta)
    if (view === 'week') d.setDate(d.getDate() + delta * 7)
    if (view === 'day') d.setDate(d.getDate() + delta)
    setRef(d)
  }

  const tasksByDay = useMemo(() => {
    const m = {}
    for (const t of tasks) {
      const d = new Date(t.dueDate)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      m[key] = m[key] || []
      m[key].push(t)
    }
    return m
  }, [tasks])
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const today = new Date()
  const title = view === 'month'
    ? ref.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `Semaine du ${range.from.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })} au ${range.to.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })}`
      : ref.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 anim-fade-up">
      {error && <LoadError error={error} onRetry={load} />}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Vue calendrier</p>
          <h1 className="t-h1">Calendrier</h1>
          <p className="text-sm text-2 mt-2 capitalize">{title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="pill-group">
            <button className={`pill ${scope === 'mine' ? 'pill-active' : ''}`} onClick={() => setScope('mine')}>À moi</button>
            <button className={`pill ${scope === 'group' ? 'pill-active' : ''}`} onClick={() => setScope('group')}>Groupe</button>
            {(me.role === 'owner' || me.role === 'admin' || me.role === 'teacher') && (
              <button className={`pill ${scope === 'all' ? 'pill-active' : ''}`} onClick={() => setScope('all')}>Tout</button>
            )}
          </div>
          <div className="pill-group">
            <button className={`pill ${view === 'month' ? 'pill-active' : ''}`} onClick={() => setView('month')}>Mois</button>
            <button className={`pill ${view === 'week' ? 'pill-active' : ''}`} onClick={() => setView('week')}>Semaine</button>
            <button className={`pill ${view === 'day' ? 'pill-active' : ''}`} onClick={() => setView('day')}>Jour</button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="icon-btn"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setRef(new Date())} className="h-9 px-3 rounded-full btn-ghost text-[12.5px]">Aujourd'hui</button>
            <button onClick={() => shift(1)} className="icon-btn"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>
      ) : view === 'month' ? (
        <MonthGrid ref={ref} tasksByDay={tasksByDay} onOpenTask={onOpenTask} onDayClick={setSelectedDay} today={today} />
      ) : view === 'week' ? (
        <WeekView range={range} tasksByDay={tasksByDay} onOpenTask={onOpenTask} today={today} />
      ) : (
        <DayView day={ref} tasks={tasksByDay[dayKey(ref)] || []} onOpenTask={onOpenTask} onCreate={onCreate} />
      )}

      {selectedDay && (
        <Dialog open onOpenChange={v => !v && setSelectedDay(null)}>
          <DialogContent className="w-glass max-w-md rounded-2xl border-white/10">
            <DialogHeader><DialogTitle>{fmtDateFull(selectedDay)}</DialogTitle></DialogHeader>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {(tasksByDay[dayKey(selectedDay)] || []).length === 0 && (
                <p className="text-sm text-2 py-4 text-center">Aucune tâche ce jour.</p>
              )}
              {(tasksByDay[dayKey(selectedDay)] || []).map(t => (
                <button key={t.id} onClick={() => { setSelectedDay(null); onOpenTask(t) }}
                  className="w-full text-left surface-flat p-3 hover:border-white/15 transition flex items-center gap-3">
                  <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[11px] text-3">{(STATUS[t.status] || STATUS.todo).label}</p>
                  </div>
                  <div className="flex -space-x-1.5">
                    {(t.assignees || []).slice(0, 3).map(id => <UserAvatar key={id} user={users[id]} size={20} />)}
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function MonthGrid({ ref, tasksByDay, onOpenTask, onDayClick, today }) {
  const year = ref.getFullYear(), month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const isToday = d => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  return (
    <div className="surface p-4">
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-3 mb-2 font-medium">
        {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[100px]" />
          const key = `${year}-${month}-${d}`
          const dayTasks = tasksByDay[key] || []
          const active = isToday(d)
          return (
            <button key={i} onClick={() => onDayClick(new Date(year, month, d))}
              className={`min-h-[100px] p-2 rounded-xl text-left border transition-all ${
                active ? 'border-white/40 bg-white/[0.03]' :
                'border-[color:var(--w-border)] hover:border-white/15 hover:bg-white/[0.02]'
              }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[12px] font-semibold ${active ? 'text-white' : 'text-2'}`}>{d}</span>
                {dayTasks.length > 0 && <span className="text-[10px] text-3 tabular-nums">{dayTasks.length}</span>}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(t => (
                  <div key={t.id} onClick={(e) => { e.stopPropagation(); onOpenTask(t) }}
                    className="text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-white/[0.05] flex items-center gap-1"
                    title={t.title}>
                    <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot} shrink-0`} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && <p className="text-[10px] text-3 pl-1.5">+{dayTasks.length - 3} de plus</p>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ range, tasksByDay, onOpenTask, today }) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(range.from); d.setDate(d.getDate() + i)
    days.push(d)
  }
  const isToday = d => today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth() && today.getDate() === d.getDate()
  return (
    <div className="surface p-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map(d => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const dayTasks = tasksByDay[key] || []
          const active = isToday(d)
          return (
            <div key={d.toISOString()} className={`rounded-xl p-3 min-h-[280px] border ${active ? 'border-white/40 bg-white/[0.03]' : 'border-[color:var(--w-border)]'}`}>
              <div className="mb-2">
                <p className="text-[10px] text-3 uppercase font-medium">{d.toLocaleDateString('fr-CH', { weekday: 'short' })}</p>
                <p className={`text-lg font-bold ${active ? 'text-white' : ''}`}>{d.getDate()}</p>
              </div>
              <div className="space-y-1.5">
                {dayTasks.map(t => (
                  <button key={t.id} onClick={() => onOpenTask(t)}
                    className="w-full text-left text-[11px] p-2 rounded-lg surface-flat hover:border-white/15 flex items-start gap-1.5">
                    <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot} mt-1 shrink-0`} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {dayTasks.length === 0 && <p className="text-[11px] text-3">—</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayView({ day, tasks, onOpenTask, onCreate }) {
  return (
    <div className="surface p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] text-3 uppercase mb-1">{day.toLocaleDateString('fr-CH', { weekday: 'long' })}</p>
          <p className="text-3xl font-bold tracking-tight">{day.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={onCreate} className="h-9 px-3 rounded-full btn-primary text-[12.5px] inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Tâche
        </button>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="py-12 text-center">
            <CalIcon className="w-6 h-6 mx-auto text-white/25 mb-2" />
            <p className="text-sm text-2">Aucune tâche prévue ce jour.</p>
          </div>
        )}
        {tasks.map(t => (
          <button key={t.id} onClick={() => onOpenTask(t)}
            className="w-full text-left surface-flat p-4 hover:border-white/15 transition flex items-center gap-3">
            <span className={`dot ${(STATUS[t.status] || STATUS.todo).dot}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[14px] truncate">{t.title}</p>
              <p className="text-[11.5px] text-3 mt-0.5">{(STATUS[t.status] || STATUS.todo).label}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-md border ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}


const ROLES_META = [
  { key: 'owner',   label: 'Owner',   desc: 'Tous les droits · gestion complète du workspace' },
  { key: 'admin',   label: 'Admin',   desc: 'Peut tout gérer sauf suppression du workspace' },
  { key: 'leader',  label: 'Chef',    desc: 'Gère son groupe · assigne · valide' },
  { key: 'member',  label: 'Membre',  desc: 'Accès à ses tâches · commente · dépose preuves' },
  { key: 'teacher', label: 'Enseignant', desc: 'Lecture globale · peut commenter' },
  { key: 'viewer',  label: 'Viewer',  desc: 'Lecture seule' },
]

function MembersView({ workspace, canManage, refreshKey, onRefresh }) {
  const [error, setError] = useState(null)
  const [members, setMembers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // {member}

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const [ms, gs] = await Promise.all([
        apiFetch('/workspace/members'),
        apiFetch('/groups'),
      ])
      setMembers(ms); setGroups(gs)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  async function updateMember(m, patch) {
    try {
      await apiFetch(`/workspace/members/${m.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      toast.success('Membre mis à jour')
      load(); onRefresh?.()
    } catch (e) { toast.error(e.message) }
  }

  async function removeMember(m) {
    if (!window.confirm(`Retirer ${m.user?.firstName} de l'espace ?`)) return
    try {
      await apiFetch(`/workspace/members/${m.id}`, { method: 'DELETE' })
      toast.success('Retiré')
      load(); onRefresh?.()
    } catch (e) { toast.error(e.message) }
  }

  const filtered = members.filter(m => {
    if (!q) return true
    const s = q.toLowerCase()
    return m.user?.firstName?.toLowerCase().includes(s) || m.user?.email?.toLowerCase().includes(s)
  })

  const roleColor = {
    owner: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
    admin: 'text-purple-300 bg-purple-400/10 border-purple-400/25',
    leader: 'text-blue-300 bg-blue-400/10 border-blue-400/25',
    member: 'text-white/70 bg-white/[0.05] border-white/10',
    teacher: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
    viewer: 'text-white/50 bg-white/[0.03] border-white/10',
  }

  return (
    <div className="space-y-5 anim-fade-up">
      {error && <LoadError error={error} onRetry={load} />}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-2 mb-1">Espace · {workspace.name}</p>
          <h1 className="t-h1">Membres</h1>
          <p className="text-sm text-2 mt-2">{members.length} personne(s) · gérez rôles, groupes et accès</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-3" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un membre…"
            className="h-9 pl-8 pr-3 rounded-full bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-[12.5px] focus:outline-none focus:border-white/20 w-56" />
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>
      ) : (
        <div className="surface divide-y divide-[color:var(--w-border)] overflow-hidden">
          {filtered.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition">
              <UserAvatar user={m.user} size={36} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[14px] truncate">{m.user?.firstName}</p>
                <p className="text-[11.5px] text-3 truncate">{m.user?.email}</p>
              </div>
              <span className={`text-[10.5px] px-2 py-0.5 rounded-md border ${roleColor[m.role] || roleColor.member}`}>
                {ROLES_META.find(r => r.key === m.role)?.label || m.role}
              </span>
              <span className="text-[12px] text-2 min-w-[110px] hidden sm:block">
                {m.group ? m.group.name : <span className="text-3">sans groupe</span>}
              </span>
              {canManage ? (
                <button onClick={() => setEditing(m)}
                  className="icon-btn" title="Gérer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-2">Aucun membre trouvé.</div>}
        </div>
      )}

      {editing && (
        <MemberEditDialog member={editing} groups={groups}
          onClose={() => setEditing(null)}
          onUpdate={(patch) => updateMember(editing, patch)}
          onRemove={() => { removeMember(editing); setEditing(null) }}
          canManage={canManage} />
      )}
    </div>
  )
}

function MemberEditDialog({ member, groups, onClose, onUpdate, onRemove, canManage }) {
  const [role, setRole] = useState(member.role)
  const [groupId, setGroupId] = useState(member.groupId || '')

  async function save() {
    const patch = {}
    if (role !== member.role) patch.role = role
    if ((groupId || null) !== (member.groupId || null)) patch.groupId = groupId || null
    if (Object.keys(patch).length === 0) { onClose(); return }
    await onUpdate(patch)
    onClose()
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-glass max-w-lg rounded-2xl border-white/10">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <UserAvatar user={member.user} size={40} />
            <div>
              <DialogTitle className="text-lg">{member.user?.firstName}</DialogTitle>
              <p className="text-[12px] text-3">{member.user?.email}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-3 mb-2">Rôle</p>
            <div className="space-y-1.5">
              {ROLES_META.map(r => (
                <button key={r.key} onClick={() => canManage && setRole(r.key)}
                  disabled={!canManage}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    role === r.key
                      ? 'border-white/30 bg-white/[0.05]'
                      : 'border-[color:var(--w-border)] hover:border-white/15'
                  } ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      role === r.key ? 'border-white' : 'border-white/30'
                    }`}>
                      {role === r.key && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="font-medium text-[13.5px]">{r.label}</span>
                  </div>
                  <p className="text-[11.5px] text-2 mt-1 ml-6">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] text-3 mb-2">Groupe</p>
            <Select value={groupId || 'none'} onValueChange={v => setGroupId(v === 'none' ? '' : v)} disabled={!canManage}>
              <SelectTrigger className="h-10 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-glass border-white/10">
                <SelectItem value="none">— Sans groupe —</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 rounded-xl border border-[color:var(--w-border)]">
            <p className="text-[11.5px] text-2">
              <strong className="text-white">Permissions</strong> — appliquées automatiquement selon le rôle choisi.
              La personnalisation par membre arrive dans la prochaine version.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {canManage && (
            <button onClick={onRemove} className="h-9 px-4 rounded-xl btn-ghost text-red-300 hover:text-red-200 text-sm inline-flex items-center gap-1">
              <X className="w-4 h-4" /> Retirer
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="h-9 px-4 rounded-xl btn-ghost text-sm">Annuler</button>
            {canManage && (
              <button onClick={save} className="h-9 px-4 rounded-xl btn-primary text-sm">Enregistrer</button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function WelcomeSplash({ name, onDone }) {
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(onDone, reduce ? 300 : 1400)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--w-bg)] anim-splash-out">
      <div className="flex flex-col items-center gap-6">
        <WhatodoLogo size={44} stroke="#ffffff" className="opacity-90 anim-splash-logo" />
        <div className="text-center">
          <p className="text-[13px] text-2 anim-splash-hello">Bon retour parmi nous,</p>
          <p className="text-3xl font-semibold tracking-tight mt-1.5 anim-splash-name">{name}</p>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// ONBOARDING (no workspace yet)
// ================================================================
function OnboardingScreen({ user, onCreated, onJoined, onLogout }) {
  const [mode, setMode] = useState('choose') // choose | create | join | joined-preview
  const [loading, setLoading] = useState(false)
  // Create wizard state
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🚀')
  const [color, setColor] = useState('#3b82f6')
  const [groupsDraft, setGroupsDraft] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [firstTaskTitle, setFirstTaskTitle] = useState('')
  // Join state
  const [inviteCode, setInviteCode] = useState('')
  const [preview, setPreview] = useState(null)

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#14b8a6', '#eab308', '#ef4444']
  const emojis = ['🚀', '🎯', '📚', '💼', '🎨', '⚡', '🌟', '🔥', '🌱', '🏆', '💡', '🎪']

  async function createWorkspace() {
    if (!name.trim()) return toast.error('Nom requis')
    setLoading(true)
    try {
      const payload = {
        name, description, color, emoji,
        icon: (name[0] || 'W').toUpperCase(),
        groups: groupsDraft.map(g => ({ name: g })),
      }
      if (firstTaskTitle.trim()) payload.firstTask = { title: firstTaskTitle.trim() }
      const ws = await apiFetch('/workspaces', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Espace créé')
      onCreated(ws)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  async function joinWorkspace() {
    if (!inviteCode.trim()) return toast.error('Code requis')
    setLoading(true)
    try {
      const { workspace } = await apiFetch('/workspaces/join', { method: 'POST', body: JSON.stringify({ inviteCode }) })
      setPreview(workspace)
      setMode('joined-preview')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  function addGroup() {
    const v = newGroupName.trim()
    if (!v) return
    if (groupsDraft.length >= 10) return toast.error('Max 10 groupes')
    setGroupsDraft(prev => [...prev, v])
    setNewGroupName('')
  }
  function removeGroup(i) { setGroupsDraft(prev => prev.filter((_, k) => k !== i)) }

  const input = "w-full h-11 px-3 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25"

  // Wizard steps
  const steps = [
    { key: 'name', title: 'Nommez votre espace', sub: 'Vous pourrez le modifier plus tard.' },
    { key: 'appearance', title: 'Une identité visuelle', sub: 'Choisissez un emoji et une couleur.' },
    { key: 'groups', title: 'Créez des groupes (optionnel)', sub: 'Organisez votre équipe par sous-groupes.' },
    { key: 'firstTask', title: 'Votre première tâche (optionnel)', sub: 'Un petit pas pour démarrer.' },
    { key: 'ready', title: "C'est prêt", sub: 'Créons votre espace.' },
  ]
  const s = steps[step]
  const canNext = step === 0 ? name.trim().length > 0 : true

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg anim-fade-up">
        <div className="flex flex-col items-center mb-8">
          <WhatodoLogo size={52} stroke="#ffffff" className="mb-5 opacity-95" />
          <h1 className="text-3xl font-bold tracking-tight">Bienvenue {user.firstName}</h1>
          <p className="text-sm text-2 mt-2 text-center">Organisez vos projets. Travaillez en équipe. Avancez simplement.</p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-2 anim-scale">
            <button onClick={() => { setMode('create'); setStep(0) }}
              className="surface surface-interactive w-full p-5 text-left flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Créer un espace</p>
                <p className="text-[12.5px] text-2 mt-0.5">Démarrez un nouveau projet et invitez votre équipe</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-3" />
            </button>
            <button onClick={() => setMode('join')}
              className="surface surface-interactive w-full p-5 text-left flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Rejoindre un espace</p>
                <p className="text-[12.5px] text-2 mt-0.5">Avec un code d'invitation reçu</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-3" />
            </button>
            <button onClick={onLogout} className="w-full text-center text-[12px] text-3 hover:text-white pt-4 transition">
              Se déconnecter
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="surface p-6 space-y-5 anim-scale">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? 'bg-white' : 'bg-white/10'}`} />
              ))}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-3">Étape {step + 1} / {steps.length}</p>
              <h2 className="text-xl font-semibold mt-1">{s.title}</h2>
              <p className="text-[13px] text-2 mt-1">{s.sub}</p>
            </div>

            {s.key === 'name' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-3 mb-1.5 block">Nom de l'espace *</label>
                  <input autoFocus value={name} onChange={e => setName(e.target.value.slice(0, 60))} placeholder="Ex: Projet Alpha, Équipe produit, Voyage Berlin"
                    className={input} />
                </div>
                <div>
                  <label className="text-[11px] text-3 mb-1.5 block">Description (optionnelle)</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 300))} placeholder="Ex: Coordination des tâches de notre équipe"
                    rows={3}
                    className={"w-full px-3 py-2.5 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25 resize-none"} />
                </div>
              </div>
            )}

            {s.key === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-3 mb-2 block">Emoji</label>
                  <div className="grid grid-cols-6 gap-2">
                    {emojis.map(e => (
                      <button key={e} onClick={() => setEmoji(e)}
                        className={`h-11 rounded-xl text-xl transition ${emoji === e ? 'bg-white/[0.08] ring-1 ring-white/30 scale-110' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-3 mb-2 block">Couleur</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(c => (
                      <button key={c} onClick={() => setColor(c)}
                        className={`w-9 h-9 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--w-surface)] scale-110' : 'opacity-70 hover:opacity-100'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ background: color }}>{emoji}</div>
                  <div>
                    <p className="text-sm font-semibold">{name || 'Votre espace'}</p>
                    <p className="text-[11.5px] text-3">Aperçu</p>
                  </div>
                </div>
              </div>
            )}

            {s.key === 'groups' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGroup())}
                    placeholder="Nom du groupe (ex: Communication)" className={input} />
                  <button onClick={addGroup} className="h-11 px-4 rounded-xl btn-ghost text-sm inline-flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
                {groupsDraft.length > 0 && (
                  <div className="space-y-1.5">
                    {groupsDraft.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10">
                        <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[11px] font-semibold">{i + 1}</div>
                        <p className="flex-1 text-sm">{g}</p>
                        <button onClick={() => removeGroup(i)} className="text-3 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {groupsDraft.length === 0 && <p className="text-[12px] text-3 italic">Aucun groupe pour l'instant. Vous pourrez en créer plus tard.</p>}
              </div>
            )}

            {s.key === 'firstTask' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-3 mb-1.5 block">Titre de la première tâche</label>
                  <input value={firstTaskTitle} onChange={e => setFirstTaskTitle(e.target.value)} placeholder="Ex: Préparer la réunion de kick-off" className={input} />
                </div>
                <p className="text-[12px] text-3 italic">Vous pouvez sauter cette étape.</p>
              </div>
            )}

            {s.key === 'ready' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: color }}>{emoji}</div>
                  <div className="flex-1">
                    <p className="font-semibold">{name}</p>
                    {description && <p className="text-[12px] text-2 mt-0.5">{description}</p>}
                    <p className="text-[11px] text-3 mt-1">
                      {groupsDraft.length ? `${groupsDraft.length} groupe${groupsDraft.length > 1 ? 's' : ''}` : 'Aucun groupe'}
                      {firstTaskTitle && ' · 1 tâche'}
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-2">Vous deviendrez <span className="text-white font-medium">Owner</span> de cet espace.</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => { if (step === 0) setMode('choose'); else setStep(step - 1) }}
                className="h-10 px-4 rounded-xl btn-ghost text-sm inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Retour' : 'Précédent'}
              </button>
              <div className="flex-1" />
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(step + 1)} disabled={!canNext}
                  className="h-10 px-5 rounded-xl btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-40">
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={createWorkspace} disabled={loading}
                  className="h-10 px-5 rounded-xl btn-primary text-sm inline-flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Créer l'espace
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="surface p-6 space-y-4 anim-scale">
            <div>
              <h2 className="text-xl font-semibold">Rejoindre un espace</h2>
              <p className="text-[13px] text-2 mt-1">Entrez le code d'invitation que vous avez reçu.</p>
            </div>
            <div>
              <label className="text-[11px] text-3 mb-1.5 block">Code d'invitation</label>
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="XXXXXX-XXXXX"
                className={input + ' font-mono uppercase tracking-wider'} />
              <p className="text-[11px] text-3 mt-1.5">Demandez le code à un membre de l'espace.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMode('choose')} className="h-10 px-4 rounded-xl btn-ghost text-sm flex-1">Retour</button>
              <button onClick={joinWorkspace} disabled={loading}
                className="h-10 px-4 rounded-xl btn-primary text-sm flex-1 inline-flex items-center justify-center gap-1">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Rejoindre
              </button>
            </div>
          </div>
        )}

        {mode === 'joined-preview' && preview && (
          <div className="surface p-6 space-y-4 anim-scale text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl" style={{ background: preview.color || '#3b82f6' }}>
              {preview.emoji || preview.icon || preview.name[0]}
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-widest text-3">Bienvenue dans</p>
              <h2 className="text-2xl font-bold mt-1">{preview.name}</h2>
              {preview.description && <p className="text-[13px] text-2 mt-2">{preview.description}</p>}
            </div>
            <button onClick={() => onJoined(preview)} className="w-full h-11 rounded-xl btn-primary text-sm">
              Entrer dans l'espace
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ================================================================
// WORKSPACE SWITCHER
// ================================================================
function WorkspaceSwitcher({ workspaces, active, onSwitch, onOpenCreate, onOpenJoin }) {
  const [open, setOpen] = useState(false)
  if (!active) return null
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition group">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
          style={{ background: active.color || '#3b82f6' }}>
          {active.icon || active.name[0]}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-semibold truncate">{active.name}</p>
          <p className="text-[10.5px] text-3 truncate">{active.myRole}</p>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-3 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 w-glass rounded-xl p-1.5 z-50 anim-scale">
            {workspaces.map(w => (
              <button key={w.id}
                onClick={() => { onSwitch(w); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition ${
                  w.id === active.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs shrink-0"
                  style={{ background: w.color || '#3b82f6' }}>
                  {w.icon || w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium truncate">{w.name}</p>
                  <p className="text-[10px] text-3 truncate">{w.myRole} · {w.memberCount || '—'} membres</p>
                </div>
                {w.id === active.id && <CheckCircle2 className="w-3.5 h-3.5 text-white/70" />}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1.5 pt-1.5 space-y-0.5">
              <button onClick={() => { setOpen(false); onOpenCreate() }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-white/[0.04] transition text-[12.5px] text-2">
                <Plus className="w-3.5 h-3.5" /> Créer un espace
              </button>
              <button onClick={() => { setOpen(false); onOpenJoin() }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-white/[0.04] transition text-[12.5px] text-2">
                <Users className="w-3.5 h-3.5" /> Rejoindre un espace
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ================================================================
// INVITE PANEL (workspace settings quick view)
// ================================================================
function InvitePanel({ workspace, canManage, onClose, onRegenerated }) {
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState(workspace.inviteCode)

  async function regen() {
    try {
      const { inviteCode } = await apiFetch('/workspace/regenerate-code', { method: 'POST' })
      setCode(inviteCode); onRegenerated?.(inviteCode)
      toast.success('Nouveau code généré')
    } catch (e) { toast.error(e.message) }
  }

  function copyCode() {
    navigator.clipboard?.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-glass max-w-md rounded-2xl border-white/10">
        <DialogHeader>
          <DialogTitle className="text-lg">Inviter dans {workspace.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-3 mb-2">Code d'invitation</p>
            <div className="surface-flat px-4 py-3 flex items-center gap-3">
              <span className="text-xl font-mono font-bold tracking-wider flex-1">{code}</span>
              <button onClick={copyCode} className="h-9 px-3 rounded-lg btn-ghost text-sm">
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <p className="text-[11px] text-3 mt-2">Partagez ce code pour que d'autres puissent rejoindre.</p>
          </div>
          {canManage && (
            <button onClick={regen} className="text-[12px] text-2 hover:text-white transition">
              Regénérer le code
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


// ================================================================
// TUTORIAL TOUR — 5-step interactive walkthrough
// ================================================================
const TOUR_STEPS = [
  { icon: LayoutDashboard, title: 'Bienvenue sur Whatodo', body: "Voici votre nouvel espace. Votre dashboard vous donne une vue d'ensemble à chaque connexion." },
  { icon: ListChecks, title: 'Gérez vos tâches', body: "Créez, assignez, priorisez. Le Kanban et le calendrier vous aident à suivre l'avancement." },
  { icon: Users, title: 'Invitez votre équipe', body: "Générez un code d'invitation ou envoyez un lien depuis l'onglet Membres." },
  { icon: CalIcon, title: 'Planifiez sur le calendrier', body: "Vue mois, semaine ou jour. Cliquez sur une date pour voir ce qui doit être fait." },
  { icon: GanttChart, title: 'Anticipez avec le Gantt', body: "Visualisez toutes vos tâches sur une timeline. Glissez pour ajuster les dates." },
  { icon: MessageSquare, title: 'Discutez en équipe', body: "Un channel #general, un channel #chefs, et un par groupe. Mentionnez avec @nom." },
  { icon: Sparkles, title: 'À vous de jouer', body: "Vous êtes prêt. Créez votre première tâche, invitez vos coéquipiers, avancez." },
]
function TutorialTour({ onFinish }) {
  const [i, setI] = useState(0)
  const s = TOUR_STEPS[i]
  const last = i === TOUR_STEPS.length - 1
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-md surface p-6 space-y-4 anim-scale">
        <div className="flex items-center gap-1.5">
          {TOUR_STEPS.map((_, k) => (
            <div key={k} className={`h-1 flex-1 rounded-full transition ${k <= i ? 'bg-white' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <s.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-3">Étape {i + 1} / {TOUR_STEPS.length}</p>
            <h3 className="text-lg font-semibold">{s.title}</h3>
          </div>
        </div>
        <p className="text-[14px] text-2 leading-relaxed">{s.body}</p>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onFinish(false)} className="h-9 px-3 rounded-lg text-[13px] text-3 hover:text-white transition">Passer</button>
          <div className="flex-1" />
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="h-9 px-3 rounded-lg btn-ghost text-[13px] inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
          )}
          <button onClick={() => last ? onFinish(true) : setI(i + 1)} className="h-9 px-4 rounded-lg btn-primary text-[13px] inline-flex items-center gap-1">
            {last ? 'Commencer' : 'Suivant'} {!last && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// PROFILE VIEW — user account & preferences
// ================================================================
function ProfileView({ me, onUpdated, onLogout, onReplayTutorial }) {
  const [firstName, setFirstName] = useState(me.firstName || '')
  const [lastName, setLastName] = useState(me.lastName || '')
  const [email, setEmail] = useState(me.email || '')
  const [bio, setBio] = useState(me.bio || '')
  const [avatar, setAvatar] = useState(me.avatar || null)
  const [timezone, setTimezone] = useState(me.timezone || 'Europe/Zurich')
  const [locale, setLocale] = useState(me.locale || 'fr')
  const [notifPrefs, setNotifPrefs] = useState(me.notifPrefs || { taskAssigned: true, taskValidated: true, mentions: true, comments: true, deadlines: true })
  const [saving, setSaving] = useState(false)
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [delPwd, setDelPwd] = useState('')

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) return toast.error('Image trop lourde (max 500 Ko)')
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    try {
      const r = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ firstName, lastName, email, bio, avatar, timezone, locale, notifPrefs }) })
      toast.success('Profil mis à jour')
      onUpdated(r.user)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function changePassword() {
    if (!pwd.current || !pwd.next) return toast.error('Champs requis')
    if (pwd.next !== pwd.confirm) return toast.error('Les mots de passe ne correspondent pas')
    if (pwd.next.length < 8) return toast.error('Min. 8 caractères')
    setPwdLoading(true)
    try {
      await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }) })
      toast.success('Mot de passe modifié')
      setPwd({ current: '', next: '', confirm: '' })
    } catch (e) { toast.error(e.message) } finally { setPwdLoading(false) }
  }
  async function deleteAccount() {
    if (!delPwd) return toast.error('Mot de passe requis')
    try {
      await apiFetch('/auth/delete-account', { method: 'POST', body: JSON.stringify({ password: delPwd }) })
      toast.success('Compte supprimé')
      onLogout()
    } catch (e) { toast.error(e.message) }
  }

  const input = "w-full h-10 px-3 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25"
  const label = "text-[11px] text-3 mb-1.5 block"

  return (
    <div className="space-y-4 max-w-3xl anim-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="text-sm text-2 mt-1">Gérez vos informations et préférences.</p>
      </div>

      <section className="surface p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white" style={{ background: me.avatarColor || '#3a5375' }}>
                {(firstName[0] || 'U').toUpperCase()}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-[#0a1428] flex items-center justify-center cursor-pointer shadow-lg">
              <Camera className="w-3.5 h-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </label>
          </div>
          {avatar && (
            <button onClick={() => setAvatar(null)} className="text-[12px] text-3 hover:text-red-400 transition">Retirer la photo</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Prénom *</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Nom</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Bio (courte)</label>
          <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 200))} rows={2}
            className="w-full px-3 py-2 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Fuseau horaire</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={input}>
              <option value="Europe/Zurich">Europe/Zurich</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
          <div>
            <label className={label}>Langue</label>
            <select value={locale} onChange={e => setLocale(e.target.value)} className={input}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl btn-primary text-sm inline-flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
        </button>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><BellIcon className="w-4 h-4" /> Préférences de notifications</h2>
        <div className="space-y-2">
          {[
            { k: 'taskAssigned', label: "Nouvelle tâche assignée" },
            { k: 'taskValidated', label: "Tâche validée ou refusée" },
            { k: 'mentions', label: "Mentions dans le chat" },
            { k: 'comments', label: "Nouveaux commentaires" },
            { k: 'deadlines', label: "Rappels de deadline" },
          ].map(({ k, label }) => (
            <label key={k} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <span className="text-sm">{label}</span>
              <input type="checkbox" checked={!!notifPrefs[k]} onChange={e => setNotifPrefs({ ...notifPrefs, [k]: e.target.checked })} className="w-4 h-4 accent-white" />
            </label>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg btn-ghost text-[13px]">Sauvegarder les préférences</button>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Changer de mot de passe</h2>
        <input type="password" placeholder="Mot de passe actuel" value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} className={input} />
        <input type="password" placeholder="Nouveau mot de passe (8 caractères min.)" value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} className={input} />
        <input type="password" placeholder="Confirmer le nouveau mot de passe" value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} className={input} />
        <button onClick={changePassword} disabled={pwdLoading} className="h-10 px-5 rounded-xl btn-primary text-sm inline-flex items-center gap-2">
          {pwdLoading && <Loader2 className="w-4 h-4 animate-spin" />} Modifier le mot de passe
        </button>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><HelpCircle className="w-4 h-4" /> Aide</h2>
        <button onClick={onReplayTutorial} className="h-9 px-4 rounded-lg btn-ghost text-[13px] inline-flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Revoir le tutoriel
        </button>
      </section>

      <section className="surface p-5 space-y-3 border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Zone dangereuse</h2>
        <p className="text-[12.5px] text-2">La suppression est définitive. Vos messages et tâches créés seront conservés mais anonymisés.</p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="h-9 px-4 rounded-lg text-[13px] bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition">
            Supprimer mon compte
          </button>
        ) : (
          <div className="space-y-2">
            <input type="password" placeholder="Confirmez avec votre mot de passe" value={delPwd} onChange={e => setDelPwd(e.target.value)} className={input} />
            <div className="flex gap-2">
              <button onClick={() => { setShowDelete(false); setDelPwd('') }} className="h-9 px-3 rounded-lg btn-ghost text-[13px]">Annuler</button>
              <button onClick={deleteAccount} className="h-9 px-4 rounded-lg text-[13px] bg-red-500 text-white hover:bg-red-600 transition">Supprimer définitivement</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ================================================================
// WORKSPACE SETTINGS VIEW
// ================================================================
function WorkspaceSettingsView({ workspace, canManage, isOwner, users, onUpdated, onLeft, onDeleted }) {
  const [tab, setTab] = useState('general')
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [emoji, setEmoji] = useState(workspace.emoji || workspace.icon || '🚀')
  const [color, setColor] = useState(workspace.color || '#3b82f6')
  const [saving, setSaving] = useState(false)
  const [invitations, setInvitations] = useState([])
  const [invRole, setInvRole] = useState('member')
  const [audit, setAudit] = useState([])
  const [loadError, setLoadError] = useState(null)

  async function save() {
    setSaving(true)
    try {
      const r = await apiFetch('/workspace', { method: 'PATCH', body: JSON.stringify({ name, description, emoji, color, icon: (name[0] || 'W').toUpperCase() }) })
      toast.success('Espace mis à jour')
      onUpdated(r)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  async function loadInvitations() {
    setLoadError(null)
    try { setInvitations(await apiFetch('/workspace/invitations')) } catch (e) { setLoadError(e) }
  }
  async function createInvitation() {
    try {
      const inv = await apiFetch('/workspace/invitations', { method: 'POST', body: JSON.stringify({ role: invRole, expiresInDays: 30 }) })
      setInvitations(prev => [inv, ...prev])
      toast.success('Invitation créée')
    } catch (e) { toast.error(e.message) }
  }
  async function revokeInvitation(id) {
    try {
      await apiFetch(`/workspace/invitations/${id}`, { method: 'DELETE' })
      setInvitations(prev => prev.filter(i => i.id !== id))
    } catch (e) { toast.error(e.message) }
  }
  async function loadAudit() {
    setLoadError(null)
    try { setAudit(await apiFetch('/workspace/audit')) } catch (e) { setLoadError(e) }
  }

  useEffect(() => {
    if (tab === 'invitations') loadInvitations()
    if (tab === 'audit') loadAudit()
  }, [tab])

  async function leaveWorkspace() {
    if (!confirm('Quitter cet espace ? Vous perdrez l\'accès aux tâches et discussions.')) return
    try {
      await apiFetch('/workspace/leave', { method: 'POST' })
      toast.success('Vous avez quitté l\'espace')
      onLeft()
    } catch (e) { toast.error(e.message) }
  }
  async function transferOwnership(userId) {
    if (!confirm('Transférer la propriété à ce membre ? Vous deviendrez Admin.')) return
    try {
      await apiFetch('/workspace/transfer-ownership', { method: 'POST', body: JSON.stringify({ targetUserId: userId }) })
      toast.success('Propriété transférée')
      onUpdated({ ...workspace, ownerId: userId })
    } catch (e) { toast.error(e.message) }
  }
  async function toggleArchive() {
    try {
      const action = workspace.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/workspace/${action}`, { method: 'POST' })
      toast.success(workspace.archivedAt ? 'Espace désarchivé' : 'Espace archivé')
      onUpdated({ ...workspace, archivedAt: workspace.archivedAt ? null : new Date() })
    } catch (e) { toast.error(e.message) }
  }
  async function deleteWorkspace() {
    const confirmation = prompt(`Pour supprimer définitivement, tapez le nom de l'espace : ${workspace.name}`)
    if (confirmation !== workspace.name) return toast.error('Confirmation incorrecte')
    try {
      await apiFetch('/workspace', { method: 'DELETE' })
      toast.success('Espace supprimé')
      onDeleted()
    } catch (e) { toast.error(e.message) }
  }

  const input = "w-full h-10 px-3 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25"
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#14b8a6', '#eab308', '#ef4444']
  const emojis = ['🚀', '🎯', '📚', '💼', '🎨', '⚡', '🌟', '🔥', '🌱', '🏆', '💡', '🎪']

  const tabs = [
    { k: 'general', label: 'Général', icon: Settings },
    ...(canManage ? [{ k: 'invitations', label: 'Invitations', icon: Users }] : []),
    ...(canManage ? [{ k: 'audit', label: 'Journal', icon: Activity }] : []),
    { k: 'danger', label: 'Zone dangereuse', icon: AlertCircle },
  ]

  return (
    <div className="space-y-4 max-w-3xl anim-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paramètres · {workspace.name}</h1>
          <p className="text-sm text-2 mt-1">Configurez votre espace de travail.</p>
        </div>
        {workspace.archivedAt && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">Archivé</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[color:var(--w-border)]">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-2 text-[13px] inline-flex items-center gap-1.5 border-b-2 transition ${
              tab === t.k ? 'border-white text-white' : 'border-transparent text-3 hover:text-white'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <section className="surface p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: color }}>{emoji}</div>
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-[11.5px] text-3">{workspace.inviteCode}</p>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-3 mb-1.5 block">Nom *</label>
            <input value={name} onChange={e => setName(e.target.value)} disabled={!canManage} className={input} />
          </div>
          <div>
            <label className="text-[11px] text-3 mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={!canManage} rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-[color:var(--w-surface-2)] border border-[color:var(--w-border)] text-white text-sm focus:outline-none focus:border-white/25 resize-none disabled:opacity-60" />
          </div>
          {canManage && (
            <>
              <div>
                <label className="text-[11px] text-3 mb-2 block">Emoji</label>
                <div className="grid grid-cols-6 gap-2">
                  {emojis.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={`h-10 rounded-lg text-lg transition ${emoji === e ? 'bg-white/[0.08] ring-1 ring-white/30' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-3 mb-2 block">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--w-surface)]' : 'opacity-70 hover:opacity-100'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl btn-primary text-sm inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
              </button>
            </>
          )}
        </section>
      )}

      {tab === 'invitations' && (
        <section className="surface p-5 space-y-4">
          <div>
            <p className="text-[13px] text-2 mb-2">Code global du workspace :</p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/10">
              <code className="flex-1 text-sm font-mono">{workspace.inviteCode}</code>
              <button onClick={() => { navigator.clipboard.writeText(workspace.inviteCode); toast.success('Copié') }} className="icon-btn"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-3 mb-1.5 block">Rôle attribué à l'invitation</label>
              <select value={invRole} onChange={e => setInvRole(e.target.value)} className={input}>
                <option value="member">Member</option>
                <option value="leader">Leader</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            <button onClick={createInvitation} className="h-10 px-4 rounded-xl btn-primary text-sm inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Nouvelle invitation
            </button>
          </div>
          <div className="space-y-2">
            {invitations.length === 0 && <p className="text-[12.5px] text-3 italic">Aucune invitation. Le code global du workspace suffit pour rejoindre.</p>}
            {invitations.map(inv => {
              const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date()
              return (
                <div key={inv.id} className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <code className="text-sm font-mono flex-1">{inv.token}</code>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10">{inv.role}</span>
                  {expired && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">Expiré</span>}
                  <button onClick={() => { navigator.clipboard.writeText(inv.token); toast.success('Copié') }} className="icon-btn"><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => revokeInvitation(inv.id)} className="icon-btn text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="surface p-5 space-y-2">
          <p className="text-[13px] text-2">Historique des actions importantes (200 dernières).</p>
          {audit.length === 0 && <p className="text-[12.5px] text-3 italic pt-2">Aucun événement enregistré pour l'instant.</p>}
          {audit.map(l => (
            <div key={l.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <Activity className="w-3.5 h-3.5 text-3" />
              <span className="text-[12.5px] font-medium">{l.action}</span>
              <span className="text-[11.5px] text-3">· {l.actor?.firstName || 'système'}</span>
              <div className="flex-1" />
              <span className="text-[11px] text-3 tabular-nums">{new Date(l.createdAt).toLocaleString('fr-FR')}</span>
            </div>
          ))}
        </section>
      )}

      {tab === 'danger' && (
        <div className="space-y-3">
          <section className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><DoorOpen className="w-4 h-4" /> Quitter cet espace</h3>
            <p className="text-[12.5px] text-2">Vous perdrez l'accès aux tâches, discussions et notifications de cet espace.</p>
            <button onClick={leaveWorkspace} className="h-9 px-4 rounded-lg btn-ghost text-[13px] text-orange-300 border border-orange-500/30 hover:bg-orange-500/10">Quitter l'espace</button>
          </section>

          {isOwner && (
            <section className="surface p-5 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Crown className="w-4 h-4" /> Transférer la propriété</h3>
              <p className="text-[12.5px] text-2">Un autre membre deviendra le nouvel Owner. Vous conserverez un rôle Admin.</p>
              <div className="space-y-1.5 pt-1">
                {Object.values(users || {}).filter(u => u.id !== workspace.ownerId).slice(0, 8).map(u => (
                  <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <UserAvatar user={u} size={26} />
                    <p className="flex-1 text-[13px]">{u.firstName} {u.lastName}</p>
                    <button onClick={() => transferOwnership(u.id)} className="h-8 px-3 rounded-md btn-ghost text-[12px]">Transférer</button>
                  </div>
                ))}
                {Object.values(users || {}).filter(u => u.id !== workspace.ownerId).length === 0 && (
                  <p className="text-[12px] text-3 italic">Aucun autre membre à qui transférer.</p>
                )}
              </div>
            </section>
          )}

          {canManage && (
            <section className="surface p-5 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Archive className="w-4 h-4" /> {workspace.archivedAt ? 'Désarchiver' : 'Archiver'}</h3>
              <p className="text-[12.5px] text-2">
                {workspace.archivedAt
                  ? 'Réactive cet espace et le rend de nouveau accessible.'
                  : "Marque l'espace comme inactif. Les données sont conservées mais l'espace n'apparaît plus comme actif."}
              </p>
              <button onClick={toggleArchive} className="h-9 px-4 rounded-lg btn-ghost text-[13px]">
                {workspace.archivedAt ? 'Désarchiver' : 'Archiver l\'espace'}
              </button>
            </section>
          )}

          {isOwner && (
            <section className="surface p-5 space-y-2 border-red-500/20">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><Trash className="w-4 h-4" /> Supprimer définitivement</h3>
              <p className="text-[12.5px] text-2">Toutes les données de cet espace seront supprimées : tâches, groupes, membres, messages, notifications. Irréversible.</p>
              <button onClick={deleteWorkspace} className="h-9 px-4 rounded-lg text-[13px] bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition">Supprimer l'espace</button>
            </section>
          )}
        </div>
      )}
    </div>
  )
}


// ================================================================
// APP SHELL
// ================================================================
export default function App() {
  const [me, setMe] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [workspace, setWorkspace] = useState(null)
  const [dashboardMeta, setDashboardMeta] = useState({ group: null, role: null })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [users, setUsers] = useState({})
  const [groups, setGroups] = useState([])
  const [taskOpen, setTaskOpen] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewGroupId, setViewGroupId] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [onboardingMode, setOnboardingMode] = useState(null) // 'create' | 'join' | null (opened from switcher)
  const [invitePanelOpen, setInvitePanelOpen] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const notifs = useNotifications(refreshKey, workspace?.id, me?.id)
  const [sessionError, setSessionError] = useState(null)
  const [workspaceError, setWorkspaceError] = useState(null)
  const workspaceRequest = useRef(0)

  async function loadWorkspaceData() {
    const wid = getWorkspaceId()
    const requestId = ++workspaceRequest.current
    setWorkspaceError(null)
    try {
      const [gs, us, dash, ws] = await Promise.all([apiFetch('/groups'), apiFetch('/users'), apiFetch('/dashboard'), apiFetch('/workspace')])
      if (requestId !== workspaceRequest.current || getWorkspaceId() !== wid) return
      setGroups(gs); setUsers(Object.fromEntries(us.map(u => [u.id, u])))
      setDashboardMeta({ group: dash.group, role: dash.role })
      setWorkspace(previous => previous?.id === wid ? { ...previous, ...ws } : previous)
    } catch (e) { if (requestId === workspaceRequest.current && getWorkspaceId() === wid) setWorkspaceError(e) }
  }

  async function bootstrap(withWelcome = false) {
    setLoading(true); setSessionError(null)
    try {
      if (!getToken()) { setMe(null); setWorkspace(null); return }
      const { user, workspaces: wsList } = await apiFetch('/auth/me')
      setMe(user); setWorkspaces(wsList || [])
      if (!wsList?.length) { localStorage.removeItem('whatodo_workspace'); setWorkspace(null); return }
      const active = wsList.find(w => w.id === getWorkspaceId()) || wsList[0]
      localStorage.setItem('whatodo_workspace', active.id)
      setWorkspace(active)
      if (withWelcome) setShowWelcome(true)
      await loadWorkspaceData()
    } catch (e) {
      if ([401, 403].includes(e.status)) logout()
      else setSessionError(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { bootstrap(false); const expired = () => logout(); window.addEventListener('whatodo:session-expired', expired); return () => window.removeEventListener('whatodo:session-expired', expired) }, [])

  async function switchWorkspace(w) {
    localStorage.setItem('whatodo_workspace', w.id)
    setWorkspace(w); setGroups([]); setUsers({}); setDashboardMeta({ group: null, role: null }); setTaskOpen(null)
    setView('dashboard'); setViewGroupId(null)
    await loadWorkspaceData()
    setRefreshKey(k => k + 1)
    toast.success(`Espace · ${w.name}`)
  }

  async function onWorkspaceCreated(w) {
    setWorkspaces(prev => [...prev, w])
    await switchWorkspace(w)
    setOnboardingMode(null)
    // First workspace ever \u2192 launch tutorial
    if (!me?.tutorialSeen) setShowTutorial(true)
  }

  async function onWorkspaceJoined(w) {
    // reload full list to get role/memberCount
    const wsList = await apiFetch('/workspaces').catch(() => [])
    setWorkspaces(wsList)
    const found = wsList.find(x => x.id === w.id)
    if (found) await switchWorkspace(found)
    setOnboardingMode(null)
    if (!me?.tutorialSeen) setShowTutorial(true)
  }

  async function finishTutorial(completed) {
    setShowTutorial(false)
    try {
      const r = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ tutorialSeen: true }) })
      setMe(r.user)
    } catch {}
    if (completed) toast.success("Tutoriel terminé — bienvenue !")
  }

  function onLogin() { bootstrap(true) }
  function logout() {
    localStorage.removeItem('whatodo_token')
    localStorage.removeItem('whatodo_workspace')
    workspaceRequest.current += 1
    setSessionError(null); setWorkspaceError(null); setGroups([]); setUsers({}); setTaskOpen(null)
    setMe(null); setWorkspaces([]); setWorkspace(null); setView('dashboard')
  }
  function refresh() { setRefreshKey(k => k + 1) }
  function openTask(t) { setTaskOpen(t) }
  function openCreateTask() {
    if (workspace?.archivedAt || (dashboardMeta.role || workspace?.myRole) === 'viewer') return toast.error('Accès en lecture seule')
    setCreateOpen(true)
  }
  function taskUpdated(t) { setTaskOpen(t); refresh() }
  function goto(k) { setView(k); setSidebarOpen(false); setViewGroupId(null) }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <WhatodoLogo size={40} stroke="#ffffff" className="opacity-80 anim-logo-breath" />
    </div>
  )
  if (sessionError) return <div className="max-w-lg mx-auto py-20 px-4"><LoadError error={sessionError} onRetry={() => bootstrap(false)} /></div>
  if (!me) return <LoginScreen onLogin={onLogin} />

  // Show welcome splash
  if (showWelcome && workspace) {
    return <WelcomeSplash name={me.firstName} onDone={() => setShowWelcome(false)} />
  }

  // No workspace yet → onboarding
  if (!workspace) {
    return <OnboardingScreen user={me}
      onCreated={onWorkspaceCreated}
      onJoined={onWorkspaceJoined}
      onLogout={logout} />
  }

  // Onboarding overlays (from switcher)
  if (onboardingMode === 'create' || onboardingMode === 'join') {
    return <OnboardingScreen user={me}
      onCreated={onWorkspaceCreated}
      onJoined={onWorkspaceJoined}
      onLogout={() => setOnboardingMode(null)} />
  }

  const role = dashboardMeta.role || workspace.myRole
  const myGroupId = workspace.myGroupId
  const canValidate = ['owner','admin','leader'].includes(role)
  const isAdmin = ['owner','admin'].includes(role)

  // Build a `me` object with workspace context for children
  const meCtx = { ...me, role, groupId: myGroupId, readOnly: !!workspace.archivedAt }

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Mes tâches', icon: ListChecks },
    { key: 'group', label: 'Mon groupe', icon: Users, hidden: !myGroupId },
    ...(canValidate ? [{ key: 'validation', label: 'Validation', icon: CheckCheck }] : []),
    { key: 'calendar', label: 'Calendrier', icon: CalIcon },
    { key: 'gantt', label: 'Gantt', icon: GanttChart },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
    { key: 'notifs', label: 'Notifications', icon: Bell },
    ...(isAdmin ? [{ key: 'pilot', label: 'Pilotage', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ key: 'admin_groups', label: 'Tous groupes', icon: Shield }] : []),
    { key: 'members', label: 'Membres', icon: UserIcon },
    { key: 'settings', label: 'Paramètres', icon: Settings },
    { key: 'profile', label: 'Mon profil', icon: UserIcon },
  ].filter(n => !n.hidden)

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-[color:var(--w-border)]">
        <div className="flex items-center gap-2 px-2 pt-1">
          <WhatodoLogo size={20} stroke="#ffffff" className="opacity-95" />
          <p className="font-semibold text-[13px] tracking-tight">Whatodo</p>
        </div>
        <WorkspaceSwitcher
          workspaces={workspaces}
          active={workspace}
          onSwitch={switchWorkspace}
          onOpenCreate={() => setOnboardingMode('create')}
          onOpenJoin={() => setOnboardingMode('join')} />
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(n => (
          <button key={n.key}
            onClick={() => !n.soon && goto(n.key)}
            disabled={n.soon}
            className={`nav-item w-full ${view === n.key ? 'nav-item-active' : ''} ${n.soon ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}>
            <n.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{n.label}</span>
            {n.key === 'notifs' && notifs.unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-semibold tabular-nums">{notifs.unread}</span>
            )}
            {n.soon && <span className="text-[9px] uppercase tracking-widest text-3">soon</span>}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setInvitePanelOpen(true)}
            className="nav-item w-full mt-2 border border-dashed border-[color:var(--w-border)]">
            <Plus className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Inviter</span>
          </button>
        )}
      </nav>
      <div className="p-3 border-t border-[color:var(--w-border)]">
        <button onClick={() => goto('profile')} className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition text-left">
          {me.avatar ? (
            <img src={me.avatar} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <UserAvatar user={me} size={32} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate">{me.firstName}</p>
            <p className="text-[10.5px] text-3 truncate">{ROLE_LABEL[role] || role}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); logout() }} className="icon-btn" title="Déconnexion">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </button>
      </div>
    </div>
  )

  const currentView = (() => {
    switch (view) {
      case 'dashboard': return <DashboardView me={meCtx} group={dashboardMeta.group} users={users} onOpenTask={openTask} onNavigate={goto} onCreate={openCreateTask} />
      case 'tasks': return <TasksView me={meCtx} users={users} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'group': return <GroupView me={meCtx} users={users} onOpenTask={openTask} refreshKey={refreshKey} groupId={viewGroupId} onCreate={openCreateTask} />
      case 'validation': return <ValidationView users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'admin_groups': return <AllGroupsView groups={groups} users={users} canManage={isAdmin && !workspace.archivedAt} onRefresh={async () => { await loadWorkspaceData(); refresh() }} onOpenGroup={gid => { setViewGroupId(gid); setView('group') }} />
      case 'members': return <MembersView workspace={workspace} canManage={isAdmin} refreshKey={refreshKey} onRefresh={() => { loadWorkspaceData(); refresh() }} />
      case 'calendar': return <CalendarView me={meCtx} users={users} onOpenTask={openTask} onCreate={openCreateTask} refreshKey={refreshKey} />
      case 'gantt': return <GanttView me={meCtx} users={users} groups={groups} onOpenTask={openTask} refreshKey={refreshKey} />
      case 'chat': return <ChatView me={meCtx} users={users} groups={groups} refreshKey={refreshKey} />
      case 'notifs': return <NotificationsView notifications={notifs.notifications} error={notifs.error} onRetry={notifs.reload}
        onGoto={(link) => { if (link?.view) goto(link.view) }}
        onMarkRead={(id) => apiFetch('/notifications/mark-read', { method: 'POST', body: JSON.stringify({ id }) }).then(() => notifs.reload()).catch(e => toast.error(e.message))}
        onMarkAllRead={() => apiFetch('/notifications/mark-read', { method: 'POST', body: '{}' }).then(() => notifs.reload()).catch(e => toast.error(e.message))} />
      case 'pilot': return <PilotView users={users} groups={groups} refreshKey={refreshKey} onOpenTask={openTask} onNavigate={goto} />
      case 'profile': return <ProfileView me={me} onUpdated={u => setMe(u)} onLogout={logout} onReplayTutorial={() => setShowTutorial(true)} />
      case 'settings': return <WorkspaceSettingsView workspace={workspace} canManage={isAdmin} isOwner={role === 'owner'} users={users}
        onUpdated={w => { setWorkspace(prev => ({ ...prev, ...w })); setWorkspaces(prev => prev.map(x => x.id === workspace.id ? { ...x, ...w } : x)); loadWorkspaceData() }}
        onLeft={() => { const rest = workspaces.filter(x => x.id !== workspace.id); setWorkspaces(rest); if (rest.length) switchWorkspace(rest[0]); else { setWorkspace(null); setView('dashboard') } }}
        onDeleted={() => { const rest = workspaces.filter(x => x.id !== workspace.id); setWorkspaces(rest); if (rest.length) switchWorkspace(rest[0]); else { setWorkspace(null); setView('dashboard') } }} />
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
      <aside className="hidden md:flex md:flex-col w-[240px] fixed inset-y-0 left-0 border-r border-[color:var(--w-border)] bg-[color:var(--w-bg)] z-30">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40 md:hidden anim-fade" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-[color:var(--w-bg)] border-r border-[color:var(--w-border)] z-50 md:hidden anim-fade">
            {Sidebar}
          </aside>
        </>
      )}

      <main className="flex-1 md:ml-[240px] min-w-0 pb-24 md:pb-8 relative z-10">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-[color:var(--w-bg)]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[color:var(--w-border)]">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-white text-[10px] shrink-0"
              style={{ background: workspace.color || '#3b82f6' }}>
              {workspace.icon || workspace.name[0]}
            </div>
            <p className="font-semibold text-sm truncate">{workspace.name}</p>
          </div>
          <button onClick={openCreateTask} className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div key={workspace.id} className="px-4 md:px-10 py-6 md:py-10 max-w-[1400px] mx-auto">
          {workspaceError ? <LoadError error={workspaceError} onRetry={loadWorkspaceData} /> : currentView}
        </div>

        {/* Mobile bottom nav (glass) */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 w-glass rounded-2xl p-1.5 flex justify-around">
          {bottomNav.map(n => {
            const shortLabel = n.key === 'dashboard' ? 'Accueil'
              : n.key === 'tasks' ? 'Tâches'
              : n.key === 'group' ? 'Groupe'
              : n.key === 'validation' ? 'Valider'
              : n.key === 'admin_groups' ? 'Espace'
              : n.label
            return (
              <button key={n.key} onClick={() => goto(n.key)} aria-label={n.label}
                className={`flex-1 min-w-0 flex flex-col items-center py-2 gap-0.5 rounded-xl transition ${
                  view === n.key ? 'bg-white text-[#0a1428]' : 'text-2'
                }`}>
                <n.icon className="w-4 h-4" />
                <span className="text-[10px] font-medium truncate max-w-full px-1">{shortLabel}</span>
              </button>
            )
          })}
        </nav>
      </main>

      <TaskDialog task={taskOpen} open={!!taskOpen} onClose={() => setTaskOpen(null)}
        me={meCtx} users={users} groups={groups} onUpdated={taskUpdated} onDeleted={() => refresh()} />
      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)}
        me={meCtx} groups={groups} onCreated={() => refresh()} />
      {invitePanelOpen && (
        <InvitePanel workspace={workspace} canManage={isAdmin}
          onClose={() => setInvitePanelOpen(false)}
          onRegenerated={code => setWorkspace(w => ({ ...w, inviteCode: code }))} />
      )}
      {showTutorial && <TutorialTour onFinish={finishTutorial} />}
    </div>
  )
}
