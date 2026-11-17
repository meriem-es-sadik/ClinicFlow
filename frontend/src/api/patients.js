import { api } from './client';

export const patientsApi = {
  list: ({ search, page, limit } = {}) => api.get('/patients', { search, page, limit }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  remove: (id) => api.delete(`/patients/${id}`),
};
