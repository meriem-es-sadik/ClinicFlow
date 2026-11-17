import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Users,
  RefreshCw,
} from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PatientForm from '../components/PatientForm';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { patientsApi } from '../api/patients';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/format';
import { getApiErrorMessage } from '../i18n/errors';

const PAGE_SIZE = 8;

export default function PatientsList() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [patients, setPatients] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formModal, setFormModal] = useState({ open: false, patient: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      const res = await patientsApi.list({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setPatients(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(getApiErrorMessage(err, t, 'errors.loadPatients'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload) {
    await patientsApi.create(payload);
    toast.success(t('patients.toastCreated'));
    setFormModal({ open: false, patient: null });
    if (page !== 1) setPage(1);
    else load();
  }

  async function handleUpdate(payload) {
    await patientsApi.update(formModal.patient.id, payload);
    toast.success(t('patients.toastUpdated'));
    setFormModal({ open: false, patient: null });
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await patientsApi.remove(toDelete.id);
      toast.success(t('patients.toastDeleted'));
      setToDelete(null);
      if (patients.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, 'errors.deletePatient'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <div className="page__toolbar">
        <div className="search">
          <Search size={17} className="search__icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('patients.searchPlaceholder')}
            aria-label={t('patients.searchAria')}
          />
        </div>
        <div className="page__toolbar-actions">
          <button type="button" className="btn btn--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setFormModal({ open: true, patient: null })}
          >
            <Plus size={17} />
            {t('patients.addPatient')}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <section className="panel">
        {loading && patients.length === 0 ? (
          <Spinner label={t('patients.loading')} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? t('patients.noMatchTitle') : t('patients.emptyTitle')}
            description={
              debouncedSearch
                ? t('patients.noMatchDescription')
                : t('patients.emptyDescription')
            }
            action={
              !debouncedSearch ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setFormModal({ open: true, patient: null })}
                >
                  <Plus size={17} />
                  {t('patients.addPatient')}
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.patient')}</th>
                    <th>{t('fields.cin')}</th>
                    <th>{t('fields.phone')}</th>
                    <th>{t('fields.birthDate')}</th>
                    <th>{t('patients.created')}</th>
                    <th className="table__actions-col">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <Link className="link" to={`/patients/${patient.id}`}>
                          {patient.fullName}
                        </Link>
                        {patient.address ? (
                          <span className="cell-sub">{patient.address}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="chip">{patient.cin}</span>
                      </td>
                      <td>{patient.phone}</td>
                      <td>{formatDate(patient.birthDate)}</td>
                      <td>{formatDate(patient.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="icon-btn"
                            to={`/patients/${patient.id}`}
                            title={t('common.viewDetails')}
                            aria-label={t('patients.viewAria', { name: patient.fullName })}
                          >
                            <Eye size={16} />
                          </Link>
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('common.edit')}
                            aria-label={t('patients.editAria', { name: patient.fullName })}
                            onClick={() => setFormModal({ open: true, patient })}
                          >
                            <Pencil size={16} />
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title={t('common.delete')}
                              aria-label={t('patients.deleteAria', { name: patient.fullName })}
                              onClick={() => setToDelete(patient)}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        open={formModal.open}
        title={formModal.patient ? t('patients.editTitle') : t('patients.addTitle')}
        subtitle={
          formModal.patient
            ? t('patients.editSubtitle')
            : t('patients.addSubtitle')
        }
        onClose={() => setFormModal({ open: false, patient: null })}
      >
        <PatientForm
          patient={formModal.patient}
          onSubmit={formModal.patient ? handleUpdate : handleCreate}
          onCancel={() => setFormModal({ open: false, patient: null })}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('patients.deleteTitle')}
        message={t('patients.deleteMessage', { name: toDelete?.fullName })}
        confirmLabel={t('common.delete')}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
