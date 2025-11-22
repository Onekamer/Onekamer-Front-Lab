import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// ============================================================
// ✅ Service Worker PWA (avec support supabase_light)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Service Worker classique pour PWA (sw.js)
    // Note: supabase_light utilise maintenant ce SW pour les notifications natives
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker PWA enregistré (avec supabase_light)'))
      .catch((err) => console.warn('⚠️ Erreur SW PWA :', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
