// Tests de dominance Torque (TI/TE) — critères décisifs (comptés dans le verdict)
// et critères informatifs (affichés mais pas comptés), d'après l'analyse fournie par le coach.

export const TORQUE_TESTS = [
  {
    key: 'goblet_squat',
    label: 'Goblet Squat',
    protocol: [
      { k: 'Charge', v: '20-30% PDC / KB ou haltère' },
      { k: 'Reps', v: '5 reps lentes, pas de coaching' },
      { k: 'Position', v: 'Pieds largeur d’épaules, position naturelle' },
      { k: 'Consigne', v: '« Descends confortablement aussi bas que tu peux »' },
    ],
    questions: [
      'Tu as senti quoi dans les hanches ? Blocage ou liberté ?',
      'Tes genoux ont voulu partir dans quel sens naturellement ?',
      'C’était plus confortable pieds parallèles ou ouverts ?',
    ],
    criteria: [
      {
        key: 'genou', label: 'Genou', decisive: true,
        options: [
          { key: 'valgus', label: 'Rentre (valgus)', torque: 'TI' },
          { key: 'varus', label: 'Sort (varus)', torque: 'TE' },
          { key: 'neutre', label: 'Neutre', torque: null },
        ],
      },
      {
        key: 'pied', label: 'Pied', decisive: true,
        options: [
          { key: 'pronation', label: 'Pronation (arche s’effondre)', torque: 'TI' },
          { key: 'supination', label: 'Supination (arche marquée)', torque: 'TE' },
        ],
      },
      {
        key: 'tronc', label: 'Tronc', decisive: true,
        options: [
          { key: 'avant', label: 'S’effondre vers l’avant', torque: 'TI' },
          { key: 'vertical', label: 'Vertical maintenu', torque: 'TE' },
        ],
      },
      {
        key: 'respiration', label: 'Respiration', decisive: false,
        options: [
          { key: 'nasale', label: 'Nasale maintenue', torque: 'TI' },
          { key: 'buccale', label: 'Buccale dès le 1er effort', torque: 'TE' },
        ],
      },
      {
        key: 'profondeur', label: 'Profondeur', decisive: false,
        options: [
          { key: 'profonde', label: 'Descente profonde spontanée', torque: null, note: 'Mobilité hanche OK' },
          { key: 'bloque90', label: 'Blocage à 90°', torque: null, note: 'Restriction hanche RI' },
        ],
      },
    ],
  },
  {
    key: 'db_rdl',
    label: '2 DB RDL',
    protocol: [
      { k: 'Charge', v: '30-40% PDC / 2 haltères' },
      { k: 'Reps', v: '5 reps lentes, pas de coaching' },
      { k: 'Position', v: 'Pieds parallèles largeur hanches' },
      { k: 'Consigne', v: '« Penche-toi en avant en gardant les jambes quasi tendues »' },
    ],
    questions: [
      'Tu as senti l’étirement derrière les cuisses ou dans le bas du dos ?',
      'Tes hanches ont voulu tourner d’un côté ?',
      'Tu as pu descendre jusqu’où confortablement ?',
    ],
    criteria: [
      {
        key: 'hanche', label: 'Hanche', decisive: true,
        options: [
          { key: 're', label: 'S’ouvre en rotation externe (D ou G)', torque: 'TE' },
          { key: 'neutre_ri', label: 'Neutre ou légère RI', torque: 'TI' },
        ],
      },
      {
        key: 'dos', label: 'Dos', decisive: true,
        options: [
          { key: 'cambre', label: 'Érecteurs compensent, cambre lombaire', torque: 'TI' },
          { key: 'plat', label: 'Dos plat maintenu', torque: 'TE' },
        ],
      },
      {
        key: 'amplitude', label: 'Amplitude de descente', decisive: true,
        options: [
          { key: 'sol', label: 'Profonde / sol atteint (IJ longs)', torque: 'TI' },
          { key: 'reduite', label: 'Réduite / < mi-tibia (IJ courts)', torque: 'TE' },
        ],
      },
      {
        key: 'genou', label: 'Genou porteur', decisive: false,
        options: [
          { key: 'flechit', label: 'Fléchit spontanément (compensation quad)', torque: 'TI' },
          { key: 'tendu', label: 'Tendu maintenu', torque: 'TE' },
        ],
      },
      {
        key: 'bras', label: 'Haltères', decisive: false,
        options: [
          { key: 'exterieur', label: 'Partent vers l’extérieur', torque: 'TE' },
          { key: 'proche', label: 'Restent proches du corps', torque: 'TI' },
        ],
      },
      {
        key: 'asymetrie', label: 'Asymétrie D/G', decisive: false, flagOnly: true,
        options: [
          { key: 'non', label: 'Non', torque: null },
          { key: 'oui', label: 'Oui — à investiguer', torque: null, warn: true },
        ],
      },
    ],
  },
  {
    key: 'sandbag_carry',
    label: 'Sandbag Bear Hug Carry',
    protocol: [
      { k: 'Charge', v: '40-50% PDC si possible / sinon 20-30%' },
      { k: 'Distance', v: '2 × 30m avec 30s de repos entre les deux passages' },
      { k: 'Consigne', v: 'Aucune — zéro coaching pendant l’effort' },
    ],
    questions: [
      'Tu as senti quoi dans les cuisses face interne ?',
      'Tu respirais par le nez ou la bouche ?',
      'Où tu as senti l’effort en premier — lombaires, ventre ou cuisses ?',
    ],
    criteria: [
      {
        key: 'ij_medial', label: 'IJ médial (lap 1)', decisive: true,
        options: [
          { key: 'tension', label: 'Tension visible face interne cuisse', torque: 'TI' },
          { key: 'absent', label: 'Absent', torque: 'TE' },
        ],
      },
      {
        key: 'obliques', label: 'Obliques externes (lap 1)', decisive: true,
        options: [
          { key: 'contraction', label: 'Contraction visible aux flancs', torque: 'TI' },
          { key: 'lombaires', label: 'Lombaires compensent à la place', torque: 'TE' },
        ],
      },
      {
        key: 'respiration_lap1', label: 'Respiration (lap 1)', decisive: true,
        options: [
          { key: 'nasale', label: 'Nasale maintenue', torque: 'TI' },
          { key: 'buccale', label: 'Buccale dès le départ', torque: 'TE' },
        ],
      },
      {
        key: 'arche', label: 'Arche du pied (lap 1)', decisive: false,
        options: [
          { key: 'maintenue', label: 'Présente et maintenue', torque: 'TI' },
          { key: 'effondrement', label: 'Pronation / effondrement', torque: null, note: 'TI non établi' },
        ],
      },
      {
        key: 'posture', label: 'Posture (lap 1)', decisive: false,
        options: [
          { key: 'haute', label: 'Sandbag haut sur sternum, menton rentré', torque: 'TI' },
          { key: 'basse', label: 'Sandbag descend, menton sorti', torque: null, note: 'TE ou fatigue' },
        ],
      },
      {
        key: 'respiration_post', label: 'Respiration (10s post lap 2)', decisive: false,
        options: [
          { key: 'rapide', label: 'Retour nasale rapide (< 10s)', torque: 'TI', note: 'Très bien établi' },
          { key: 'prolongee', label: 'Buccale prolongée (> 30s)', torque: 'TE', note: 'Récupération lente' },
          { key: 'panique', label: 'Mains sur genoux / panique respiratoire', torque: null, note: 'SNC en TE total', warn: true },
        ],
      },
    ],
  },
]

export function computeVerdict(testConfig, answers) {
  let ti = 0, te = 0
  testConfig.criteria.forEach(c => {
    if (!c.decisive) return
    const chosenKey = answers[c.key]
    if (!chosenKey) return
    const opt = c.options.find(o => o.key === chosenKey)
    if (opt?.torque === 'TI') ti++
    else if (opt?.torque === 'TE') te++
  })
  if (ti === 0 && te === 0) return null
  if (ti > te) return 'TI'
  if (te > ti) return 'TE'
  return 'Mix'
}

export function verdictLabel(v) {
  if (v === 'TI') return 'TI Dominant'
  if (v === 'TE') return 'TE Dominant'
  if (v === 'Mix') return 'Mix'
  return '—'
}

export function verdictColor(v) {
  if (v === 'TI') return { color: '#1D4ED8', bg: '#DBEAFE' }
  if (v === 'TE') return { color: '#C2410C', bg: '#FFF7ED' }
  if (v === 'Mix') return { color: '#6B21A8', bg: '#F3E8FF' }
  return { color: 'var(--text3)', bg: 'var(--bg2)' }
}

export function computeQuestionnaireVerdict(answers, allQuestions) {
  const answered = allQuestions.filter(q => answers[q.key])
  if (answered.length === 0) return null
  const countA = answered.filter(q => answers[q.key] === 'A').length
  const countB = answered.length - countA
  if (countA >= 14) return 'TI_pur'
  if (countA >= 10) return 'TI_probable'
  if (countA === 9 && countB === 9) return 'Mix'
  if (countB >= 14) return 'TE_pur'
  if (countB >= 10) return 'TE_probable'
  return 'Mix'
}

export function questionnaireLabel(v) {
  if (v === 'TI_pur') return 'TI Dominant pur'
  if (v === 'TI_probable') return 'TI probable'
  if (v === 'TE_probable') return 'TE probable'
  if (v === 'TE_pur') return 'TE Dominant pur'
  if (v === 'Mix') return 'Mix'
  return '—'
}

export function questionnaireLean(v) {
  if (v === 'TI_pur' || v === 'TI_probable') return 'TI'
  if (v === 'TE_pur' || v === 'TE_probable') return 'TE'
  if (v === 'Mix') return 'Mix'
  return null
}

export function computeSynthesis(verdicts) {
  if (verdicts.length === 0) return null
  const counts = {}
  verdicts.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  const [topVerdict, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (verdicts.length < 3) {
    return { label: `${topCount}/${verdicts.length} test(s) fait(s) — ${verdictLabel(topVerdict)} pour l'instant`, verdict: topVerdict, partial: true }
  }
  if (topCount === 3) return { label: `Profil clair — ${verdictLabel(topVerdict)}`, verdict: topVerdict }
  if (topCount === 2) return { label: `Profil probable — ${verdictLabel(topVerdict)}`, verdict: topVerdict }
  return { label: 'Mix ou compensation — à approfondir', verdict: 'Mix' }
}

export function computeDiscordance(questionnaireLeanVal, synthesis) {
  if (!questionnaireLeanVal || !synthesis || synthesis.partial) return null
  const physique = synthesis.verdict
  if (questionnaireLeanVal === 'TI' && physique === 'TE') {
    return "Questionnaire TI + Tests physiques TE → TE chronique installé : TI de base mais système nerveux en TE permanent (stress, surcharge). Priorité : récupération SNC avant programmation."
  }
  if (questionnaireLeanVal === 'TE' && physique === 'TI') {
    return "Questionnaire TE + Tests physiques TI → rare : souvent un profil TE qui a développé le TI par l'entraînement (acquis, pas inné). Programmer avec un ratio TI/TE équilibré, pas TI pur."
  }
  return null
}

// Questionnaire psychologique — 18 questions binaires A/B réparties en 5 blocs.
export const PSYCH_QUESTIONNAIRE = [
  {
    label: 'Bloc 1 — Effort & énergie',
    questions: [
      { key: 'q1', text: 'Quel type d’effort tu préfères naturellement ?', a: 'Long, régulier, je monte en puissance progressivement', b: 'Court, intense, je préfère tout donner sur une courte durée' },
      { key: 'q2', text: 'Quand tu t’entraînes seul sans programme, tu fais quoi spontanément ?', a: 'Du cardio, des circuits, des séances longues', b: 'Du lourd, des séries courtes, des efforts explosifs' },
      { key: 'q3', text: 'Comment tu te sens en début de séance ?', a: 'Je mets du temps à m’échauffer, meilleur en fin de séance', b: 'Je suis au max dès le départ, je préfère commencer fort' },
      { key: 'q4', text: 'Après une séance très intense, tu te sens comment ?', a: 'Vidé, besoin de calme et de temps pour récupérer', b: 'Libéré, je pourrais presque repartir après une heure' },
    ],
  },
  {
    label: 'Bloc 2 — Compétition & pression',
    questions: [
      { key: 'q5', text: 'En compétition ou sous pression, tu deviens comment ?', a: 'Calme, posé, je me concentre et je contrôle', b: 'Électrique, agressif, l’adrénaline me donne de l’énergie' },
      { key: 'q6', text: 'Quand quelqu’un te défie ou te provoque, ta réaction naturelle ?', a: 'Tu intègres, tu réfléchis, tu réponds avec méthode', b: 'Tu veux prouver immédiatement, tu passes à l’action' },
      { key: 'q7', text: 'Face à un effort difficile, tu gères comment ?', a: 'Tu respires, tu rentres à l’intérieur, tu trouves ton rythme', b: 'Tu serres les dents, tu pousses, tu te bats contre la douleur' },
      { key: 'q8', text: 'Quand tu rates ou tu échoues, tu réagis comment ?', a: 'Tu analyses, tu comprends, tu ajustes tranquillement', b: 'Tu veux recommencer immédiatement pour corriger' },
    ],
  },
  {
    label: 'Bloc 3 — Récupération & sommeil',
    questions: [
      { key: 'q9', text: 'Après une grosse semaine d’entraînement, tu récupères comment ?', a: 'Lentement — besoin de 48-72h avant de te sentir bien', b: 'Rapidement — 24h suffisent généralement' },
      { key: 'q10', text: 'La nuit avant une compétition ou un gros effort, tu dors comment ?', a: 'Bien, peut-être un peu lent à t’endormir mais tu dors', b: 'Mal, tu es excité, agité, difficile de calmer le système' },
      { key: 'q11', text: 'Après un effort intense, tu ressens quoi dans les premières minutes ?', a: 'Envie de t’asseoir, de respirer, de te poser', b: 'Bouffée d’énergie, tu parles, tu bouges encore' },
    ],
  },
  {
    label: 'Bloc 4 — Respiration & corps',
    questions: [
      { key: 'q12', text: 'Dans ta vie quotidienne, tu respires plutôt comment ?', a: 'Par le nez, lentement, sans y penser', b: 'Par la bouche souvent, surtout au travail ou sous stress' },
      { key: 'q13', text: 'Sous effort modéré (marche rapide, escaliers), tu passes à la bouche quand ?', a: 'Tard, tu peux maintenir le nez longtemps', b: 'Vite, la bouche vient naturellement dès que ça monte' },
      { key: 'q14', text: 'Quand tu portes une charge lourde (courses, déménagement), tu fais quoi ?', a: 'Tu bloques la respiration, rentres le ventre, tu serres', b: 'Tu souffles fort par la bouche, tu pousses' },
    ],
  },
  {
    label: 'Bloc 5 — Psychologie & mode de vie',
    questions: [
      { key: 'q15', text: 'Dans ta vie quotidienne, tu es plutôt ?', a: 'Méthodique, organisé, tu finis ce que tu commences', b: 'Dynamique, réactif, tu passes vite d’une chose à l’autre' },
      { key: 'q16', text: 'Face au stress du quotidien, tu réagis comment ?', a: 'Tu absorbes, tu intériorises, parfois tu rumines', b: 'Tu extériorises, tu agis, tu règles le problème immédiatement' },
      { key: 'q17', text: 'Quand tu es fatigué, tu as envie de ?', a: 'Rien faire, silence, récupération totale', b: 'Sortir, voir des gens, faire quelque chose' },
      { key: 'q18', text: 'Ton rapport à la douleur musculaire ?', a: 'Tu la ressens profondément, elle dure longtemps', b: 'Elle est intense sur le moment mais disparaît vite' },
    ],
  },
]
