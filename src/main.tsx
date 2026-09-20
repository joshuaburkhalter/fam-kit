import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Self-healing: Detect if stylesheets failed to load or if CSS rules were rejected due to MIME type mismatch/corrupt cache
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        let hasActiveStyles = false;
        for (let i = 0; i < document.styleSheets.length; i++) {
          try {
            const sheet = document.styleSheets[i];
            if (sheet.cssRules && sheet.cssRules.length > 0) {
              hasActiveStyles = true;
              break;
            }
          } catch {
            // Access to sheet.cssRules threw (can happen on MIME type mismatch or CORS)
          }
        }

        // If stylesheets failed to load rules and we haven't already retried in this session
        if (!hasActiveStyles && !sessionStorage.getItem('famkit_css_healed')) {
          console.warn('[Homebase] CSS stylesheets failed to load. Clearing corrupted cache and reloading...');
          sessionStorage.setItem('famkit_css_healed', '1');
          if (typeof caches !== 'undefined' && caches.keys) {
            caches.keys().then((keys) => {
              Promise.all(keys.map((k) => caches.delete(k))).finally(() => {
                window.location.reload();
              });
            });
          } else {
            window.location.reload();
          }
        } else if (hasActiveStyles) {
          sessionStorage.removeItem('famkit_css_healed');
        }
      } catch (err) {
        console.debug('Style check error:', err);
      }
    }, 400);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
