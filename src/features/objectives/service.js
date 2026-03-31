// src/features/objectives/service.js
// Logique métier des objectifs
//
// Migration depuis admin.js :
//   loadObjectifs(), saveObj(), deleteObj(), moveObj()
//   approveObjRequest(), refuseObjRequest()
//   autoRenewRecurringObjectifs()

import { getSupabaseClient } from '../../core/supabase.js';

/**
 * Retourne les objectifs d'un collaborateur
 * @param {string} collabId
 * @returns {Promise<object[]>}
 */
export async function fetchByCollab(collabId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('objectifs')
    .select('*')
    .eq('collaborateur_id', collabId)
    .order('ordre', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Crée ou met à jour un objectif
 * @param {object} obj
 * @returns {Promise<object>}
 */
export async function upsert(obj) {
  const sb = getSupabaseClient();
  const payload = {
    collaborateur_id: obj.collaborateurId,
    titre:            obj.titre,
    description:      obj.description || null,
    statut:           obj.statut || 'en-cours',
    progression:      obj.progression ?? 0,
    recurrence:       obj.recurrence || null,
    echeance:         obj.echeance || null,
    ordre:            obj.ordre ?? 0,
  };

  if (obj.id) {
    const { data, error } = await sb
      .from('objectifs')
      .update(payload)
      .eq('id', obj.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb
      .from('objectifs')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Supprime un objectif
 * @param {string} id
 */
export async function remove(id) {
  const sb = getSupabaseClient();
  const { error } = await sb.from('objectifs').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Met à jour l'ordre d'affichage des objectifs
 * @param {string[]} orderedIds — IDs dans le nouvel ordre
 */
export async function reorder(collabId, orderedIds) {
  const sb = getSupabaseClient();
  const updates = orderedIds.map((id, idx) =>
    sb.from('objectifs').update({ ordre: idx }).eq('id', id)
  );
  await Promise.all(updates);
  // Persiste aussi dans collaborateurs.objectifs_order
  await sb
    .from('collaborateurs')
    .update({ objectifs_order: orderedIds })
    .eq('id', collabId);
}

/**
 * Renouvelle les objectifs récurrents dont l'échéance est passée
 * Cette logique doit migrer côté serveur (NestJS scheduled task)
 * @param {string} collabId
 */
export async function autoRenewRecurring(collabId) {
  const objectives = await fetchByCollab(collabId);
  const today = new Date().toISOString().split('T')[0];
  const toRenew = objectives.filter(o =>
    o.recurrence && o.statut !== 'en-cours' && o.echeance && o.echeance < today
  );

  const sb = getSupabaseClient();
  await Promise.all(toRenew.map(o =>
    sb.from('objectifs').update({
      statut: 'en-cours',
      progression: 0,
      echeance: nextEcheance(o.echeance, o.recurrence),
    }).eq('id', o.id)
  ));
}

/**
 * Calcule la prochaine échéance selon la récurrence
 * @param {string} echeance — YYYY-MM-DD
 * @param {'hebdomadaire' | 'mensuel'} recurrence
 * @returns {string}
 */
function nextEcheance(echeance, recurrence) {
  const d = new Date(echeance);
  if (recurrence === 'hebdomadaire') d.setDate(d.getDate() + 7);
  else if (recurrence === 'mensuel') d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}
