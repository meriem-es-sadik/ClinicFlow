import { api } from './client';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
};
