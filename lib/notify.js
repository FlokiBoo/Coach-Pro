// Prévient le(s) sportif(s) par mail qu'un programme ou une séance vient de leur être attribué(e).
// Fire-and-forget côté UI : un échec d'envoi ne doit jamais bloquer l'action du coach.
export async function notifyAssigned({ athleteIds, kind, title }) {
  try {
    await fetch('/api/notify/assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteIds, kind, title }),
    })
  } catch (err) {
    console.error('notifyAssigned failed:', err)
  }
}
