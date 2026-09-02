// Demande la permission de notification et enregistre le token FCM de l'appareil auprès du
// serveur, pour que l'athlète reçoive une notification quand son coach lui répond (voir
// lib/push.js pour l'envoi côté serveur). No-op silencieux hors app native (web) ou si la
// permission est refusée. Retourne les listeners à nettoyer (cleanup d'un useEffect).
export async function registerPushNotifications(token) {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return []

  const { PushNotifications } = await import('@capacitor/push-notifications')

  let status = await PushNotifications.checkPermissions()
  if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
    status = await PushNotifications.requestPermissions()
  }
  if (status.receive !== 'granted') return []

  const listeners = [
    await PushNotifications.addListener('registration', ({ value }) => {
      fetch(`/api/athlete-view/${token}/push-token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToken: value, platform: Capacitor.getPlatform() }),
      }).catch(() => {})
    }),
    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err)
    }),
  ]

  await PushNotifications.register()
  return listeners
}
