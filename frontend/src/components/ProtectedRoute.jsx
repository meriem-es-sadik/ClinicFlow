import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { t } = useTranslation();
  const { isAuthenticated, initializing, isAdmin } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <Spinner fullPage label={t('common.loading')} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
