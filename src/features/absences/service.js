// src/features/absences/service.js
// Logique métier des absences et congés
//
// Migration depuis admin.js :
//   loadAbsences(), updateAbsStatut(), getSoldeConges()
//   getMySolde(), loadMyAbsences(), submitConge()

import { getSupabaseClient } from '../../core/supabase.js';
import { countWorkDays } from '../../utils/holidays.js';
import { ABS_STATUTS } from '../../constants/absences.js';

/**
 * Retourne toutes les absences (admin)
 * @returns {Promise<object[]>}
 */
export async function fetchAll() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('absences')
    .select('*, collaborateurs(prenom, nom, photo_url, equipes, manager_id, valideur_conges_id)')
    .order('date_debut', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Retourne les absences d'un collaborateur
 * @param {string} collabId
 * @returns {Promise<object[]>}
 */
export async function fetchByCollab(collabId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('absences')
    .select('*')
    .eq('collaborateur_id', collabId)
    .order('date_debut', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Soumet une demande de congé
 * @param {{ collabId: string, type: string, dateDebut: string, dateFin: string, demiJournees?: object, motif?: string }} params
 * @returns {Promise<object>}
 */
export async function submitRequest({ collabId, type, dateDebut, dateFin, demiJournees, motif }) {
  const sb = getSupabaseClient();
  const nbJours = countWorkDays(dateDebut, dateFin);
  const { data, error } = await sb
    .from('absences')
    .insert({
      collaborateur_id: collabId,
      type,
      date_debut:   dateDebut,
      date_fin:     dateFin,
      nb_jours:     nbJours,
      demi_journees: demiJournees || null,
      motif:        motif || null,
      statut:       'en_attente',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Met à jour le statut d'une absence (approbation / refus)
 * @param {string} id
 * @param {'approuve' | 'refuse'} statut
 * @param {string} [commentaire]
 */
export async function updateStatut(id, statut, commentaire) {
  if (!Object.keys(ABS_STATUTS).includes(statut)) {
    throw new Error(`Statut invalide : ${statut}`);
  }
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('absences')
    .update({ statut, commentaire_valideur: commentaire || null })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Calcule le solde de congés disponible pour un collaborateur
 * @param {string} collabId
 * @param {string} dateEntree — format YYYY-MM-DD
 * @returns {Promise<number>} — nombre de jours disponibles
 */
export async function getSolde(collabId, dateEntree) {
  const absences = await fetchByCollab(collabId);
  const approved = absences.filter(a => a.type === 'conge' && a.statut === 'approuve');
  const taken = approved.reduce((sum, a) => sum + (a.nb_jours || 0), 0);

  // Acquisition : 2,08 jours/mois travaillé depuis l'entrée
  const monthsWorked = Math.floor(
    (new Date() - new Date(dateEntree)) / (1000 * 60 * 60 * 24 * 30.44)
  );
  const acquired = Math.min(monthsWorked * 2.08, 25); // plafond légal 25j

  return Math.max(0, acquired - taken);
}
