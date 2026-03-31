// src/constants/check-ins.js

/** Champs remplis par le manager dans un point mensuel */
export const MANAGER_FIELDS = [
  'retoursMissions',
  'tauxStaffing',
  'qualites',
  'axeAmelioration',
];

/** Champs remplis par le collaborateur dans un point mensuel */
export const COLLAB_FIELDS = [
  'ressenti',
  'reussites',
  'objectifsAtteints',
  'suggestions',
  'objectifsMoisSuivant',
  'autresSujets',
  'axeAmeliorationSoi',
];

export const POINT_TYPES = {
  MENSUEL:         'mensuel',
  ENTRETIEN_ANNUEL: 'entretien_annuel',
  MI_ANNUEL:       'mi_annuel',
  FIN_ESSAI:       'fin_essai',
  PROFESSIONNEL:   'professionnel',
};

export const POINT_TYPE_LABELS = {
  mensuel:          'Point mensuel',
  entretien_annuel: 'Entretien annuel',
  mi_annuel:        'Entretien mi-annuel',
  fin_essai:        "Fin de période d'essai",
  professionnel:    'Entretien professionnel',
};
