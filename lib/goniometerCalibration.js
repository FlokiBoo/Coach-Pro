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
  // Coude collé au corps, l'avant-bras (donc le téléphone) balaie un plan horizontal en tournant
  // (comme une aiguille de boussole), pas une bascule avant/arrière ou gauche/droite — c'est un
  // changement de cap, donc l'axe "rotation" (alpha, boussole 0-360°), pas gamma. Gamma est
  // mathématiquement borné à ±90° : au-delà, ses lectures se replient sur elles-mêmes, ce qui
  // donnait des valeurs fausses (ex. 20° ou 60° au lieu de 100-110° réels) — retour terrain.
  'Épaule|Rotation externe': {
    axis: 'alpha',
    instructions: "Tiens le téléphone dans la main, dos de l'appareil contre la paume, écran vers l'extérieur — comme un prolongement de l'avant-bras. Coude collé au corps, plié à 90°.",
  },
  'Épaule|Rotation interne': {
    axis: 'alpha',
    instructions: "Tiens le téléphone dans la main, dos de l'appareil contre la paume, écran vers l'extérieur — comme un prolongement de l'avant-bras. Coude collé au corps, plié à 90°.",
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
