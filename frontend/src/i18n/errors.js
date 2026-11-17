const FIELD_KEYS = {
  fullName: 'fields.fullName',
  cin: 'fields.cin',
  phone: 'fields.phone',
  birthDate: 'fields.birthDate',
  address: 'fields.address',
  email: 'fields.email',
  password: 'fields.password',
  patientId: 'fields.patient',
  appointmentDate: 'fields.appointmentDate',
  status: 'fields.status',
  reason: 'fields.reason',
  notes: 'fields.notes',
};

const CODE_KEYS = {
  too_big: 'validation.tooLong',
  invalid_string: 'validation.invalid',
  invalid_enum_value: 'validation.invalidOption',
  invalid_type: 'validation.required',
  invalid_date: 'validation.invalid',
  invalid_union: 'validation.invalid',
  not_finite: 'validation.invalid',
  custom: 'validation.invalid',
};

export function getApiErrorMessage(error, t, fallbackKey = 'errors.generic') {
  if (!error) return t(fallbackKey);

  if (error.code === 'NETWORK_ERROR' || error.status === 0) {
    return t('errors.network');
  }
  if (error.status === 429) return t('errors.rateLimited');
  if (error.status === 401) return t('errors.unauthorized');
  if (error.status === 403) return t('errors.forbidden');
  if (error.status === 404) return t('errors.notFound');
  if (error.status === 422) return t('errors.validation');
  if (error.status === 409) {
    const message = String(error.message || '');
    if (/30 minutes|window/i.test(message)) return t('errors.appointmentConflict');
    if (/\bCIN\b/i.test(message)) return t('errors.duplicateCin');
    if (/email/i.test(message)) return t('errors.duplicateEmail');
    return t('errors.conflict');
  }

  return t(fallbackKey);
}

export function translateFieldErrors(details, t) {
  if (!Array.isArray(details)) return {};

  return details.reduce((mapped, detail) => {
    const field = detail?.field || '_root';
    const fieldLabel = t(FIELD_KEYS[field] || 'fields.name', {
      defaultValue: field === '_root' ? t('fields.name') : field,
    });
    const key = CODE_KEYS[detail?.code] || 'validation.invalid';
    mapped[field] = t(key, { field: fieldLabel });
    return mapped;
  }, {});
}
