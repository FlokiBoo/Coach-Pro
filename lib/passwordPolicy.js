// Politique de mot de passe commune à tous les écrans (définition, réinitialisation, inscription).
// Utilisée côté client (retour visuel immédiat) et côté serveur (/api/signup) — le contrôle client
// seul est contournable, donc toute route qui écrit un mot de passe doit revalider ici aussi.
export const PASSWORD_MIN_LENGTH = 10
const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']/

export function passwordRuleChecks(password) {
  return [
    { key: 'length', label: `${PASSWORD_MIN_LENGTH} caractères minimum`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { key: 'upper', label: 'Une majuscule', ok: /[A-Z]/.test(password) },
    { key: 'digit', label: 'Un chiffre', ok: /[0-9]/.test(password) },
    { key: 'special', label: 'Un caractère spécial (!?#…)', ok: SPECIAL_CHAR_RE.test(password) },
  ]
}

export function isPasswordValid(password) {
  return passwordRuleChecks(password || '').every(c => c.ok)
}

// Message d'erreur unique (utilisé côté serveur, où l'affichage détaillé case par case n'a pas sa place)
export function passwordPolicyMessage() {
  return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, une majuscule, un chiffre et un caractère spécial.`
}
