// src/features/settings/service.js
// Paramètres de configuration de l'application
//
// Migration depuis admin.js :
//   loadSettings(), saveSetting(), renderBoSettings()

import { getSupabaseClient } from '../../core/supabase.js';

/**
 * Retourne tous les paramètres sous forme de dictionnaire clé/valeur
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchAll() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('settings').select('*');
  if (error) throw error;
  const settings = {};
  (data || []).forEach(row => { settings[row.key] = row.value; });
  return settings;
}

/**
 * Met à jour ou crée un paramètre
 * @param {string} key
 * @param {any} value
 */
export async function set(key, value) {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

/**
 * Retourne la liste des équipes configurées
 * @param {Record<string, any>} settings
 * @returns {string[]}
 */
export function getEquipes(settings) {
  return settings.equipes || [];
}

/**
 * Retourne la liste des bureaux configurés
 * @param {Record<string, any>} settings
 * @returns {string[]}
 */
export function getBureaux(settings) {
  return settings.bureaux || [];
}
