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

    // Service Worker OneSignal pour Android
    navigator.serviceWorker
      .register('/OneSignalSDKWorker.js', { scope: '/' })
      .then(() => console.log('✅ OneSignal Service Worker Android enregistré'))
      .catch((err) => console.error('❌ Erreur SW OneSignal:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
