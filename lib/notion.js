const NOTION_VERSION = '2022-06-28'

function notionFetch(path, options = {}) {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

// Pousse une ligne de paiement dans la base Notion "CoachPro — Finances". Silencieux si
// NOTION_API_KEY/NOTION_DATABASE_ID ne sont pas configurés (pont optionnel).
export async function pushPaymentToNotion({ athleteName, amount, date, status, tier, invoiceId }) {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) return

  // Évite les doublons si Stripe livre le même événement webhook plusieurs fois.
  const query = await notionFetch(`/databases/${process.env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({ filter: { property: 'Invoice ID', rich_text: { equals: invoiceId } } }),
  })
  const { results } = await query.json().catch(() => ({ results: [] }))
  if (results?.length) return

  await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        'Sportif': { title: [{ text: { content: athleteName || '—' } }] },
        'Montant': { number: amount },
        'Date': { date: { start: date } },
        'Statut': { select: { name: status } },
        'Formule': { rich_text: [{ text: { content: tier || '' } }] },
        'Invoice ID': { rich_text: [{ text: { content: invoiceId } }] },
      },
    }),
  })
}
