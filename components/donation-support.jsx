'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { apiFetch, getWorkspaceId } from '@/lib/api-client'
import { Copy, Heart } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DONATION_CONFIG, amountInCents, displayPhone, formatDonation, validateDonation } from '@/lib/donations'

function DonationFlow({ onClose, onBusy }) {
  const [workspaceId] = useState(getWorkspaceId)
  const requestId = useRef(null)
  const sending = useRef(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const successRef = useRef(null)
  useEffect(() => { if (saved) successRef.current?.focus() }, [saved])
  const prefix = useId()
  const [form, setForm] = useState({ firstName: '', lastName: '', amount: '5' })
  const [custom, setCustom] = useState(false)
  const [errors, setErrors] = useState({})
  const [instructions, setInstructions] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const firstNameRef = useRef(null)
  const lastNameRef = useRef(null)
  const amountRef = useRef(null)
  const summaryRef = useRef(null)
  const phoneRef = useRef(null)
  const cents = amountInCents(form.amount)
  const inputClass = 'w-full h-11 px-3 rounded-xl bg-[color:var(--w-surface)] border border-[color:var(--w-border)] text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30'

  useEffect(() => {
    if (instructions) summaryRef.current?.focus()
    else firstNameRef.current?.focus()
  }, [instructions])
  useEffect(() => {
    if (custom) amountRef.current?.focus()
  }, [custom])

  function update(field, value) {
    setForm(previous => ({ ...previous, [field]: value }))
    setErrors(previous => ({ ...previous, [field]: undefined }))
  }

  function proceed(event) {
    event.preventDefault()
    const result = validateDonation(form)
    setErrors(result.errors)
    const invalid = Object.keys(result.errors)[0]
    if (invalid) {
      if (invalid === 'amount') setCustom(true)
      const fieldRef = { firstName: firstNameRef, lastName: lastNameRef, amount: amountRef }[invalid]
      fieldRef.current?.focus()
      return
    }
    setInstructions(true)
  }

  async function copyPhone() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(DONATION_CONFIG.phone)
      setCopyMessage('Numéro copié.')
    } catch {
      phoneRef.current?.focus()
      phoneRef.current?.select()
      setCopyMessage('La copie automatique est indisponible. Le numéro est sélectionné : copie-le manuellement.')
    }
  }

  async function declareDonation() {
    if (sending.current) return
    sending.current = true
    setLoading(true); onBusy(true); setSubmitError('')
    try {
      requestId.current ||= crypto.randomUUID()
      await apiFetch('/donations', { method: 'POST', headers: { 'X-Workspace-Id': workspaceId || '' }, body: JSON.stringify({
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        amount: form.amount, currency: 'CHF', requestId: requestId.current,
      }) })
      setSaved(true)
    } catch (error) { setSubmitError(error.message) }
    finally { sending.current = false; setLoading(false); onBusy(false) }
  }

  if (saved) return <>
    <DialogHeader>
      <DialogTitle ref={successRef} tabIndex={-1}>Merci pour ton soutien ❤️</DialogTitle>
      <DialogDescription>Ta déclaration de don a bien été enregistrée.</DialogDescription>
    </DialogHeader>
    <p className="text-sm text-2">Don déclaré comme effectué. Whatodo ne vérifie pas le paiement TWINT.</p>
    <button type="button" onClick={onClose} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm">Fermer</button>
  </>

  return <>
    <DialogHeader className="text-left pr-6">
      <DialogTitle className="text-xl">Soutenir Whatodo ❤️</DialogTitle>
      <DialogDescription className="text-2 leading-relaxed pt-2">
        Whatodo est actuellement mis à disposition gratuitement. Si tu souhaites soutenir le projet, tu peux participer librement aux frais de fonctionnement, notamment l’hébergement et la base de données. Chaque contribution est facultative et permet d’aider à maintenir le service en ligne.
      </DialogDescription>
    </DialogHeader>
    <p className="text-xs text-2">Aucune contribution n’est obligatoire pour utiliser Whatodo.</p>

    {!instructions ? <form noValidate onSubmit={proceed} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['firstName', 'lastName'].map(field => <div key={field} className="space-y-1.5">
          <label htmlFor={`${prefix}-${field}`} className="block text-sm">{field === 'firstName' ? 'Prénom' : 'Nom'}</label>
          <input id={`${prefix}-${field}`} ref={field === 'firstName' ? firstNameRef : lastNameRef} required maxLength={80}
            autoComplete={field === 'firstName' ? 'given-name' : 'family-name'} value={form[field]}
            onChange={event => update(field, event.target.value)} className={inputClass}
            aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${prefix}-${field}-error` : undefined} />
          {errors[field] && <p id={`${prefix}-${field}-error`} className="text-xs text-red-300" role="alert">{errors[field]}</p>}
        </div>)}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm mb-2">Montant en CHF</legend>
        <div className="grid grid-cols-4 gap-2">
          {DONATION_CONFIG.presets.map(amount => <button key={amount} type="button" aria-pressed={!custom && form.amount === String(amount)}
            onClick={() => { setCustom(false); update('amount', String(amount)) }}
            className={`h-10 rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${!custom && form.amount === String(amount) ? 'btn-primary' : 'btn-ghost'}`}>
            CHF {amount}
          </button>)}
        </div>
        <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); update('amount', '') }}
          className="btn-ghost rounded-xl px-3 py-2 text-sm">Autre montant</button>
        {custom && <div className="space-y-1.5">
          <label htmlFor={`${prefix}-amount`} className="block text-sm">Montant personnalisé (CHF)</label>
          <input id={`${prefix}-amount`} ref={amountRef} type="text" inputMode="decimal" required maxLength={6} autoComplete="off"
            value={form.amount} onChange={event => update('amount', event.target.value)} className={inputClass}
            aria-invalid={!!errors.amount} aria-describedby={`${prefix}-amount-help${errors.amount ? ` ${prefix}-amount-error` : ''}`} />
          <p id={`${prefix}-amount-help`} className="text-xs text-3">De CHF 0.01 à CHF 200.00.</p>
        </div>}
        {errors.amount && <p id={`${prefix}-amount-error`} role="alert" className="text-xs text-red-300">{errors.amount}</p>}
      </fieldset>
      {cents !== null && <p aria-live="polite" className="text-sm text-2">Tu souhaites contribuer <span className="text-white font-semibold">{formatDonation(cents)}</span> à Whatodo.</p>}
      <p className="text-xs text-3">Tes prénom, nom et montant seront enregistrés avec ton compte et cet espace uniquement si tu cliques sur « J’ai fait le don ». Les owner/admin de cet espace recevront une notification.</p>
      <button type="submit" className="btn-primary w-full min-h-11 rounded-xl px-4 py-2 text-sm">Continuer avec TWINT</button>
    </form> : <div className="space-y-4">
      <div ref={summaryRef} tabIndex={-1} className="surface-flat rounded-xl p-4 space-y-2 outline-none">
        <p className="text-sm text-2">{form.firstName.trim()} {form.lastName.trim()}</p>
        <p className="text-sm">Tu souhaites contribuer <strong>{formatDonation(cents)}</strong> à Whatodo.</p>
      </div>
      <p className="text-sm text-2">Ouvre manuellement ton application TWINT sur ton téléphone. Dans « Envoyer », saisis <strong className="text-white">{formatDonation(cents)}</strong> et le numéro suivant :</p>
      <div className="space-y-2">
        <label htmlFor={`${prefix}-phone`} className="block text-xs text-3">Numéro TWINT destinataire</label>
        <input ref={phoneRef} id={`${prefix}-phone`} readOnly value={displayPhone()} className={`${inputClass} text-lg tabular-nums`} onFocus={event => event.target.select()} />
        <button type="button" onClick={copyPhone} className="btn-primary w-full min-h-11 rounded-xl px-4 py-2 text-sm inline-flex items-center justify-center gap-2">
          <Copy aria-hidden="true" className="w-4 h-4" /> Copier le numéro
        </button>
        <p role="status" className="text-xs text-2">{copyMessage}</p>
      </div>
      <p className="text-xs text-2">Vérifie le destinataire et le montant dans TWINT avant de confirmer. Whatodo ne peut ni ouvrir automatiquement ton app ni confirmer le paiement.</p>
      <p className="text-sm text-2">Une fois ton paiement effectué dans TWINT, reviens ici et clique sur ‘J’ai fait le don’.</p>
      <p className="text-xs text-3">Il s’agit de ta déclaration, pas d’une vérification du paiement par Whatodo.</p>
      {submitError && <p role="alert" className="text-sm text-red-300">{submitError} Tu peux réessayer : la même déclaration sera réutilisée.</p>}
      <div className="flex flex-wrap gap-2" aria-busy={loading}>
        <button type="button" disabled={loading} onClick={declareDonation} className="btn-primary flex-1 min-h-11 rounded-xl px-4 py-2 text-sm disabled:opacity-50">{loading ? 'Enregistrement…' : 'J’ai fait le don'}</button>
        <button type="button" disabled={loading} onClick={onClose} className="btn-ghost min-h-11 rounded-xl px-4 py-2 text-sm disabled:opacity-50">Abandonner</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={loading || !!requestId.current} onClick={() => { setInstructions(false); setCopyMessage('') }} className="btn-ghost rounded-xl px-3 py-2 text-sm">Modifier</button>
        <a href={DONATION_CONFIG.instructionsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-2 underline underline-offset-4 hover:text-white">Guide officiel TWINT<span className="sr-only"> (nouvel onglet)</span></a>
      </div>
    </div>}
  </>
}

export function DonationSupport() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
    <DialogTrigger asChild>
      <button type="button" className="nav-item w-full mb-2 text-2">
        <Heart aria-hidden="true" className="w-4 h-4 shrink-0" />
        <span className="text-left text-[13px]">Faire un don</span>
      </button>
    </DialogTrigger>
    <DialogContent className="w-glass w-[calc(100%_-_2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border-white/10 p-5 sm:p-6">
      {open && <DonationFlow onClose={() => setOpen(false)} onBusy={setBusy} />}
    </DialogContent>
  </Dialog>
}
