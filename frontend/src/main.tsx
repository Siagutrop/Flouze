import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initI18n } from './i18n';
import { isPinEnabled, lock } from './pinlock';
import './index.css';

// Un code PIN configuré → l'app démarre verrouillée à chaque chargement
if (isPinEnabled()) lock();

initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Retire le splash avec un fondu une fois l'app rendue
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 450);
  }
});
