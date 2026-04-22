import type { DoseItem } from './helpers'

export function scheduleNotifications(doses: DoseItem[]) {
  const now = new Date()
  for (const dose of doses) {
    if (dose.taken) continue
    const [h, m] = dose.time.split(':').map(Number)
    const doseTime = new Date()
    doseTime.setHours(h, m, 0, 0)
    const msUntil = doseTime.getTime() - now.getTime()
    if (msUntil < 0) continue

    setTimeout(() => {
      const title = `💊 Hora de tomar ${dose.name}`
      const body = `${dose.dose}${dose.instructions ? ' — ' + dose.instructions : ''}`
      const icon = '/icons/icon-192.png'
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: { body, icon, badge: icon, tag: dose.id },
        })
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon, tag: dose.id })
      }
    }, msUntil)
  }
}
