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
