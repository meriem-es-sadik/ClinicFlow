import { Menu, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import LanguageSwitcher from './LanguageSwitcher';

export default function Topbar({ title, subtitle, onOpenMenu, actions }) {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="topbar__menu icon-btn"
          onClick={onOpenMenu}
          aria-label={t('topbar.openMenu')}
        >
          <Menu size={20} />
        </button>
        <div className="topbar__heading">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      <div className="topbar__right">
        {actions}
        <LanguageSwitcher />
        <span className="topbar__bell icon-btn" aria-hidden="true">
          <Bell size={18} />
        </span>
        <div className="topbar__user">
          <span className="avatar avatar--sm">{initials(user?.fullName)}</span>
          <span className="topbar__user-info">
            <strong>{user?.fullName}</strong>
            <small>{t(isAdmin ? 'roles.admin' : 'roles.staff')}</small>
          </span>
        </div>
      </div>
    </header>
  );
}
