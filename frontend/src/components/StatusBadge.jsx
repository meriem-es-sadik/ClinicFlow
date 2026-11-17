import { useTranslation } from 'react-i18next';

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const key = String(status || '').toLowerCase();
  return (
    <span className={`badge badge--${key}`}>
      {t(`status.${key}`, { defaultValue: status })}
    </span>
  );
}
