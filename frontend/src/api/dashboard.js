import { api } from './client';

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  upcoming: (limit = 5) => api.get('/dashboard/upcoming', { limit }),
};
