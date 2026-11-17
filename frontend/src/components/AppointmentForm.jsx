import { useState } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage, translateFieldErrors } from '../i18n/errors';

const STATUSES = [
  { value: 'pending', key: 'status.pending' },
  { value: 'confirmed', key: 'status.confirmed' },
  { value: 'cancelled', key: 'status.cancelled' },
];

function defaultDateTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentForm({ patients = [], defaultPatientId = '', onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [values, setValues] = useState({
    patientId: defaultPatientId,
    appointmentDate: defaultDateTime(),
    reason: '',
    status: 'pending',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError('');

    const clientErrors = {};
    if (!values.patientId) {
      clientErrors.patientId = t('validation.selectPatient');
    }
    const parsedDate = values.appointmentDate ? new Date(values.appointmentDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      clientErrors.appointmentDate = t('validation.validDateTime');
    }
    if (!values.reason.trim()) {
      clientErrors.reason = t('validation.reasonRequired');
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);

    const payload = {
      patientId: values.patientId,
      appointmentDate: parsedDate.toISOString(),
      reason: values.reason.trim(),
      status: values.status,
    };
    if (values.notes.trim()) payload.notes = values.notes.trim();

    try {
      await onSubmit(payload);
    } catch (err) {
      const mapped = translateFieldErrors(err.details, t);
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      setFormError(getApiErrorMessage(err, t, 'errors.createAppointment'));
    } finally {
      setSubmitting(false);
    }
  }

  const noPatients = patients.length === 0;

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="form__alert">{formError}</div> : null}
      {noPatients ? (
        <div className="form__hint">
          <AlertCircle size={16} />
          {t('appointmentForm.noPatientsHint')}
        </div>
      ) : null}

      <div className="form__grid">
        <div className="field field--full">
          <label htmlFor="patientId">{t('fields.patient')} *</label>
          <select
            id="patientId"
            value={values.patientId}
            onChange={(e) => update('patientId', e.target.value)}
          >
            <option value="" disabled>
              {t('appointmentForm.patientPlaceholder')}
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} — {p.cin}
              </option>
            ))}
          </select>
          {errors.patientId ? <span className="field__error">{errors.patientId}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="appointmentDate">{t('fields.appointmentDate')} *</label>
          <input
            id="appointmentDate"
            type="datetime-local"
            value={values.appointmentDate}
            onChange={(e) => update('appointmentDate', e.target.value)}
          />
          {errors.appointmentDate ? (
            <span className="field__error">{errors.appointmentDate}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="status">{t('fields.status')}</label>
          <select
            id="status"
            value={values.status}
            onChange={(e) => update('status', e.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {t(status.key)}
              </option>
            ))}
          </select>
        </div>

        <div className="field field--full">
          <label htmlFor="reason">{t('fields.reason')} *</label>
          <input
            id="reason"
            type="text"
            value={values.reason}
            onChange={(e) => update('reason', e.target.value)}
            placeholder={t('appointmentForm.reasonPlaceholder')}
            autoComplete="off"
          />
          {errors.reason ? <span className="field__error">{errors.reason}</span> : null}
        </div>

        <div className="field field--full">
          <label htmlFor="notes">
            {t('fields.notes')} ({t('common.optional')})
          </label>
          <textarea
            id="notes"
            rows={3}
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder={t('appointmentForm.notesPlaceholder')}
          />
          {errors.notes ? <span className="field__error">{errors.notes}</span> : null}
        </div>
      </div>

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          <X size={16} />
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || noPatients}
        >
          <Save size={16} />
          {submitting ? t('appointmentForm.creating') : t('appointmentForm.create')}
        </button>
      </div>
    </form>
  );
}
