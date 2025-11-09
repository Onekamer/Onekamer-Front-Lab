const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal'
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeForPush(userId) {
  try {
    if (PROVIDER !== 'supabase_light') return { skipped: true }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { unsupported: true }
    if (!API_BASE_URL) return { error: 'api_url_missing' }
    if (!VAPID_PUBLIC_KEY) return { error: 'vapid_missing' }

    const reg = await navigator.serviceWorker.ready
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { error: 'permission_denied' }

    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      try {
        const res = await fetch(`${API_BASE_URL}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            endpoint: existing.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(existing.getKey('p256dh')))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(existing.getKey('auth')))),
            },
          }),
        })
        return { ok: res.ok, reused: true }
      } catch (_) {
        return { error: 'subscribe_post_failed' }
      }
    }

    const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey })

    const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))))
    const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))

    const res = await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, endpoint: subscription.endpoint, keys: { p256dh, auth } }),
    })

    return { ok: res.ok, created: true }
  } catch (e) {
    return { error: e?.message || 'subscribe_failed' }
  }
}
