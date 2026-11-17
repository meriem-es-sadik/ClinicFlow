import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, HeartPulse, LogOut, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

const NAV_ITEMS = [
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/patients', key: 'nav.patients', icon: Users },
  { to: '/appointments', key: 'nav.appointments', icon: CalendarDays },
];

export default function Sidebar({ open, onClose }) {
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();

  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <HeartPulse size={22} />
          </span>
          <span className="sidebar__brand-text">
            <strong>{t('app.name')}</strong>
            <small>{t('app.clinicManagement')}</small>
          </span>
          <button
            type="button"
            className="sidebar__close icon-btn icon-btn--light"
            onClick={onClose}
            aria-label={t('topbar.closeMenu')}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label={t('nav.main')}>
          {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="avatar avatar--sm">{initials(user?.fullName)}</span>
            <span className="sidebar__user-info">
              <strong>{user?.fullName}</strong>
              <small>{t(isAdmin ? 'roles.admin' : 'roles.staff')}</small>
            </span>
          </div>
          <button type="button" className="sidebar__logout" onClick={logout}>
            <LogOut size={16} />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>
      {open ? (
        <div className="sidebar-backdrop" onClick={onClose} role="presentation" />
      ) : null}
    </>
  );
}
