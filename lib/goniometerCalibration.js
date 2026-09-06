// Comment tenir le téléphone et quel axe du capteur lire, par test articulaire — sans ça, le
// goniomètre "capteur" suppose toujours la même prise (à plat sur le membre) alors que certains
// tests se mesurent avec le téléphone tenu autrement (ex: dans la main, comme une extension de
// l'avant-bras pour la rotation d'épaule). Clé = "<joint>|<nom de base du test>", sans le
// "(Passif)"/"(Actif)" qui ne change pas la prise en main.
//
// L'axe par défaut ci-dessous est une estimation : à confirmer/corriger en testant avec un vrai
// téléphone (le sélecteur Sagittal/Frontal/Rotation reste modifiable manuellement dans l'app pour
// chaque test, y compris ceux calibrés ici).
export const GONIOMETER_CALIBRATION = {
  'Épaule|Rotation externe': {
    axis: 'gamma',
    instructions: "Tiens le téléphone dans la main, dos de l'appareil contre la paume, écran vers l'extérieur — comme un prolongement de l'avant-bras. Coude collé au corps, plié à 90°.",
  },
  'Épaule|Rotation interne': {
    axis: 'gamma',
    instructions: "Tiens le téléphone dans la main, dos de l'appareil contre la paume, écran vers l'extérieur — comme un prolongement de l'avant-bras. Coude collé au corps, plié à 90°.",
  },
}

export function getCalibration(joint, testName) {
  if (!joint || !testName) return null
  const base = testName.replace(/\s*\((Passif|Actif)\)\s*$/, '')
  return GONIOMETER_CALIBRATION[`${joint}|${base}`] || null
}
