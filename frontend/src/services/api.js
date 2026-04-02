const API = '/api';
const TOKEN_KEY = 'hp_auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Token expired or invalid — clear session
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('hp_auth_session');
    window.location.href = '/';
    throw new Error('Session expirée, veuillez vous reconnecter');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Erreur API');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (credential) => request('/auth/login', { method: 'POST', body: { credential } }),

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
  upsertSetting: (key, value) => request('/settings/upsert', { method: 'POST', body: { key, value } }),
};
