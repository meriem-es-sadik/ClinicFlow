import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PAGE_META = {
  '/dashboard': 'dashboard',
  '/patients': 'patients',
  '/appointments': 'appointments',
};

function metaFor(pathname) {
  if (pathname.startsWith('/patients/')) return 'patientDetails';
  return PAGE_META[pathname] || null;
}

export default function Layout() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const pageKey = metaFor(location.pathname);
  const title = pageKey ? t(`page.${pageKey}.title`) : t('page.fallback.title');
  const subtitle = pageKey ? t(`page.${pageKey}.subtitle`) : t('page.fallback.subtitle');

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-main">
        <Topbar
          title={title}
          subtitle={subtitle}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
