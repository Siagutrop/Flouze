import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

export async function initI18n() {
  await i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'fr',
      supportedLngs: ['fr', 'en'],
      load: 'languageOnly',
      backend: { loadPath: '/locales/{{lng}}/translation.json' },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'flouze-lang',
      },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    });
  return i18n;
}

export default i18n;
