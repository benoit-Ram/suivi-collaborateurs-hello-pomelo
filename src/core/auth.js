// src/core/auth.js
// Gestion de l'authentification
//
// Extrait et réorganisé depuis collab.js
// TODO Phase 1 : remplacer par Keycloak OIDC / Supabase Auth

import { getSupabaseClient } from './supabase.js';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

/**
 * Retourne la session active depuis sessionStorage
 * @returns {{ collabId: string, role: string, email: string } | null}
 */
export function getCurrentSession() {
  try {
    const raw = sessionStorage.getItem('rh_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persiste la session active
 * @param {{ collabId: string, role: string, email: string }} session
 */
export function setSession(session) {
  sessionStorage.setItem('rh_session', JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem('rh_session');
}

/**
 * Vérifie si l'utilisateur courant a l'un des rôles requis
 * @param {...string} roles
 */
export function hasRole(...roles) {
  const session = getCurrentSession();
  return session ? roles.includes(session.role) : false;
}

export function isAdmin() {
  return hasRole(ROLES.ADMIN, ROLES.SUPER_ADMIN);
}

export function isManager() {
  return hasRole(ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN);
}

/**
 * Charge le profil collaborateur lié à un email Google
 * @param {string} email
 * @returns {Promise<object | null>}
 */
export async function loadCollabByEmail(email) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('collaborateurs')
    .select('*')
    .eq('email', email)
    .single();
  if (error) return null;
  return data;
}
