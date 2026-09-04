export const LAST_PATH_KEY = 'ostryk_last_path'

export function clearLastPath() {
  try { localStorage.removeItem(LAST_PATH_KEY) } catch { /* pas bloquant */ }
}
