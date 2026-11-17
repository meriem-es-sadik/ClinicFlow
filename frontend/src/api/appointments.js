import { api } from './client';

export const appointmentsApi = {
  list: ({ date, status, patientId, search, page, limit } = {}) =>
    api.get('/appointments', { date, status, patientId, search, page, limit }),
  counts: () => api.get('/appointments/counts'),
  create: (data) => api.post('/appointments', data),
  updateStatus: (id, status) => api.patch(`/appointments/${id}/status`, { status }),
};
