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
    // Token expired or invalid — clear session and redirect via React Router
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('hp_auth_session');
    // Dispatch event so AuthContext can handle the redirect
    window.dispatchEvent(new Event('auth-expired'));
    throw new Error('Session expirée, reconnectez-vous');
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

  // Clients
  getClients: () => request('/clients'),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: data }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: data }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  // Missions
  getMissions: (filters) => request('/missions?' + new URLSearchParams(filters || {})),
  getMission: (id) => request(`/missions/${id}`),
  createMission: (data) => request('/missions', { method: 'POST', body: data }),
  updateMission: (id, data) => request(`/missions/${id}`, { method: 'PUT', body: data }),
  deleteMission: (id) => request(`/missions/${id}`, { method: 'DELETE' }),

  // Assignments
  getAssignments: (filters) => request('/assignments?' + new URLSearchParams(filters || {})),
  createAssignment: (data) => request('/assignments', { method: 'POST', body: data }),
  updateAssignment: (id, data) => request(`/assignments/${id}`, { method: 'PUT', body: data }),
  deleteAssignment: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),

  // Time Entries
  getTimeEntries: (filters) => request('/time-entries?' + new URLSearchParams(filters || {})),
  createTimeEntry: (data) => request('/time-entries', { method: 'POST', body: data }),
  updateTimeEntry: (id, data) => request(`/time-entries/${id}`, { method: 'PUT', body: data }),

  // Activity Log
  getActivityLog: (limit) => request(`/activity-log?limit=${limit || 50}`),
  logActivity: (action, auteur, cible, details) => request('/activity-log', { method: 'POST', body: { action, auteur, cible, details } }).catch(() => {}),
};
