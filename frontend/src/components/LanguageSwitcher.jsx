import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from '../i18n';

export default function LanguageSwitcher({ id = 'language-switcher' }) {
  const { t, i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  return (
    <label className="language-switcher" htmlFor={id}>
      <Globe2 size={16} aria-hidden="true" />
      <span className="sr-only">{t('topbar.language')}</span>
      <select
        id={id}
        value={current}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        aria-label={t('topbar.language')}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
