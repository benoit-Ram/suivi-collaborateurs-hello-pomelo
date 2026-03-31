// src/features/check-ins/service.js
// Points de suivi mensuels et entretiens
//
// Migration depuis admin.js :
//   loadPoints(), saveManagerPoint(), saveCollabPoint()
//   autoCreateMonthlyPoints(), getPointStatus()
// Migration depuis collab.js :
//   loadMyPoints(), saveMyPoint()

import { getSupabaseClient } from '../../core/supabase.js';
import { currentMois, isPointLocked } from '../../utils/dates.js';
import { MANAGER_FIELDS, COLLAB_FIELDS, POINT_TYPES } from '../../constants/check-ins.js';

/**
 * Retourne les points de suivi d'un collaborateur
 * @param {string} collabId
 * @returns {Promise<object[]>}
 */
export async function fetchByCollab(collabId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('points_suivi')
    .select('*')
    .eq('collaborateur_id', collabId)
    .order('mois', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Sauvegarde la partie manager d'un point mensuel
 * @param {string} pointId
 * @param {object} managerData
 */
export async function saveManagerSection(pointId, managerData) {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('points_suivi')
    .update({ manager_data: managerData })
    .eq('id', pointId);
  if (error) throw error;
}

/**
 * Sauvegarde la partie collaborateur d'un point mensuel
 * @param {string} pointId
 * @param {object} collabData
 */
export async function saveCollabSection(pointId, collabData) {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('points_suivi')
    .update({ collab_data: collabData })
    .eq('id', pointId);
  if (error) throw error;
}

/**
 * Crée automatiquement les points mensuels manquants pour tous les collaborateurs actifs
 * Cette logique doit migrer côté serveur (NestJS cron job)
 * @param {string[]} collabIds
 */
export async function autoCreateMonthly(collabIds) {
  const mois = currentMois();
  const sb = getSupabaseClient();

  const { data: existing } = await sb
    .from('points_suivi')
    .select('collaborateur_id')
    .eq('mois', mois)
    .eq('type', POINT_TYPES.MENSUEL)
    .in('collaborateur_id', collabIds);

  const existingIds = new Set((existing || []).map(p => p.collaborateur_id));
  const toCreate = collabIds.filter(id => !existingIds.has(id));

  if (toCreate.length === 0) return;

  const rows = toCreate.map(id => ({
    collaborateur_id: id,
    mois,
    type: POINT_TYPES.MENSUEL,
    manager_data: {},
    collab_data: {},
  }));

  const { error } = await sb.from('points_suivi').insert(rows);
  if (error) throw error;
}

/**
 * Calcule le statut de complétion d'un point
 * @param {{ manager_data?: object, collab_data?: object }} point
 * @returns {'complet' | 'partiel' | 'vide'}
 */
export function getPointStatus(point) {
  const md = point.manager_data || {};
  const cd = point.collab_data || {};

  const mdKeys = Object.keys(md).filter(k => k !== 'objectifs');
  const cdKeys = Object.keys(cd).filter(k => k !== 'objectifs');

  const managerDone = mdKeys.some(k => md[k] && String(md[k]).trim());
  const collabDone  = cdKeys.some(k => cd[k] && String(cd[k]).trim());
  const managerFull = mdKeys.length > 0 && mdKeys.every(k => md[k] && String(md[k]).trim());
  const collabFull  = cdKeys.length > 0 && cdKeys.every(k => cd[k] && String(cd[k]).trim());

  if (managerFull && collabFull) return 'complet';
  if (managerDone || collabDone) return 'partiel';
  return 'vide';
}

export { isPointLocked };
