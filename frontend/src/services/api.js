const API = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Erreur API');
  }
  return res.json();
}

export const api = {
  // Collaborateurs
  getCollaborateurs: () => request('/collaborateurs'),
  getCollaborateur: (id) => request(`/collaborateurs/${id}`),
  createCollaborateur: (data) => request('/collaborateurs', { method: 'POST', body: data }),
  updateCollaborateur: (id, data) => request(`/collaborateurs/${id}`, { method: 'PUT', body: data }),
  deleteCollaborateur: (id) => request(`/collaborateurs/${id}`, { method: 'DELETE' }),

  // Objectifs
  getObjectifs: (filters) => request('/objectifs?' + new URLSearchParams(filters || {})),
  createObjectif: (data) => request('/objectifs', { method: 'POST', body: data }),
  updateObjectif: (id, data) => request(`/objectifs/${id}`, { method: 'PUT', body: data }),
  deleteObjectif: (id) => request(`/objectifs/${id}`, { method: 'DELETE' }),

  // Points de suivi
  getPointsSuivi: (filters) => request('/points-suivi?' + new URLSearchParams(filters || {})),
  createPointSuivi: (data) => request('/points-suivi', { method: 'POST', body: data }),
  updatePointSuivi: (id, data) => request(`/points-suivi/${id}`, { method: 'PUT', body: data }),

  // Absences
  getAbsences: (filters) => request('/absences?' + new URLSearchParams(filters || {})),
  createAbsence: (data) => request('/absences', { method: 'POST', body: data }),
  updateAbsence: (id, data) => request(`/absences/${id}`, { method: 'PUT', body: data }),
  deleteAbsence: (id) => request(`/absences/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request('/settings'),
  updateSetting: (id, data) => request(`/settings/${id}`, { method: 'PUT', body: data }),
};
