import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const SUPER_ADMIN_EMAIL = 'benoit@hello-pomelo.com';
const GOOGLE_CLIENT_ID = '583500042273-qg3a9puk3prhl3hbqfr2jbbtljcgorco.apps.googleusercontent.com';
const SESSION_KEY = 'hp_auth_session';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, name, picture, collabId, isAdmin, isSuperAdmin }
  const [loading, setLoading] = useState(true);
  const [collabs, setCollabs] = useState([]);

  useEffect(() => {
    // Load collaborateurs then check session
    api.getCollaborateurs().then(data => {
      setCollabs(data || []);
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          const collab = (data || []).find(c => c.email && c.email.toLowerCase() === s.email.toLowerCase());
          if (collab) {
            setUser(buildUser(s.email, s.name, s.picture, collab));
          }
        } catch (e) { sessionStorage.removeItem(SESSION_KEY); }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function buildUser(email, name, picture, collab) {
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL;
    const isAdmin = isSuperAdmin || (collab?.is_admin === true);
    return {
      email,
      name: name || `${collab.prenom} ${collab.nom}`,
      picture: picture || collab.photo_url || null,
      collabId: collab.id,
      collab,
      isAdmin,
      isSuperAdmin,
      role: isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : 'collab',
    };
  }

  function login(email, name, picture) {
    const collab = collabs.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (!collab) return { error: `Aucun compte collaborateur pour "${email}". Contactez votre administrateur.` };

    const u = buildUser(email, name, picture, collab);
    setUser(u);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, name: u.name, picture }));

    // Save Google photo to database
    if (picture && picture !== collab.photo_url) {
      api.updateCollaborateur(collab.id, { photo_url: picture }).catch(() => {});
    }
    return { user: u };
  }

  function logout() {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  // Reload collabs (after admin toggle)
  async function reloadCollabs() {
    const data = await api.getCollaborateurs();
    setCollabs(data || []);
    // Refresh current user role if needed
    if (user) {
      const collab = (data || []).find(c => c.id === user.collabId);
      if (collab) setUser(buildUser(user.email, user.name, user.picture, collab));
    }
  }

  return (
    <AuthContext.Provider value={{
      user, loading, collabs, login, logout, reloadCollabs,
      isAuthenticated: !!user,
      isAdmin: user?.isAdmin || false,
      isSuperAdmin: user?.isSuperAdmin || false,
      GOOGLE_CLIENT_ID,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
