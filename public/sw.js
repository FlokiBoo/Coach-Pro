const CACHE = 'coachpro-v2'

// Installation : cache les pages essentielles
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/']))
  )
})

// Activation : supprime les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Appels Supabase (données) — jamais interceptés, toujours en direct
  if (url.hostname.includes('supabase.co')) return

  // Pages HTML (navigation) — Network first, cache en fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // Assets statiques (JS, CSS, images) — Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put(event.request, copy))
        }
        return response
      })
    })
  )
})
