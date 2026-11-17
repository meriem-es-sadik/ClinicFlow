import { Link } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="notfound">
      <span className="notfound__logo">
        <HeartPulse size={28} />
      </span>
      <h1>404</h1>
      <p>{t('notFound.message')}</p>
      <Link to="/dashboard" className="btn btn--primary">
        {t('notFound.back')}
      </Link>
    </div>
  );
}
