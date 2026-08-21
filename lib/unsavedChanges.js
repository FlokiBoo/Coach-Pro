// Signal partagé "modifications non sauvegardées", pour éviter de perdre en silence des
// éditions locales (ex. programme en cours d'édition) en cliquant sur un lien de nav.
// Le beforeunload natif ne couvre que la fermeture/rechargement de l'onglet, pas les
// transitions client-side de Next.js (<Link>) — d'où ce garde-fou séparé.
let dirty = false

export function setUnsavedChanges(value) {
  dirty = value
}

export function hasUnsavedChanges() {
  return dirty
}

// À poser sur le onClick d'un <Link> ou bouton de navigation : bloque et demande
// confirmation s'il reste des modifications non sauvegardées.
export function guardNavigation(e) {
  if (!dirty) return true
  const proceed = window.confirm('Tu as des modifications non sauvegardées sur cette page. Les quitter sans enregistrer ?')
  if (!proceed) e.preventDefault()
  return proceed
}
