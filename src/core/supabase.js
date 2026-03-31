// src/core/supabase.js
// Point d'entrée unique pour le client Supabase
//
// Les credentials sont lus depuis window.__ENV__ (injectés au runtime)
// ou depuis les constantes legacy (compatibilité POC).
//
// En production : ne jamais hardcoder ces valeurs ici.
// Les injecter via un mécanisme de configuration (ex: endpoint /config.json)

function getConfig() {
  // Priorité 1 : variables injectées au runtime (production)
  if (window.__ENV__) {
    return {
      url: window.__ENV__.SUPABASE_URL,
      key: window.__ENV__.SUPABASE_ANON_KEY,
    };
  }
  // Priorité 2 : constantes legacy (POC — à supprimer avant production)
  if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
    return { url: SUPABASE_URL, key: SUPABASE_KEY };
  }
  throw new Error('Supabase non configuré. Définir window.__ENV__.SUPABASE_URL et SUPABASE_ANON_KEY.');
}

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const { url, key } = getConfig();
  _client = window.supabase.createClient(url, key);
  return _client;
}

// Alias court pour compatibilité avec le code existant
export const sb = new Proxy({}, {
  get(_, prop) {
    return getSupabaseClient()[prop];
  },
});
