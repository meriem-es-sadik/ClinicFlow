import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
export const STORAGE_KEY = 'clinicflow.language';

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
];

function readSavedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {
    // localStorage can be unavailable in privacy-restricted browsers.
  }

  const browserLanguage = navigator.language?.split('-')[0];
  return SUPPORTED_LANGUAGES.includes(browserLanguage) ? browserLanguage : 'en';
}

function applyDocumentLanguage(language) {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
  document.documentElement.dataset.lang = language;
  document.body?.classList.toggle('rtl', dir === 'rtl');
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: readSavedLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  initImmediate: false,
});

i18n.on('languageChanged', (language) => {
  const normalized = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Persisting the choice is best-effort.
  }
  applyDocumentLanguage(normalized);
});

applyDocumentLanguage(i18n.language);

export default i18n;
