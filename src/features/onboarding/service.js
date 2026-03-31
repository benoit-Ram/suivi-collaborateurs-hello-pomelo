// src/features/onboarding/service.js
// Gestion de l'onboarding des collaborateurs
//
// Migration depuis admin.js :
//   renderOnboarding(), toggleDoc(), validateUpload(), rejectUpload()

import { getSupabaseClient } from '../../core/supabase.js';
import { DOCS_LABELS } from '../../constants/onboarding.js';

/**
 * Structure d'onboarding vide (par défaut)
 * @returns {object}
 */
export function defaultOnboarding() {
  const docs = {};
  Object.keys(DOCS_LABELS).forEach(k => { docs[k] = false; });
  return {
    notes:       '',
    materiel:    '',
    acces:       '',
    documents:   docs,
    requiredDocs: [],
    uploads:     {},
  };
}

/**
 * Bascule l'état d'un document d'onboarding
 * @param {string} collabId
 * @param {object} onboarding — état actuel
 * @param {string} docKey
 * @returns {Promise<object>} — nouvel état onboarding
 */
export async function toggleDocument(collabId, onboarding, docKey) {
  const updated = {
    ...onboarding,
    documents: {
      ...onboarding.documents,
      [docKey]: !onboarding.documents?.[docKey],
    },
  };
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('collaborateurs')
    .update({ onboarding: updated })
    .eq('id', collabId);
  if (error) throw error;
  return updated;
}

/**
 * Valide un document uploadé
 * @param {string} collabId
 * @param {object} onboarding
 * @param {string} docKey
 * @returns {Promise<object>}
 */
export async function validateUpload(collabId, onboarding, docKey) {
  const updated = {
    ...onboarding,
    uploads: {
      ...onboarding.uploads,
      [docKey]: { ...(onboarding.uploads?.[docKey] || {}), validated: true },
    },
    documents: { ...onboarding.documents, [docKey]: true },
  };
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('collaborateurs')
    .update({ onboarding: updated })
    .eq('id', collabId);
  if (error) throw error;
  return updated;
}

/**
 * Rejette et supprime un document uploadé
 * @param {string} collabId
 * @param {object} onboarding
 * @param {string} docKey
 * @returns {Promise<object>}
 */
export async function rejectUpload(collabId, onboarding, docKey) {
  const uploads = { ...onboarding.uploads };
  const filePath = uploads[docKey]?.path;

  if (filePath) {
    const sb = getSupabaseClient();
    await sb.storage.from('onboarding-docs').remove([filePath]);
  }

  delete uploads[docKey];
  const updated = { ...onboarding, uploads };

  const sb = getSupabaseClient();
  const { error } = await sb
    .from('collaborateurs')
    .update({ onboarding: updated })
    .eq('id', collabId);
  if (error) throw error;
  return updated;
}
