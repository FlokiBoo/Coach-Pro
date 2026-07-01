const CACHE = 'coachpro-v1'

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

  // Appels Supabase (données) — Network first, cache en fallback offline
  if (url.hostname.includes('supabase.co')) {
    // On ne cache que les GET (lectures)
    if (event.request.method !== 'GET') return
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Pages HTML (navigation) — Network first, cache en fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
          return response
        })
        .catch(() => caches.match(event.request) || caches.match('/'))
    )
    return
  }

  // Assets statiques (JS, CSS, images) — Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
        }
        return response
      })
    })
  )
})

// Message depuis la page : pré-charger les données de la prochaine séance
self.addEventListener('message', event => {
  if (event.data?.type === 'PREFETCH_URLS') {
    const urls = event.data.urls || []
    caches.open(CACHE).then(cache => {
      urls.forEach(url => {
        fetch(url, { headers: event.data.headers || {} })
          .then(r => { if (r.ok) cache.put(url, r) })
          .catch(() => {})
      })
    })
  }
})
