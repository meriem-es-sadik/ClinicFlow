import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Pencil,
  Phone,
  IdCard,
  CalendarDays,
  MapPin,
  Cake,
  Plus,
  ClipboardList,
} from 'lucide-react';
import Modal from '../components/Modal';
import PatientForm from '../components/PatientForm';
import AppointmentForm from '../components/AppointmentForm';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { patientsApi } from '../api/patients';
import { appointmentsApi } from '../api/appointments';
import { useToast } from '../context/ToastContext';
import { formatDate, formatDateTime, initials } from '../utils/format';
import { getApiErrorMessage } from '../i18n/errors';

export default function PatientDetails() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await patientsApi.get(id);
      setPatient(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, t, 'errors.loadPatient'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(payload) {
    await patientsApi.update(patient.id, payload);
    toast.success(t('patientDetails.toastUpdated'));
    setEditOpen(false);
    load();
  }

  async function handleCreateAppointment(payload) {
    await appointmentsApi.create(payload);
    toast.success(t('patientDetails.toastCreated'));
    setApptOpen(false);
    load();
  }

  if (loading && !patient) {
    return (
      <div className="page">
        <Spinner fullPage label={t('patientDetails.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert--error">{error}</div>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/patients')}>
          <ArrowLeft size={16} />
          {t('patientDetails.backToPatients')}
        </button>
      </div>
    );
  }

  const appointments = patient.appointments || [];

  return (
    <div className="page">
      <Link to="/patients" className="back-link">
        <ArrowLeft size={16} />
        {t('patientDetails.backToPatients')}
      </Link>

      <section className="panel patient-header">
        <div className="patient-header__identity">
          <span className="avatar avatar--lg">{initials(patient.fullName)}</span>
          <div>
            <h2>{patient.fullName}</h2>
            <span className="chip">{patient.cin}</span>
          </div>
        </div>
        <div className="patient-header__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setApptOpen(true)}
          >
            <Plus size={17} />
            {t('patientDetails.newAppointment')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditOpen(true)}>
            <Pencil size={16} />
            {t('patientDetails.edit')}
          </button>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <header className="panel__header">
            <h3>{t('patientDetails.patientInformation')}</h3>
          </header>
          <dl className="info-list">
            <div>
              <dt>
                <IdCard size={16} /> {t('fields.cin')}
              </dt>
              <dd>{patient.cin}</dd>
            </div>
            <div>
              <dt>
                <Phone size={16} /> {t('fields.phone')}
              </dt>
              <dd>{patient.phone}</dd>
            </div>
            <div>
              <dt>
                <Cake size={16} /> {t('fields.birthDate')}
              </dt>
              <dd>{formatDate(patient.birthDate)}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={16} /> {t('fields.address')}
              </dt>
              <dd>{patient.address || t('common.notAvailable')}</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={16} /> {t('patientDetails.registeredOn')}
              </dt>
              <dd>{formatDate(patient.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h3>{t('patientDetails.appointmentHistory')}</h3>
              <p>{t('patientDetails.appointmentCount', { count: appointments.length })}</p>
            </div>
          </header>

          {appointments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('patientDetails.noAppointmentsTitle')}
              description={t('patientDetails.noAppointmentsDescription')}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('fields.appointmentDate')}</th>
                    <th>{t('common.reason')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                      <td>{formatDateTime(appt.appointmentDate)}</td>
                      <td>
                        {appt.reason}
                        {appt.notes ? <span className="cell-sub">{appt.notes}</span> : null}
                      </td>
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

      <Modal
        open={editOpen}
        title={t('patientDetails.editTitle')}
        subtitle={t('patientDetails.editSubtitle')}
        onClose={() => setEditOpen(false)}
      >
        <PatientForm
          patient={patient}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal
        open={apptOpen}
        title={t('patientDetails.newAppointmentTitle')}
        subtitle={t('patientDetails.newAppointmentSubtitle', { name: patient.fullName })}
        onClose={() => setApptOpen(false)}
      >
        <AppointmentForm
          patients={[patient]}
          defaultPatientId={patient.id}
          onSubmit={handleCreateAppointment}
          onCancel={() => setApptOpen(false)}
        />
      </Modal>
    </div>
  );
}
