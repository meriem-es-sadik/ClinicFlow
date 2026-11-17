import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage, translateFieldErrors } from '../i18n/errors';

const EMPTY = {
  fullName: '',
  cin: '',
  phone: '',
  birthDate: '',
  address: '',
};

function toFormState(patient) {
  if (!patient) return EMPTY;
  return {
    fullName: patient.fullName || '',
    cin: patient.cin || '',
    phone: patient.phone || '',
    birthDate: patient.birthDate || '',
    address: patient.address || '',
  };
}

export default function PatientForm({ patient, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => toFormState(patient));
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
    if (!values.fullName.trim()) {
      clientErrors.fullName = t('validation.fullNameRequired');
    } else if (values.fullName.trim().length < 2) {
      clientErrors.fullName = t('validation.invalid', { field: t('fields.fullName') });
    }
    if (!values.cin.trim()) {
      clientErrors.cin = t('validation.cinRequired');
    }
    if (!values.phone.trim()) {
      clientErrors.phone = t('validation.phoneRequired');
    }
    if (!values.birthDate) {
      clientErrors.birthDate = t('validation.birthDateRequired');
    } else {
      const birthDate = new Date(`${values.birthDate}T00:00:00`);
      if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > Date.now()) {
        clientErrors.birthDate = t('validation.futureDate', {
          field: t('fields.birthDate'),
        });
      }
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);

    const payload = {
      fullName: values.fullName.trim(),
      cin: values.cin.trim(),
      phone: values.phone.trim(),
      birthDate: values.birthDate,
    };
    if (values.address.trim()) payload.address = values.address.trim();

    try {
      await onSubmit(payload);
    } catch (err) {
      const mapped = translateFieldErrors(err.details, t);
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      setFormError(getApiErrorMessage(err, t, 'errors.savePatient'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="form__alert">{formError}</div> : null}

      <div className="form__grid">
        <div className="field field--full">
          <label htmlFor="fullName">{t('fields.fullName')} *</label>
          <input
            id="fullName"
            type="text"
            value={values.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder={t('patientForm.fullNamePlaceholder')}
            autoComplete="off"
          />
          {errors.fullName ? <span className="field__error">{errors.fullName}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="cin">{t('fields.cin')} *</label>
          <input
            id="cin"
            type="text"
            value={values.cin}
            onChange={(e) => update('cin', e.target.value.toUpperCase())}
            placeholder={t('patientForm.cinPlaceholder')}
            autoComplete="off"
          />
          {errors.cin ? <span className="field__error">{errors.cin}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="phone">{t('fields.phone')} *</label>
          <input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder={t('patientForm.phonePlaceholder')}
            autoComplete="off"
          />
          {errors.phone ? <span className="field__error">{errors.phone}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="birthDate">{t('fields.birthDate')} *</label>
          <input
            id="birthDate"
            type="date"
            value={values.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => update('birthDate', e.target.value)}
          />
          {errors.birthDate ? <span className="field__error">{errors.birthDate}</span> : null}
        </div>

        <div className="field field--full">
          <label htmlFor="address">
            {t('fields.address')} ({t('common.optional')})
          </label>
          <input
            id="address"
            type="text"
            value={values.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder={t('patientForm.addressPlaceholder')}
            autoComplete="off"
          />
          {errors.address ? <span className="field__error">{errors.address}</span> : null}
        </div>
      </div>

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          <X size={16} />
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          <Save size={16} />
          {submitting
            ? t('common.saving')
            : patient
              ? t('patientForm.saveChanges')
              : t('patientForm.create')}
        </button>
      </div>
    </form>
  );
}
