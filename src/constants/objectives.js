// src/constants/objectives.js

export const STATUS_COLORS = {
  'en-cours':    'badge-blue',
  'atteint':     'badge-green',
  'non-atteint': 'badge-orange',
  'en-attente':  'badge-gray',
};

export const STATUS_LABELS = {
  'en-cours':    'En cours',
  'atteint':     'Atteint ✓',
  'non-atteint': 'Non atteint',
  'en-attente':  'En attente',
};

export const BAR_COLORS = {
  'en-cours':    'linear-gradient(90deg,var(--pink),var(--blue))',
  'atteint':     'linear-gradient(90deg,#22C55E,#16A34A)',
  'non-atteint': 'linear-gradient(90deg,#F97316,#EA580C)',
  'en-attente':  'var(--lavender)',
};

export const POINT_STATUS_BADGE = {
  complet: { label: '✅ Complet', cls: 'badge-green' },
  partiel: { label: '🟡 Partiel', cls: 'badge-orange' },
  vide:    { label: '🔴 Vide',    cls: 'badge-pink'  },
};

export const RECURRENCE_LABELS = {
  hebdomadaire: 'Hebdomadaire',
  mensuel:      'Mensuel',
};
