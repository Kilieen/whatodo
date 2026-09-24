// A network failure must never destroy a valid persistent session.
export function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('whatodo_token') : null }
export function getWorkspaceId() { return typeof window !== 'undefined' ? localStorage.getItem('whatodo_workspace') : null }
const pendingReads = new Map()
export async function apiFetch(path, opts = {}) {
  const token = getToken()
  const wid = getWorkspaceId()
  const method = opts.method || 'GET'
  const key = JSON.stringify([path, token, wid])
  if (method === 'GET' && pendingReads.has(key)) return pendingReads.get(key)
  const run = async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch('/api' + path, {
        ...opts, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(wid ? { 'X-Workspace-Id': wid } : {}), ...(opts.headers || {}) },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const fallback = res.status === 401 ? 'Session expirée. Reconnectez-vous.' : res.status === 403 ? 'Vous n’avez pas accès à cette action.' : res.status >= 500 ? 'Service temporairement indisponible. Réessayez.' : 'La demande a échoué.'
        const error = new Error(data?.error || fallback)
        error.status = res.status
        // Workspace 403 is not an invalid JWT. Login failures are not session expiry either.
        if ((res.status === 401 && token && !path.startsWith('/auth/')) || (path === '/auth/me' && [401, 403].includes(res.status))) {
          if (getToken() === token) window.dispatchEvent(new Event('whatodo:session-expired'))
        }
        throw error
      }
      if (data === null) throw new Error('Réponse du serveur invalide. Réessayez.')
      if (data.token && ['/auth/change-password', '/auth/reset-password'].includes(path)) localStorage.setItem('whatodo_token', data.token)
      return data
    } catch (error) {
      if (controller.signal.aborted) { const e = new Error('Le serveur met trop de temps à répondre. Réessayez.'); e.code = 'TIMEOUT'; throw e }
      if (error instanceof TypeError) { const e = new Error('Connexion indisponible. Votre session est conservée.'); e.code = 'NETWORK'; throw e }
      throw error
    } finally { clearTimeout(timeout) }
  }
  const promise = run()
  if (method === 'GET') pendingReads.set(key, promise)
  try { return await promise } finally { if (pendingReads.get(key) === promise) pendingReads.delete(key) }
}
