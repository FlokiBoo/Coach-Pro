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

// Prévient tous les sportifs actifs qu'un template vient d'être rendu disponible en sélection libre.
export async function notifyProgramAvailable(programId) {
  try {
    await fetch('/api/notify/program-available', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId }),
    })
  } catch (err) {
    console.error('notifyProgramAvailable failed:', err)
  }
}

// Rappelle par mail aux présents d'une séance de groupe de renseigner leur performance.
export async function notifyGroupSessionReminder({ athleteIds, sessionTitle }) {
  try {
    await fetch('/api/notify/group-session-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteIds, sessionTitle }),
    })
  } catch (err) {
    console.error('notifyGroupSessionReminder failed:', err)
  }
}
