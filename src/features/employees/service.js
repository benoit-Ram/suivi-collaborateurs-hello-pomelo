// src/features/employees/service.js
// Accès aux données collaborateurs (Supabase)
//
// Migration depuis admin.js :
//   fromRow(), collabFromRow(), initDB(), loadCollabs()
//   saveCollab(), deleteCollab(), uploadPhoto()

import { getSupabaseClient } from '../../core/supabase.js';

const SELECT_FIELDS = `
  id, prenom, nom, poste, email, telephone,
  date_entree, date_sortie, type_contrat, bureau, statut,
  manager_id, equipes, photo_url, google_drive, notes,
  onboarding, objectifs_order, valideur_conges_id
`;

/**
 * Mappe une ligne Supabase vers un objet collaborateur normalisé
 * @param {object} row
 * @returns {object}
 */
export function fromRow(row) {
  return {
    id:              row.id,
    prenom:          row.prenom,
    nom:             row.nom,
    poste:           row.poste || '',
    email:           row.email || '',
    telephone:       row.telephone || '',
    dateEntree:      row.date_entree || '',
    dateSortie:      row.date_sortie || '',
    typeContrat:     row.type_contrat || '',
    bureau:          row.bureau || '',
    statut:          row.statut || 'actif',
    managerId:       row.manager_id || null,
    equipes:         row.equipes || [],
    photoUrl:        row.photo_url || '',
    googleDrive:     row.google_drive || '',
    notes:           row.notes || '',
    onboarding:      row.onboarding || {},
    objectifsOrder:  row.objectifs_order || [],
    valideurCongesId: row.valideur_conges_id || null,
  };
}

/**
 * Retourne tous les collaborateurs actifs
 * @returns {Promise<object[]>}
 */
export async function fetchAll() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('collaborateurs')
    .select(SELECT_FIELDS)
    .order('nom');
  if (error) throw error;
  return (data || []).map(fromRow);
}

/**
 * Retourne un collaborateur par son ID
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function fetchById(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('collaborateurs')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return fromRow(data);
}

/**
 * Crée ou met à jour un collaborateur
 * @param {object} collab — objet collaborateur (sans id → création, avec id → update)
 * @returns {Promise<object>}
 */
export async function upsert(collab) {
  const sb = getSupabaseClient();
  const payload = {
    prenom:           collab.prenom,
    nom:              collab.nom,
    poste:            collab.poste,
    email:            collab.email,
    telephone:        collab.telephone,
    date_entree:      collab.dateEntree || null,
    date_sortie:      collab.dateSortie || null,
    type_contrat:     collab.typeContrat,
    bureau:           collab.bureau,
    statut:           collab.statut,
    manager_id:       collab.managerId || null,
    equipes:          collab.equipes || [],
    photo_url:        collab.photoUrl || null,
    google_drive:     collab.googleDrive || null,
    notes:            collab.notes || null,
    onboarding:       collab.onboarding || {},
    valideur_conges_id: collab.valideurCongesId || null,
  };

  if (collab.id) {
    const { data, error } = await sb
      .from('collaborateurs')
      .update(payload)
      .eq('id', collab.id)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return fromRow(data);
  } else {
    const { data, error } = await sb
      .from('collaborateurs')
      .insert(payload)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return fromRow(data);
  }
}

/**
 * Supprime un collaborateur
 * @param {string} id
 */
export async function remove(id) {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('collaborateurs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
