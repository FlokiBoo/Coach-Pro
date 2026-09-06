// Comment tenir le téléphone et quel axe du capteur lire, par test articulaire — sans ça, le
// goniomètre "capteur" suppose toujours la même prise (à plat sur le membre) alors que certains
// tests se mesurent avec le téléphone tenu autrement (ex: dans la main, comme une extension de
// l'avant-bras pour la rotation d'épaule). Clé = "<joint>|<nom de base du test>", sans le
// "(Actif)" qui ne change pas la prise en main.
//
// L'axe par défaut ci-dessous est une estimation : à confirmer/corriger en testant avec un vrai
// téléphone (le sélecteur Sagittal/Frontal/Rotation reste modifiable manuellement dans l'app pour
// chaque test, y compris ceux calibrés ici).
export const GONIOMETER_CALIBRATION = {
  // Position réelle confirmée par le sportif (photos à l'appui, la description précédente
  // "coude collé au corps" était fausse) : debout, bras à l'horizontale sur le côté (90°
  // d'abduction), coude plié à 90°, avant-bras vertical vers le haut au départ. Rotation externe
  // = l'avant-bras bascule vers l'arrière ; rotation interne = vers le sol/l'avant. C'est une
  // bascule dans un plan vertical (comme "Sagittal"), pas un changement de cap horizontal — donc
  // beta, pas alpha (qui donnait un sens/amplitude faux avec cette position). À reconfirmer en
  // testant en vrai : si beta ne suit pas bien, essayer Frontal.
  'Épaule|Rotation externe': {
    axis: 'beta',
    instructions: "Debout, bras à l'horizontale sur le côté, coude plié à 90°, avant-bras vertical vers le haut (poing en l'air) — c'est la position de départ. Tiens le téléphone dans le poing, dos contre la paume. Rotation externe : l'avant-bras bascule vers l'arrière.",
  },
  'Épaule|Rotation interne': {
    axis: 'beta',
    instructions: "Debout, bras à l'horizontale sur le côté, coude plié à 90°, avant-bras vertical vers le haut (poing en l'air) — c'est la position de départ. Tiens le téléphone dans le poing, dos contre la paume. Rotation interne : l'avant-bras bascule vers le sol, vers l'avant.",
  },
  // Même raisonnement que l'épaule : la jambe qui pivote balaie un plan horizontal (cap), pas une
  // bascule — alpha plutôt que gamma, pour la même raison de dépassement des ±90°.
  'Hanche|Rotation externe': {
    axis: 'alpha',
    instructions: "Glisse le téléphone dans ta chaussette, dos de l'appareil contre la peau côté interne de la jambe (entre tes jambes), écran vers l'extérieur. Téléphone à la verticale : le bas vers le pied, le haut vers le genou.",
  },
  'Hanche|Rotation interne': {
    axis: 'alpha',
    instructions: "Glisse le téléphone dans ta chaussette, dos de l'appareil contre la peau côté interne de la jambe (entre tes jambes), écran vers l'extérieur. Téléphone à la verticale : le bas vers le pied, le haut vers le genou.",
  },
  'Hanche|Flexion (genou tendu)': {
    axis: 'beta',
    instructions: "Même placement que pour la rotation : téléphone dans la chaussette, dos contre la peau. Genou tendu, la jambe qui monte fait basculer le téléphone jusqu'à le retourner tête en bas en fin d'amplitude — normal, l'angle reste correct.",
  },
}

export function getCalibration(joint, testName) {
  if (!joint || !testName) return null
  const base = testName.replace(/\s*\(Actif\)\s*$/, '')
  return GONIOMETER_CALIBRATION[`${joint}|${base}`] || null
}
