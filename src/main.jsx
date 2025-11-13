import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// ============================================================
// ✅ Service Worker global (PWA) + OneSignal Android fix
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Service Worker classique pour PWA (sw.js)
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker PWA enregistré'))
      .catch((err) => console.warn('⚠️ Erreur SW PWA :', err));

    // Enregistrement conditionnel selon le provider de notifications
    const provider = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';

    if (provider === 'onesignal') {
      // Service Worker OneSignal pour Android
      navigator.serviceWorker
        .register('/OneSignalSDKWorker.js', { scope: '/' })
        .then(() => console.log('✅ OneSignal Service Worker Android enregistré'))
        .catch((err) => console.error('❌ Erreur SW OneSignal:', err));
    } else if (provider === 'supabase_light') {
      // Service Worker Web Push maison
      navigator.serviceWorker
        .register('/ok-push-sw.js', { scope: '/' })
        .then(() => console.log('✅ OK Push Service Worker enregistré'))
        .catch((err) => console.error('❌ Erreur SW OK Push:', err));
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
