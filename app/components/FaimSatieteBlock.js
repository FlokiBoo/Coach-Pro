'use client'

import { useState } from 'react'

const FAIM_DESCS = {
  0: "Aucune faim", 1: "Faim très légère, imperceptible", 2: "Faim très légère, imperceptible",
  3: "Léger creux, bonne conscience corporelle", 4: "Léger creux, bonne conscience corporelle",
  5: "Faim modérée — zone idéale pour manger", 6: "Faim modérée — zone idéale pour manger", 7: "Faim modérée — zone idéale pour manger",
  8: "Faim intense — crampes, irritabilité possibles", 9: "Faim intense — crampes, irritabilité possibles", 10: "Faim très intense, désagréable",
}

const SAT_DESCS = {}
for (let i = 1; i <= 10; i++) {
  const pct = i * 20
  let d
  if (pct <= 40) d = "Estomac creux, envie de continuer"
  else if (pct <= 80) d = "Encore de la place, faim pas apaisée"
  else if (pct <= 120) d = "Zone à repérer — plein sans douleur, apaisement"
  else if (pct <= 160) d = "Au-delà du confort, plaisir qui redescend"
  else d = "Écœurement, inconfort digestif"
  SAT_DESCS[i] = `${d} (~${pct}%)`
}

const SIGNES_OPTIONS = [
  { val: 'salivation', label: 'Salivation' },
  { val: 'gargouillement', label: 'Gargouillement' },
  { val: 'concentration', label: 'Baisse de concentration' },
  { val: 'fatigue', label: 'Fatigue' },
  { val: 'gorge', label: 'Gorge serrée' },
  { val: 'aucun', label: 'Aucune' },
]

function Chip({ active, onClick, children, warm }) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${active ? (warm ? '#e0762f' : '#2f9e8f') : '#2c363c'}`,
      background: active ? (warm ? '#e0762f33' : '#2f9e8f33') : '#1c252b',
      color: active ? (warm ? '#ffb787' : '#8fe8da') : '#c4ccd0',
      fontSize: 13.5, fontWeight: 500, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
      fontFamily: 'inherit', transition: '.15s',
    }}>
      {children}
    </button>
  )
}

function Gauge({ value, onSelect, warm, top, bottom }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, height: 38 }}>
        {Array.from({ length: 10 }, (_, idx) => idx + 1).map(i => (
          <button key={i} onClick={() => onSelect(i)} style={{
            flex: 1, borderRadius: 5, border: 'none', padding: 0, cursor: 'pointer', transition: '.15s',
            background: value !== null && i <= value ? (warm ? '#e0762f' : '#2f9e8f') : '#2a343a',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#667277' }}>
        <span>{top}</span><span>{bottom}</span>
      </div>
    </div>
  )
}

export default function FaimSatieteBlock() {
  const [tab, setTab] = useState('faim')
  const [faim, setFaim] = useState({ gauge: null, loc: null, neutre: null, signes: new Set() })
  const [sat, setSat] = useState({ gauge: null, gout: null, creux: null, apres: null })

  const toggleSigne = (val) => {
    setFaim(f => {
      const signes = new Set(f.signes)
      if (signes.has(val)) signes.delete(val)
      else {
        if (val === 'aucun') signes.clear()
        else signes.delete('aucun')
        signes.add(val)
      }
      return { ...f, signes }
    })
  }

  const faimLines = []
  if (faim.loc === 'tete') faimLines.push("Sensation localisée dans la tête / envie précise : évoque plutôt une envie ou une émotion qu'une faim physiologique.")
  if (faim.neutre === 'non') faimLines.push("Un aliment neutre ne tente pas : signal cohérent avec une envie ciblée, pas une faim générale.")
  if (faim.neutre === 'oui') faimLines.push("Un aliment neutre tenterait quand même : signal cohérent avec une vraie faim physiologique.")
  if (faim.signes.has('aucun')) faimLines.push("Aucune sensation physique repérée : prudence avant de conclure à une faim.")
  else if (faim.signes.size > 0) faimLines.push(`${faim.signes.size} signal(aux) physique(s) présent(s) — cohérent avec une faim en cours.`)
  if (faim.gauge !== null) {
    if (faim.gauge <= 2) faimLines.push("Niveau faible : pas urgent, mais restez attentif à l'évolution.")
    else if (faim.gauge <= 4) faimLines.push("Léger creux : bon moment pour anticiper le prochain repas.")
    else if (faim.gauge <= 7) faimLines.push("Zone favorable pour manger.")
    else faimLines.push("Niveau élevé : mangez sans attendre, dans le calme.")
  }
  const faimHasAny = faim.gauge !== null || faim.loc || faim.neutre || faim.signes.size > 0

  const satLines = []
  if (sat.gout === 'diminue') satLines.push("Le plaisir gustatif diminue : signal fiable de rassasiement en approche.")
  if (sat.gout === 'oui') satLines.push("Le goût reste aussi intense : le rassasiement n'est probablement pas encore atteint.")
  if (sat.creux === 'non') satLines.push("Le creux a disparu : bon indicateur d'arrêt.")
  if (sat.creux === 'oui') satLines.push("Le creux persiste : il reste probablement de la place.")
  if (sat.apres === 'non') satLines.push("Vous n'y penseriez pas dans 10 min : c'était suffisant.")
  if (sat.apres === 'oui') satLines.push("La pensée reviendrait vite : la faim n'est pas totalement comblée.")
  if (sat.gauge !== null) {
    const pct = sat.gauge * 20
    if (pct < 80) satLines.push("Rassasiement encore faible.")
    else if (pct <= 120) satLines.push("Zone cible atteinte — bon moment pour s'arrêter.")
    else satLines.push("Au-delà de la zone confortable.")
  }
  const satHasAny = sat.gauge !== null || sat.gout || sat.creux || sat.apres

  const isFaim = tab === 'faim'

  return (
    <div style={{ background: '#12181c', color: '#eef0ee', borderRadius: 18, padding: '18px 16px', fontFamily: 'inherit' }}>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7c8a90', marginBottom: 14 }}>Instrument de repérage</div>

      <div style={{ display: 'flex', background: '#1c252b', borderRadius: 14, padding: 4, gap: 4, border: '1px solid #2c363c', marginBottom: 16 }}>
        <button onClick={() => setTab('faim')} style={{
          flex: 1, border: 'none', background: isFaim ? '#e0762f' : 'transparent', color: isFaim ? '#171008' : '#8a9499',
          fontSize: 14, fontWeight: 600, padding: '11px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: '.2s',
        }}>Faim</button>
        <button onClick={() => setTab('satiete')} style={{
          flex: 1, border: 'none', background: !isFaim ? '#2f9e8f' : 'transparent', color: !isFaim ? '#08201c' : '#8a9499',
          fontSize: 14, fontWeight: 600, padding: '11px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: '.2s',
        }}>Satiété</button>
      </div>

      {isFaim ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Où se situe la sensation ?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip warm active={faim.loc === 'estomac'} onClick={() => setFaim(f => ({ ...f, loc: 'estomac' }))}>Estomac / corps</Chip>
              <Chip warm active={faim.loc === 'tete'} onClick={() => setFaim(f => ({ ...f, loc: 'tete' }))}>Tête / envie précise</Chip>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Un aliment neutre (pomme, blanc de poulet) vous tenterait ?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip warm active={faim.neutre === 'oui'} onClick={() => setFaim(f => ({ ...f, neutre: 'oui' }))}>Oui</Chip>
              <Chip warm active={faim.neutre === 'non'} onClick={() => setFaim(f => ({ ...f, neutre: 'non' }))}>Non</Chip>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Sensations présentes (plusieurs choix possibles)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SIGNES_OPTIONS.map(o => (
                <Chip key={o.val} warm active={faim.signes.has(o.val)} onClick={() => toggleSigne(o.val)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          <div style={{ margin: '18px 0 22px', background: '#1c252b', border: '1px solid #2c363c', borderRadius: 18, padding: '20px 18px 16px' }}>
            <div style={{ fontSize: 12, color: '#8a9499', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>Niveau de faim</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: '#e0762f' }}>
              {faim.gauge !== null ? `${faim.gauge} / 10` : '—'}
            </div>
            <div style={{ fontSize: 13, color: '#9fadb2', minHeight: 18, marginBottom: 14 }}>
              {faim.gauge !== null ? FAIM_DESCS[faim.gauge] : "Touchez une barre pour évaluer, à présent que vous avez observé les signaux"}
            </div>
            <Gauge value={faim.gauge} onSelect={i => setFaim(f => ({ ...f, gauge: i }))} warm top="0" bottom="10" />
          </div>

          <div style={{
            borderRadius: 16, padding: 18, border: `1px solid ${faimHasAny ? '#e0762f' : '#2c363c'}`, background: '#1c252b', minHeight: 64,
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#7c8a90', marginBottom: 8 }}>Lecture</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: faimHasAny ? '#eef0ee' : '#667277', fontStyle: faimHasAny ? 'normal' : 'italic' }}>
              {faimHasAny ? faimLines.join(' ') : 'En attente de réponses.'}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Le goût est-il aussi intense qu'au début ?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip active={sat.gout === 'oui'} onClick={() => setSat(s => ({ ...s, gout: 'oui' }))}>Oui, pareil</Chip>
              <Chip active={sat.gout === 'diminue'} onClick={() => setSat(s => ({ ...s, gout: 'diminue' }))}>Non, ça diminue</Chip>
              <Chip active={sat.gout === 'sais-pas'} onClick={() => setSat(s => ({ ...s, gout: 'sais-pas' }))}>Je ne sais pas</Chip>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Le creux à l'estomac est-il encore présent ?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip active={sat.creux === 'oui'} onClick={() => setSat(s => ({ ...s, creux: 'oui' }))}>Oui</Chip>
              <Chip active={sat.creux === 'non'} onClick={() => setSat(s => ({ ...s, creux: 'non' }))}>Non</Chip>
              <Chip active={sat.creux === 'sais-pas'} onClick={() => setSat(s => ({ ...s, creux: 'sais-pas' }))}>Je ne sais pas</Chip>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dfe6e8' }}>Si vous arrêtiez maintenant, y penseriez-vous dans les 10 min ?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip active={sat.apres === 'oui'} onClick={() => setSat(s => ({ ...s, apres: 'oui' }))}>Oui, clairement</Chip>
              <Chip active={sat.apres === 'non'} onClick={() => setSat(s => ({ ...s, apres: 'non' }))}>Non, ce serait suffisant</Chip>
              <Chip active={sat.apres === 'sais-pas'} onClick={() => setSat(s => ({ ...s, apres: 'sais-pas' }))}>Je ne sais pas</Chip>
            </div>
          </div>

          <div style={{ margin: '18px 0 22px', background: '#1c252b', border: '1px solid #2c363c', borderRadius: 18, padding: '20px 18px 16px' }}>
            <div style={{ fontSize: 12, color: '#8a9499', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>Niveau de rassasiement</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: '#2f9e8f' }}>
              {sat.gauge !== null ? `${sat.gauge * 20}%` : '—'}
            </div>
            <div style={{ fontSize: 13, color: '#9fadb2', minHeight: 18, marginBottom: 14 }}>
              {sat.gauge !== null ? SAT_DESCS[sat.gauge] : "Touchez une barre pour évaluer, à présent que vous avez observé les signaux (échelle 0—200%)"}
            </div>
            <Gauge value={sat.gauge} onSelect={i => setSat(s => ({ ...s, gauge: i }))} top="0%" bottom="200%" />
          </div>

          <div style={{
            borderRadius: 16, padding: 18, border: `1px solid ${satHasAny ? '#2f9e8f' : '#2c363c'}`, background: '#1c252b', minHeight: 64,
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#7c8a90', marginBottom: 8 }}>Lecture</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: satHasAny ? '#eef0ee' : '#667277', fontStyle: satHasAny ? 'normal' : 'italic' }}>
              {satHasAny ? satLines.join(' ') : 'En attente de réponses.'}
            </div>
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 0', fontSize: 11, color: '#4d5960' }}>Repère indicatif — pas un diagnostic.</div>
    </div>
  )
}
