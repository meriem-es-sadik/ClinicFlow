import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  CalendarDays,
  CalendarRange,
  Clock3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Hourglass,
  X,
} from 'lucide-react';
import Modal from '../components/Modal';
import AppointmentForm from '../components/AppointmentForm';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { appointmentsApi } from '../api/appointments';
import { patientsApi } from '../api/patients';
import { useToast } from '../context/ToastContext';
import { formatDate, formatTime, initials } from '../utils/format';
import { getApiErrorMessage } from '../i18n/errors';

const PAGE_SIZE = 10;

const STATUS_META = [
  {
    value: '',
    labelKey: 'appointments.stats.all',
    hintKey: 'appointments.stats.allHint',
    countKey: 'total',
    icon: CalendarRange,
    tone: 'teal',
  },
  {
    value: 'pending',
    labelKey: 'appointments.stats.pending',
    hintKey: 'appointments.stats.pendingHint',
    countKey: 'pending',
    icon: Hourglass,
    tone: 'amber',
  },
  {
    value: 'confirmed',
    labelKey: 'appointments.stats.confirmed',
    hintKey: 'appointments.stats.confirmedHint',
    countKey: 'confirmed',
    icon: CheckCircle2,
    tone: 'green',
  },
  {
    value: 'cancelled',
    labelKey: 'appointments.stats.cancelled',
    hintKey: 'appointments.stats.cancelledHint',
    countKey: 'cancelled',
    icon: XCircle,
    tone: 'red',
  },
];

const STATUS_TOASTS = {
  pending: 'appointments.toastPending',
  confirmed: 'appointments.toastConfirmed',
  cancelled: 'appointments.toastCancelled',
};

export default function Appointments() {
  const { t } = useTranslation();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ date: '', status: '' });
  const [page, setPage] = useState(1);

  const [appointments, setAppointments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [patientOptions, setPatientOptions] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appointmentsApi.list({
        date: filters.date || undefined,
        status: filters.status || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setAppointments(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(getApiErrorMessage(err, t, 'errors.loadAppointments'));
    } finally {
      setLoading(false);
    }
  }, [filters.date, filters.status, debouncedSearch, page, t]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await appointmentsApi.counts();
      setCounts(res.data);
    } catch {
      // Keep the previous counts; the list remains usable without them.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    patientsApi
      .list({ limit: 100 })
      .then((res) => setPatientOptions(res.data))
      .catch(() => setPatientOptions([]));
  }, []);

  function updateFilter(field, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearSearch() {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setFilters({ date: '', status: '' });
    setPage(1);
  }

  async function handleCreate(payload) {
    await appointmentsApi.create(payload);
    toast.success(t('appointments.toastCreated'));
    setCreateOpen(false);
    if (page === 1) load();
    else setPage(1);
    loadCounts();
  }

  async function changeStatus(appointment, status) {
    setBusyId(appointment.id);
    try {
      await appointmentsApi.updateStatus(appointment.id, status);
      toast.success(t(STATUS_TOASTS[status]));
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, 'errors.updateAppointment'));
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = Boolean(debouncedSearch || filters.date || filters.status);

  return (
    <div className="page">
      <div className="page__intro appointments__intro">
        <div>
          <span className="eyebrow">
            <CalendarDays size={14} />
            {t('appointments.eyebrow')}
          </span>
          <h2>{t('appointments.heading')}</h2>
          <p>{t('appointments.description')}</p>
        </div>
        <div className="page__toolbar-actions">
          <button type="button" className="btn btn--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {t('common.refresh')}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            <Plus size={17} />
            {t('appointments.newAppointment')}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="appointment-stats">
        {STATUS_META.map((item) => {
          const Icon = item.icon;
          const active = filters.status === item.value;
          return (
            <button
              key={item.countKey}
              type="button"
              className={`appointment-stat appointment-stat--${item.tone} ${
                active ? 'is-active' : ''
              }`}
              onClick={() => updateFilter('status', item.value)}
              aria-pressed={active}
              aria-label={t('appointments.filterByStatus', { status: t(item.labelKey) })}
            >
              <span className="appointment-stat__icon">
                <Icon size={20} />
              </span>
              <span className="appointment-stat__body">
                <span className="appointment-stat__label">{t(item.labelKey)}</span>
                <strong className="appointment-stat__value">
                  {counts ? counts[item.countKey] : '—'}
                </strong>
                <span className="appointment-stat__hint">{t(item.hintKey)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="panel appointments__filters-panel">
        <div className="appointments__filter-heading">
          <span className="filters__label">
            <SlidersHorizontal size={16} />
            {t('appointments.filters.title')}
          </span>
          <span className="appointments__result-count">
            {t('appointments.results', { count: meta.total })}
          </span>
        </div>

        <div className="appointments__filter-grid">
          <div className="search appointments__search">
            <Search size={17} className="search__icon" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('appointments.filters.searchPlaceholder')}
              aria-label={t('appointments.filters.searchAria')}
            />
            {search ? (
              <button
                type="button"
                className="search__clear"
                onClick={clearSearch}
                aria-label={t('common.clearSearch')}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <div className="field appointments__date">
            <label htmlFor="appointment-date-filter">
              {t('appointments.filters.dateLabel')}
            </label>
            <input
              id="appointment-date-filter"
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
              aria-label={t('appointments.filters.dateAria')}
            />
          </div>

          <button
            type="button"
            className="btn btn--ghost appointments__clear"
            onClick={resetFilters}
            disabled={!hasFilters && !search}
          >
            <RotateCcw size={15} />
            {t('appointments.filters.clearAll')}
          </button>
        </div>

        {hasFilters ? (
          <div className="active-filters">
            <span className="active-filters__label">
              {t('appointments.filters.activeFilters')}
            </span>
            {debouncedSearch ? (
              <button type="button" className="filter-pill" onClick={clearSearch}>
                {debouncedSearch}
                <X size={13} />
              </button>
            ) : null}
            {filters.date ? (
              <button
                type="button"
                className="filter-pill"
                onClick={() => updateFilter('date', '')}
              >
                {formatDate(filters.date)}
                <X size={13} />
              </button>
            ) : null}
            {filters.status ? (
              <button
                type="button"
                className="filter-pill"
                onClick={() => updateFilter('status', '')}
              >
                {t(`status.${filters.status}`)}
                <X size={13} />
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel appointments__panel">
        <header className="panel__header appointments__list-header">
          <div>
            <h3>{t('appointments.listTitle')}</h3>
            <p>{t('appointments.results', { count: meta.total })}</p>
          </div>
          {loading && appointments.length > 0 ? (
            <span className="appointments__updating">
              <RefreshCw size={14} className="spin" />
              {t('common.updating')}
            </span>
          ) : null}
        </header>

        {loading && appointments.length === 0 ? (
          <Spinner label={t('appointments.loading')} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              hasFilters
                ? t('appointments.emptyFilteredTitle')
                : t('appointments.emptyTitle')
            }
            description={
              hasFilters
                ? t('appointments.emptyFilteredDescription')
                : t('appointments.emptyDescription')
            }
            action={
              hasFilters ? (
                <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                  <RotateCcw size={16} />
                  {t('common.clearFilters')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus size={17} />
                  {t('appointments.newAppointment')}
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="appointment-list">
              {appointments.map((appt) => (
                <article
                  key={appt.id}
                  className={`appointment-card appointment-card--${appt.status}`}
                >
                  <div className="appointment-card__patient">
                    <span className="avatar avatar--sm">{initials(appt.patientName)}</span>
                    <div className="appointment-card__identity">
                      <Link
                        className="link"
                        to={`/patients/${appt.patientId}`}
                        aria-label={t('appointments.viewPatient', { name: appt.patientName })}
                      >
                        {appt.patientName}
                      </Link>
                      <span className="cell-sub">{appt.patientCin}</span>
                    </div>
                  </div>

                  <div className="appointment-card__schedule">
                    <span className="appointment-card__date">
                      <CalendarDays size={15} />
                      {formatDate(appt.appointmentDate)}
                    </span>
                    <span className="appointment-card__time">
                      <Clock3 size={15} />
                      {formatTime(appt.appointmentDate)}
                    </span>
                  </div>

                  <div className="appointment-card__reason">
                    <span className="appointment-card__label">{t('fields.reason')}</span>
                    <strong>{appt.reason}</strong>
                    {appt.notes ? <span className="cell-sub">{appt.notes}</span> : null}
                  </div>

                  <div className="appointment-card__meta">
                    <StatusBadge status={appt.status} />
                    <span className="appointment-card__creator">
                      {t('appointments.createdBy', { name: appt.createdByName })}
                    </span>
                  </div>

                  <div className="appointment-card__actions row-actions">
                    {appt.status !== 'confirmed' ? (
                      <button
                        type="button"
                        className="btn btn--success btn--xs"
                        onClick={() => changeStatus(appt, 'confirmed')}
                        disabled={busyId === appt.id}
                      >
                        <CheckCircle2 size={14} />
                        {t('appointments.confirm')}
                      </button>
                    ) : null}
                    {appt.status !== 'cancelled' ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => changeStatus(appt, 'cancelled')}
                        disabled={busyId === appt.id}
                      >
                        <XCircle size={14} />
                        {t('appointments.cancel')}
                      </button>
                    ) : null}
                    {appt.status === 'cancelled' ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => changeStatus(appt, 'pending')}
                        disabled={busyId === appt.id}
                      >
                        <RotateCcw size={14} />
                        {t('appointments.reopen')}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onChange={setPage}
            />
          </>
        )}
      </section>

      <Modal
        open={createOpen}
        title={t('appointments.newModalTitle')}
        subtitle={t('appointments.newModalSubtitle')}
        onClose={() => setCreateOpen(false)}
      >
        <AppointmentForm
          patients={patientOptions}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
