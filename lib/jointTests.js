function withPassifActif(names) {
  return names.flatMap(n => [`${n} (Passif)`, `${n} (Actif)`])
}

export const JOINT_TESTS = [
  {
    joint: 'Épaule',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion', 'Extension', 'Abduction', 'Adduction']),
  },
  {
    joint: 'Hanche',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion (genou fléchi)', 'Flexion (genou tendu)', 'Extension']),
  },
  {
    joint: 'Colonne',
    tests: ['Cat-Cow', 'Jefferson Curl', ...withPassifActif(['Flexion', 'Inclinaison latérale', 'Rotation'])],
  },
]
