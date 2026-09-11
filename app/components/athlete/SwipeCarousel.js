'use client'

import { useRef, useState, useCallback } from 'react'

// Carrousel swipe générique (scroll-snap natif, pas de lib) — pattern pensé pour être réutilisé
// (Objectifs, Séance du jour, Performances...). `slides` : [{ key, content }]. `onIndexChange`
// optionnel, appelé avec l'index actif. `peek` : les slides font ~88% de la largeur au lieu de
// 100%, pour laisser deviner la suivante en bord de carrousel (au lieu de calculer les offsets de
// scroll à la main, ce qui devient faux dès que les slides ne font plus exactement clientWidth, on
// mesure la position réelle de chaque slide via ses refs — robuste avec ou sans peek).
export default function SwipeCarousel({ slides, onIndexChange, activeColor = 'var(--bordeaux)', peek = false }) {
  const trackRef = useRef(null)
  const slideRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)
  const rafRef = useRef(null)

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      // Slide dont le bord gauche est le plus proche du scroll courant — fiable que les slides
      // fassent 100% ou 88% (peek), contrairement à un calcul par division de largeurs fixes.
      let closest = 0
      let closestDist = Infinity
      slideRefs.current.forEach((node, i) => {
        if (!node) return
        const dist = Math.abs(node.offsetLeft - el.scrollLeft)
        if (dist < closestDist) { closestDist = dist; closest = i }
      })
      setActiveIndex(prev => {
        if (closest === prev) return prev
        onIndexChange?.(closest)
        return closest
      })
    })
  }, [onIndexChange])

  const goTo = (idx) => {
    const el = trackRef.current
    const node = slideRefs.current[idx]
    if (!el || !node) return
    el.scrollTo({ left: node.offsetLeft, behavior: 'smooth' })
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', gap: peek ? 10 : 0,
        }}
      >
        {slides.map((s, i) => (
          <div key={s.key} ref={node => { slideRefs.current[i] = node }}
            style={{ flex: peek ? '0 0 88%' : '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}>
            {s.content}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: 8, height: 8, borderRadius: '50%', padding: 0, cursor: 'pointer', boxSizing: 'border-box',
                background: i === activeIndex ? activeColor : 'transparent',
                // Pastille inactive juste en fond beige plein contraste mal (--ostryk-chip-border
                // trop proche de --beige) : contour visible plutôt que remplissage plat.
                border: i === activeIndex ? 'none' : '1.5px solid var(--ostryk-text3)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
