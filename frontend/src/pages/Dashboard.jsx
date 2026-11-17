import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  CalendarClock,
  Hourglass,
  CheckCircle2,
  CalendarDays,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { dashboardApi } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/format';
import { getApiErrorMessage } from '../i18n/errors';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, upcomingRes] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.upcoming(6),
      ]);
      setStats(statsRes.data);
      setUpcoming(upcomingRes.data);
    } catch (err) {
      setError(getApiErrorMessage(err, t, 'errors.loadDashboard'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = user?.fullName?.split(' ')[0] || t('dashboard.there');

  return (
    <div className="page">
      <div className="page__intro">
        <div>
          <h2>{t('dashboard.greeting', { name: firstName })}</h2>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {loading && !stats ? (
        <Spinner label={t('dashboard.loadingStats')} />
      ) : (
        <div className="stat-grid">
          <StatCard
            icon={Users}
            label={t('dashboard.totalPatients')}
            value={stats?.totalPatients ?? '—'}
            tone="teal"
            hint={t('dashboard.totalPatientsHint')}
          />
          <StatCard
            icon={CalendarClock}
            label={t('dashboard.todayAppointments')}
            value={stats?.todayAppointments ?? '—'}
            tone="blue"
            hint={t('dashboard.todayAppointmentsHint')}
          />
          <StatCard
            icon={Hourglass}
            label={t('dashboard.pending')}
            value={stats?.pendingAppointments ?? '—'}
            tone="amber"
            hint={t('dashboard.pendingHint')}
          />
          <StatCard
            icon={CheckCircle2}
            label={t('dashboard.confirmed')}
            value={stats?.confirmedAppointments ?? '—'}
            tone="green"
            hint={t('dashboard.confirmedHint')}
          />
        </div>
      )}

      <section className="panel">
        <header className="panel__header">
          <div>
            <h3>{t('dashboard.upcomingTitle')}</h3>
            <p>{t('dashboard.upcomingSubtitle')}</p>
          </div>
          <Link to="/appointments" className="btn btn--ghost btn--sm">
            {t('dashboard.viewAll')}
            <ArrowRight size={15} />
          </Link>
        </header>

        {loading && upcoming.length === 0 ? (
          <Spinner label={t('dashboard.loadingUpcoming')} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('dashboard.noUpcomingTitle')}
            description={t('dashboard.noUpcomingDescription')}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.patient')}</th>
                  <th>{t('common.reason')}</th>
                  <th>{t('fields.appointmentDate')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((appt) => (
                  <tr key={appt.id}>
                    <td>
                      <Link className="link" to={`/patients/${appt.patientId}`}>
                        {appt.patientName}
                      </Link>
                      <span className="cell-sub">{appt.patientCin}</span>
                    </td>
                    <td>{appt.reason}</td>
                    <td>{formatDateTime(appt.appointmentDate)}</td>
                    <td>
                      <StatusBadge status={appt.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
