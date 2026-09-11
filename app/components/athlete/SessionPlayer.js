'use client'

import { useState, useEffect, useRef } from 'react'
import { CaretLeft, X, Play, Timer, Check } from '@phosphor-icons/react'

// Dupliqué depuis app/s/[token]/page.js (mêmes petites fonctions pures utilisées pour le même champ
// `rest`/vidéos YouTube) — composant volontairement autonome plutôt qu'un import cross-fichier
// vers un fichier de 2600+ lignes non pensé comme lib partagée (même convention que
// SessionBlockEditor.js/app/programs/.../page.js dans ce repo).
function parseRestSeconds(raw) {
  if (!raw) return null
  const s = raw.toString().trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
  const range = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(min|m|sec|s)?$/)
  if (range) {
    const avg = (parseFloat(range[1]) + parseFloat(range[2])) / 2
    const unit = range[3]
    return Math.round(unit === 'sec' || unit === 's' ? avg : avg * 60)
  }
  const minSec = s.match(/^(\d+(?:\.\d+)?)(?:min|m)(\d+)?$/)
  if (minSec) return Math.round(parseFloat(minSec[1]) * 60 + (minSec[2] ? parseInt(minSec[2]) : 0))
  const sec = s.match(/^(\d+(?:\.\d+)?)(?:sec|s)$/)
  if (sec) return Math.round(parseFloat(sec[1]))
  const colon = s.match(/^(\d+):(\d{1,2})$/)
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2])
  const bare = s.match(/^(\d+(?:\.\d+)?)$/)
  if (bare) return Math.round(parseFloat(bare[1]))
  return null
}

function extractYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function computeLabels(exercises) {
  const labels = {}
  let letterIdx = 0, i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) {
      labels[exercises[i].id] = String.fromCharCode(65 + letterIdx)
      letterIdx++; i++
    } else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const letter = String.fromCharCode(65 + letterIdx)
      for (let k = i; k < j; k++) labels[exercises[k].id] = `${letter}${k - i + 1}`
      letterIdx++; i = j
    }
  }
  return labels
}

// Regroupe la liste à plat des exercices en blocs (exercice seul, ou groupe superset entier) —
// même principe que le carrousel de blocs de l'éditeur coach (app/programs/[athleteId]/
// [programId]/page.js), réécrit ici sur la forme de données du côté athlète.
function computeBlocks(exos) {
  const blocks = []
  let i = 0
  while (i < exos.length) {
    const g = exos[i].superset_group
    if (!g) { blocks.push({ type: 'solo', exos: [exos[i]] }); i++; continue }
    let j = i
    while (j < exos.length && exos[j].superset_group === g) j++
    blocks.push({ type: 'superset', exos: exos.slice(i, j) })
    i = j
  }
  return blocks
}

// Bannière de repos discrète (par opposition à TimerModal, plein écran, utilisé ailleurs dans
// l'app et inchangé) — décompte local, appelle onDone automatiquement à 0 : c'est ce callback
// qui fait avancer le player sans action de l'utilisateur (retour auto sur A1 en super série).
function RestBanner({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })

  // seconds ne change jamais sur une instance donnée (RestBanner est toujours remonté à neuf pour
  // chaque repos, jamais réutilisé pour un décompte différent) — décompte lancé une seule fois au montage.
  useEffect(() => {
    if (!seconds || seconds <= 0) { onDoneRef.current?.(); return }
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(interval); onDoneRef.current?.(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      background: 'var(--vert-foret)', color: '#fff', borderRadius: 'var(--ostryk-card-radius)',
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14,
    }}>
      <Timer size={16} weight="light" />
      Repos : {remaining}s
    </div>
  )
}

function VideoThumbnail({ url }) {
  const [open, setOpen] = useState(false)
  const videoId = extractYouTubeId(url)
  const thumbSrc = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        position: 'relative', width: '100%', aspectRatio: '16/9', border: 'none', padding: 0, cursor: 'pointer',
        borderRadius: 'var(--ostryk-card-radius)', overflow: 'hidden', background: '#2D2620',
        backgroundImage: thumbSrc ? `url(${thumbSrc})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D2620',
        }}>
          <Play size={22} weight="fill" />
        </span>
      </button>
      {open && videoId && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#000', borderRadius: 'var(--ostryk-card-radius)', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}><X size={16} /></button>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              {/* Pas d'autoplay ici — contrairement à VideoButton (ouvert depuis l'écran de
                  préparation, inchangé), le player lance la vidéo seulement au tap. */}
              <iframe src={`https://www.youtube.com/embed/${videoId}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
      {open && !videoId && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--r)', padding: '12px 20px', fontWeight: 700 }}>Ouvrir la vidéo ↗</a>
        </div>
      )}
    </>
  )
}

function Stepper({ label, value, onChange, step = 1, suffix = '' }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onChange(Math.max(0, value - step))} style={{
          width: 34, height: 34, borderRadius: '50%', border: `1px solid var(--ostryk-border-input)`, background: 'var(--card-white)',
          fontSize: 18, fontWeight: 700, color: 'var(--vert-foret)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
        <div style={{ minWidth: 56, textAlign: 'center', fontFamily: 'var(--font-title)', fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
          {value}{suffix}
        </div>
        <button onClick={() => onChange(value + step)} style={{
          width: 34, height: 34, borderRadius: '50%', border: `1px solid var(--ostryk-border-input)`, background: 'var(--card-white)',
          fontSize: 18, fontWeight: 700, color: 'var(--vert-foret)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>
    </div>
  )
}

// Corps commun exercice simple / membre d'une super série : vidéo, consigne, historique de
// séries, steppers, CTA. Le parent (SingleExerciseScreen / SupersetScreen) possède la machine à
// états (quelle série est courante, ce qui se passe après validation) — ce composant ne fait que
// remonter (reps, kg) au tap sur le CTA. Remonté à neuf par le parent (key sur exo.id + série
// courante) à chaque nouvelle série/exercice — pas d'effet de reset ici, les valeurs initiales
// des steppers repartent de exo.reps/exo.kg à chaque montage.
function ExerciseLogBody({ exo, totalSets, currentSetIndex, validatedCount, ctaLabel, onValidate }) {
  const [reps, setReps] = useState(() => parseInt(exo.reps, 10) || 10)
  const [kg, setKg] = useState(() => parseFloat(exo.kg) || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--font-title)', color: 'var(--bordeaux)', fontWeight: 600, fontSize: 22, textAlign: 'center' }}>{exo.name}</div>

      {exo.video_url && <VideoThumbnail url={exo.video_url} />}

      {exo.note && (
        <div style={{ background: 'var(--card-white)', border: '1px solid var(--ostryk-border)', borderRadius: 'var(--ostryk-card-radius)', padding: '12px 14px', fontSize: 14, color: '#5A5348' }}>
          {exo.note}
        </div>
      )}

      {totalSets > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: totalSets }, (_, i) => {
            const state = i < validatedCount ? 'done' : i === currentSetIndex ? 'current' : 'upcoming'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 'var(--r)',
                background: state === 'current' ? '#FBF3E7' : 'var(--card-white)',
                border: `1px solid ${state === 'current' ? '#F0DFC0' : 'var(--ostryk-border)'}`,
                opacity: state === 'upcoming' ? 0.5 : 1,
              }}>
                {state === 'done' ? (
                  <span style={{ display: 'flex', color: 'var(--vert-foret)' }}><Check size={14} weight="bold" /></span>
                ) : (
                  <span style={{ width: 14, display: 'inline-block' }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: state === 'current' ? 'var(--bordeaux)' : 'var(--text)' }}>
                  Série {i + 1}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Stepper label="Reps" value={reps} onChange={setReps} />
        <Stepper label="Poids" value={kg} onChange={setKg} step={2.5} suffix=" kg" />
      </div>

      <button onClick={() => onValidate(reps, kg)} style={{
        background: 'var(--bordeaux)', color: '#fff', border: 'none', borderRadius: 'var(--ostryk-pill-radius)',
        padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
      }}>
        {ctaLabel}
      </button>
    </div>
  )
}

function PlayerHeader({ title, onBack, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--ostryk-border)' }}>
      <button onClick={onBack} disabled={!onBack} style={{ background: 'none', border: 'none', display: 'flex', color: onBack ? 'var(--vert-foret)' : 'var(--ostryk-chip-border)', cursor: onBack ? 'pointer' : 'default', padding: 4 }}>
        <CaretLeft size={20} weight="light" />
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', display: 'flex', color: 'var(--vert-foret)', cursor: 'pointer', padding: 4 }}>
        <X size={20} weight="light" />
      </button>
    </div>
  )
}

// Séance : exécution d'un exercice simple, une série à la fois. Chaque série validée écrit
// immédiatement via onSaveExerciseSet (même table/queue offline que l'écran de préparation) ;
// un repos discret (RestBanner) s'affiche après chaque série tant que exo.rest est renseigné.
function SingleExerciseScreen({ exo, exerciseSets, onEnsureExerciseSets, onSaveExerciseSet, blockLabel, onPrev, onNext, onExit }) {
  const totalSets = Math.max(1, parseInt(exo.sets, 10) || 1)
  const [validatedCount, setValidatedCount] = useState(0)
  const [resting, setResting] = useState(false)
  // Remonté à neuf par le parent (key=exo.id) à chaque nouveau bloc solo — validatedCount/resting
  // repartent donc déjà à 0/false sans effet de reset ; le ref ne sert qu'à éviter un double-appel
  // de provisionnement (React 18 strict mode invoque les effets deux fois en dev).
  const provisioned = useRef(false)

  useEffect(() => {
    if (provisioned.current) return
    provisioned.current = true
    if ((exerciseSets[exo.id] || []).length < totalSets) onEnsureExerciseSets(exo.id, totalSets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sets = exerciseSets[exo.id] || []

  const advance = () => {
    setResting(false)
    if (validatedCount + 1 >= totalSets) onNext()
  }

  const handleValidate = (reps, kg) => {
    const set = sets[validatedCount]
    if (set) {
      onSaveExerciseSet(exo.id, set.id, 'reps_done', String(reps))
      onSaveExerciseSet(exo.id, set.id, 'kg_done', String(kg))
    }
    setValidatedCount(c => c + 1)
    const restSeconds = parseRestSeconds(exo.rest)
    if (restSeconds) setResting(true)
    else advance()
  }

  return (
    <>
      <PlayerHeader title={blockLabel} onBack={onPrev} onClose={onExit} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {resting ? (
          <RestBanner seconds={parseRestSeconds(exo.rest)} onDone={advance} />
        ) : (
          <ExerciseLogBody
            key={`${exo.id}:${validatedCount}`}
            exo={exo} totalSets={totalSets} currentSetIndex={validatedCount} validatedCount={validatedCount}
            ctaLabel="Valider la série" onValidate={handleValidate}
          />
        )}
      </div>
    </>
  )
}

// Super série : cycle A1 → A2 → … → repos → retour automatique sur A1, tour suivant. Aucune
// action requise pour repartir sur le tour suivant (RestBanner.onDone gère l'avance).
function SupersetScreen({ group, labels, exerciseSets, onEnsureExerciseSets, onSaveExerciseSet, blockLabel, onPrev, onNext, onExit }) {
  const totalRounds = Math.max(1, parseInt(group[0]?.sets, 10) || 1)
  const [round, setRound] = useState(1)
  const [exoIdx, setExoIdx] = useState(0)
  const [resting, setResting] = useState(false)
  const provisioned = useRef(new Set())

  useEffect(() => {
    group.forEach(exo => {
      if (provisioned.current.has(exo.id)) return
      provisioned.current.add(exo.id)
      if ((exerciseSets[exo.id] || []).length < totalRounds) onEnsureExerciseSets(exo.id, totalRounds)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.map(e => e.id).join(',')])

  const exo = group[exoIdx]
  const isLastOfGroup = exoIdx === group.length - 1

  const advanceRound = () => {
    setResting(false)
    const nextRound = round + 1
    if (nextRound > totalRounds) { onNext(); return }
    setRound(nextRound)
    setExoIdx(0)
  }

  const handleValidate = (reps, kg) => {
    const sets = exerciseSets[exo.id] || []
    const set = sets[round - 1]
    if (set) {
      onSaveExerciseSet(exo.id, set.id, 'reps_done', String(reps))
      onSaveExerciseSet(exo.id, set.id, 'kg_done', String(kg))
    }
    if (!isLastOfGroup) { setExoIdx(i => i + 1); return }
    const restSeconds = Math.max(...group.map(e => parseRestSeconds(e.rest) || 0))
    if (restSeconds) setResting(true)
    else advanceRound()
  }

  if (!exo) return null

  return (
    <>
      <PlayerHeader title={`${blockLabel} · Tour ${round}/${totalRounds}`} onBack={onPrev} onClose={onExit} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 4, borderRadius: 2, background: 'var(--bordeaux)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.map((e, i) => {
              const done = i < exoIdx
              const current = i === exoIdx
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, background: done ? 'var(--bordeaux)' : current ? 'var(--card-white)' : 'var(--beige)',
                    color: done ? '#fff' : current ? 'var(--bordeaux)' : 'var(--ostryk-text3)',
                    border: current ? '1.5px solid var(--bordeaux)' : 'none',
                  }}>
                    {labels[e.id] || i + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: current ? 700 : 600, color: current ? 'var(--text)' : 'var(--ostryk-text2)' }}>{e.name}</span>
                  {done && <span style={{ display: 'flex', color: 'var(--vert-foret)' }}><Check size={13} weight="bold" /></span>}
                </div>
              )
            })}
          </div>
        </div>

        {!isLastOfGroup && !resting && (
          <div style={{ fontSize: 12, color: 'var(--ostryk-text2)', fontStyle: 'italic', textAlign: 'center' }}>
            Pas de repos entre {labels[group[exoIdx].id]} et {labels[group[exoIdx + 1].id]} — enchaîne directement.
          </div>
        )}

        {resting ? (
          <RestBanner seconds={Math.max(...group.map(e => parseRestSeconds(e.rest) || 0))} onDone={advanceRound} />
        ) : (
          <ExerciseLogBody
            key={`${exo.id}:${round}`}
            exo={exo} totalSets={1} currentSetIndex={0} validatedCount={0}
            ctaLabel={isLastOfGroup ? 'Valider — fin du tour, repos' : 'Valider'}
            onValidate={handleValidate}
          />
        )}
      </div>
    </>
  )
}

// Player d'exécution de séance — remplace la liste à plat pour le logging des exercices/super
// séries. Reçoit les mêmes fonctions d'écriture (avec queue offline) que l'écran de préparation
// (SessionCard) : aucune nouvelle logique de sauvegarde, seulement un nouvel enchaînement d'écrans.
export default function SessionPlayer({ session, exerciseSets, onEnsureExerciseSets, onSaveExerciseSet, onExit }) {
  const exos = (session.exercises || []).filter(e => e.name)
  const labels = computeLabels(exos)
  const blocks = computeBlocks(exos)
  const [blockIndex, setBlockIndex] = useState(0)

  if (blocks.length === 0) {
    return (
      <>
        <PlayerHeader title="Séance" onBack={null} onClose={onExit} />
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--ostryk-text3)' }}>Aucun exercice dans cette séance.</div>
      </>
    )
  }

  const block = blocks[Math.min(blockIndex, blocks.length - 1)]
  const goPrev = blockIndex > 0 ? () => setBlockIndex(i => i - 1) : null
  const goNext = () => {
    if (blockIndex + 1 >= blocks.length) onExit()
    else setBlockIndex(i => i + 1)
  }

  if (block.type === 'solo') {
    return (
      <SingleExerciseScreen
        key={block.exos[0].id}
        exo={block.exos[0]}
        exerciseSets={exerciseSets} onEnsureExerciseSets={onEnsureExerciseSets} onSaveExerciseSet={onSaveExerciseSet}
        blockLabel={`Exercice ${blockIndex + 1}/${blocks.length}`}
        onPrev={goPrev} onNext={goNext} onExit={onExit}
      />
    )
  }

  return (
    <SupersetScreen
      key={block.exos.map(e => e.id).join(',')}
      group={block.exos} labels={labels}
      exerciseSets={exerciseSets} onEnsureExerciseSets={onEnsureExerciseSets} onSaveExerciseSet={onSaveExerciseSet}
      blockLabel="Super série"
      onPrev={goPrev} onNext={goNext} onExit={onExit}
    />
  )
}
