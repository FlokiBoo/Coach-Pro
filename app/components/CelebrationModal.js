'use client'

import { useState } from 'react'

const MUSCLE_MAP = {
  'pectoraux':       ['pec', 'poitrine', 'chest', 'pectoral'],
  'deltoïdes':       ['delt', 'épaule', 'epaule', 'shoulder'],
  'biceps':          ['bicep', 'bras'],
  'abdominaux':      ['abdo', 'abs', 'core', 'gainage', 'ventre'],
  'quadriceps':      ['quad', 'quadricep', 'cuisse'],
  'adducteurs':      ['adducteur'],
  'trapèzes':        ['trap', 'trapèze', 'trapeze'],
  'grand dorsal':    ['dorsal', 'dos', 'lat'],
  'triceps':         ['tricep', 'triceps'],
  'lombaires':       ['lombaire', 'bas du dos', 'lower back'],
  'fessiers':        ['fessier', 'glute', 'fesse', 'glutéaux'],
  'ischio-jambiers': ['ischio', 'hamstring'],
  'mollets':         ['mollet', 'calf', 'calves', 'gastro'],
}

const CITATIONS = [
  { texte: "La douleur est temporaire. Abandonner dure pour toujours.", auteur: "Lance Armstrong" },
  { texte: "Je n'ai pas échoué. J'ai juste trouvé 10 000 façons qui ne fonctionnent pas.", auteur: "Thomas Edison" },
  { texte: "Impossible is nothing.", auteur: "Muhammad Ali" },
  { texte: "La différence entre l'impossible et le possible réside dans la détermination.", auteur: "Tommy Lasorda" },
  { texte: "Je ne perds jamais. Soit je gagne, soit j'apprends.", auteur: "Nelson Mandela" },
  { texte: "Ce que l'esprit peut concevoir et croire, il peut l'accomplir.", auteur: "Muhammad Ali" },
  { texte: "Les champions ne sont pas faits dans les salles de sport. Ils sont faits de ce qu'ils ont en eux.", auteur: "Muhammad Ali" },
  { texte: "La sueur, c'est de la graisse qui pleure.", auteur: "Anonyme" },
  { texte: "Le succès, c'est se relever une fois de plus que le nombre de fois où on est tombé.", auteur: "Winston Churchill" },
  { texte: "Je joue chaque match comme si c'était le dernier.", auteur: "Zinédine Zidane" },
  { texte: "Plus fort est celui qui se lève après chaque chute.", auteur: "Vince Lombardi" },
  { texte: "Le talent gagne des matchs, mais le travail d'équipe et l'intelligence gagnent des championnats.", auteur: "Michael Jordan" },
  { texte: "Il n'y a pas de raccourcis vers un endroit qui vaut le déplacement.", auteur: "Beverly Sills" },
  { texte: "Chaque matin tu as le choix. Continue à dormir avec tes rêves ou te lever et les réaliser.", auteur: "Anonyme" },
  { texte: "Ce n'est pas la montagne que nous conquérons, mais nous-mêmes.", auteur: "Edmund Hillary" },
  { texte: "Quelqu'un quelque part s'entraîne pendant que toi tu ne le fais pas. Quand vous vous rencontrez, il gagnera.", auteur: "Tom Fleming" },
  { texte: "La gloire n'est pas de ne jamais tomber, mais de se relever à chaque chute.", auteur: "Confucius" },
  { texte: "Je peux accepter l'échec, tout le monde échoue. Mais je ne peux pas accepter de ne pas essayer.", auteur: "Michael Jordan" },
  { texte: "Le secret, c'est de commencer.", auteur: "Mark Twain" },
  { texte: "Aujourd'hui tu as fait ce que d'autres ne feront jamais.", auteur: "Anonyme" },
  { texte: "Il m'a fallu 17 ans et 114 jours pour devenir une star en une nuit.", auteur: "Lionel Messi" },
  { texte: "Plus dure sera la lutte, plus grande sera la victoire.", auteur: "Thomas Paine" },
  { texte: "Repoussez vos limites ou elles vous repousseront.", auteur: "Anonyme" },
]

function randomCitation() {
  return CITATIONS[Math.floor(Math.random() * CITATIONS.length)]
}

export function parseMusclesFromText(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const active = new Set()
  for (const [group, keywords] of Object.entries(MUSCLE_MAP)) {
    if (keywords.some(k => lower.includes(k))) active.add(group)
  }
  return [...active]
}

const NEUTRAL = '#d1d5db'
const ACTIVE  = '#ef4444'
const SKIN    = '#e5e7eb'
const STROKE  = '#9ca3af'
const SW      = '0.7'

function BodySVG({ active, view }) {
  const c = (id) => active.includes(id) ? ACTIVE : NEUTRAL
  const isFront = view === 'front'

  return (
    <svg viewBox="0 0 100 268" style={{ width: 115, height: 'auto' }}>
      {/* ── Silhouette ── */}
      {/* Head */}
      <ellipse cx="50" cy="19" rx="14" ry="17" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Neck */}
      <rect x="44" y="34" width="12" height="10" rx="3" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Torso */}
      <path d="M29,43 L15,51 L11,82 L13,113 L87,113 L89,82 L85,51 L71,43 Z" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Left upper arm */}
      <ellipse cx="9"  cy="77" rx="7" ry="23" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Right upper arm */}
      <ellipse cx="91" cy="77" rx="7" ry="23" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Left forearm */}
      <ellipse cx="7"  cy="122" rx="6" ry="18" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Right forearm */}
      <ellipse cx="93" cy="122" rx="6" ry="18" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Pelvis */}
      <path d="M13,111 L87,111 L84,138 L74,147 L26,147 L16,138 Z" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Left thigh */}
      <ellipse cx="35" cy="172" rx="14" ry="27" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Right thigh */}
      <ellipse cx="65" cy="172" rx="14" ry="27" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Left lower leg */}
      <ellipse cx="34" cy="222" rx="10" ry="22" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Right lower leg */}
      <ellipse cx="66" cy="222" rx="10" ry="22" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      {/* Feet */}
      <ellipse cx="31" cy="254" rx="13" ry="6" fill={SKIN} stroke={STROKE} strokeWidth={SW} />
      <ellipse cx="69" cy="254" rx="13" ry="6" fill={SKIN} stroke={STROKE} strokeWidth={SW} />

      {/* ── Muscles ── */}
      {isFront ? (
        <>
          {/* Pectoraux */}
          <ellipse cx="37" cy="63" rx="11" ry="12" fill={c('pectoraux')} opacity="0.9" />
          <ellipse cx="63" cy="63" rx="11" ry="12" fill={c('pectoraux')} opacity="0.9" />
          {/* Deltoïdes avant */}
          <ellipse cx="16" cy="57" rx="8"  ry="9"  fill={c('deltoïdes')} opacity="0.9" />
          <ellipse cx="84" cy="57" rx="8"  ry="9"  fill={c('deltoïdes')} opacity="0.9" />
          {/* Biceps */}
          <ellipse cx="9"  cy="77" rx="5.5" ry="15" fill={c('biceps')} opacity="0.9" />
          <ellipse cx="91" cy="77" rx="5.5" ry="15" fill={c('biceps')} opacity="0.9" />
          {/* Abdominaux (6 blocs) */}
          {[78, 90, 102].map(y => (
            <>
              <ellipse key={`al${y}`} cx="43" cy={y} rx="6" ry="5" fill={c('abdominaux')} opacity="0.9" />
              <ellipse key={`ar${y}`} cx="57" cy={y} rx="6" ry="5" fill={c('abdominaux')} opacity="0.9" />
            </>
          ))}
          {/* Quadriceps */}
          <ellipse cx="35" cy="172" rx="11" ry="23" fill={c('quadriceps')} opacity="0.9" />
          <ellipse cx="65" cy="172" rx="11" ry="23" fill={c('quadriceps')} opacity="0.9" />
          {/* Mollets face avant */}
          <ellipse cx="33" cy="222" rx="7"  ry="15" fill={c('mollets')} opacity="0.9" />
          <ellipse cx="67" cy="222" rx="7"  ry="15" fill={c('mollets')} opacity="0.9" />
        </>
      ) : (
        <>
          {/* Trapèzes */}
          <path d="M44,36 L56,36 L73,46 L68,59 L50,53 L32,59 L27,46 Z" fill={c('trapèzes')} opacity="0.9" />
          {/* Grand dorsal */}
          <ellipse cx="24" cy="83" rx="11" ry="25" fill={c('grand dorsal')} opacity="0.9" />
          <ellipse cx="76" cy="83" rx="11" ry="25" fill={c('grand dorsal')} opacity="0.9" />
          {/* Triceps */}
          <ellipse cx="9"  cy="77" rx="5.5" ry="15" fill={c('triceps')} opacity="0.9" />
          <ellipse cx="91" cy="77" rx="5.5" ry="15" fill={c('triceps')} opacity="0.9" />
          {/* Lombaires */}
          <ellipse cx="50" cy="109" rx="18" ry="9" fill={c('lombaires')} opacity="0.9" />
          {/* Fessiers */}
          <ellipse cx="32" cy="130" rx="15" ry="16" fill={c('fessiers')} opacity="0.9" />
          <ellipse cx="68" cy="130" rx="15" ry="16" fill={c('fessiers')} opacity="0.9" />
          {/* Ischio-jambiers */}
          <ellipse cx="35" cy="174" rx="11" ry="23" fill={c('ischio-jambiers')} opacity="0.9" />
          <ellipse cx="65" cy="174" rx="11" ry="23" fill={c('ischio-jambiers')} opacity="0.9" />
          {/* Mollets */}
          <ellipse cx="33" cy="222" rx="8"  ry="17" fill={c('mollets')} opacity="0.9" />
          <ellipse cx="67" cy="222" rx="8"  ry="17" fill={c('mollets')} opacity="0.9" />
        </>
      )}

      {/* Label */}
      <text x="50" y="265" textAnchor="middle" fontSize="7" fill={STROKE} fontWeight="600" fontFamily="sans-serif">
        {isFront ? 'AVANT' : 'ARRIÈRE'}
      </text>
    </svg>
  )
}

export default function CelebrationModal({ tonnage, muscles, onClose }) {
  const hasBody = muscles.length > 0
  const [citation] = useState(() => randomCitation())

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg)', borderRadius: 20, padding: '24px 20px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '92svh', overflowY: 'auto' }}
      >
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Bravo !</div>
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 18 }}>Séance terminée 💪</div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: tonnage > 0 ? 18 : 8, textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8 }}>
            « {citation.texte} »
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>— {citation.auteur}</div>
        </div>

        {tonnage > 0 && (
          <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Tonnage de la séance
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)' }}>
              {tonnage.toLocaleString('fr-FR')} <span style={{ fontSize: 16 }}>kg</span>
            </div>
          </div>
        )}

        {hasBody && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Muscles travaillés
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
              <BodySVG active={muscles} view="front" />
              <BodySVG active={muscles} view="back" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
              {muscles.map(m => (
                <span key={m} style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {m}
                </span>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          Super ! 💪
        </button>
      </div>
    </div>
  )
}
