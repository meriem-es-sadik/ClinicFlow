import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Spinner({ label, fullPage = false }) {
  const { t } = useTranslation();

  return (
    <div className={fullPage ? 'spinner spinner--page' : 'spinner'}>
      <Loader2 className="spinner__icon" size={22} />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}
