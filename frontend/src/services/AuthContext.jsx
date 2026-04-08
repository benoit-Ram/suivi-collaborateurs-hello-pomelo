import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken } from './api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '583500042273-qg3a9puk3prhl3hbqfr2jbbtljcgorco.apps.googleusercontent.com';
const SESSION_KEY = 'hp_auth_session';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collabs, setCollabs] = useState([]);

  useEffect(() => {
    // Check if we have a saved session + valid token
    const saved = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem('hp_auth_token');

    if (saved && token) {
      try {
        const s = JSON.parse(saved);
        setUser(s);
        // Load collabs with the existing token
        api.getCollaborateurs().then(data => {
          setCollabs(data || []);
          setLoading(false);
        }).catch(() => {
          // Token expired — clear everything
          localStorage.removeItem(SESSION_KEY);
          setToken(null);
          setUser(null);
          setLoading(false);
        });
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        setToken(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for auth-expired events from API layer
  useEffect(() => {
    const handler = () => { setUser(null); setCollabs([]); };
    window.addEventListener('auth-expired', handler);
    return () => window.removeEventListener('auth-expired', handler);
  }, []);

  /** Login with Google credential — verified server-side */
  async function login(googleCredential) {
    try {
      const result = await api.login(googleCredential);
      // Store the server JWT
      setToken(result.token);

      const u = result.user;
      setUser(u);
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));

      // Load collabs now that we have a valid token
      const data = await api.getCollaborateurs();
      setCollabs(data || []);

      return { user: u };
    } catch (e) {
      return { error: e.message };
    }
  }

  function logout() {
    setUser(null);
    setCollabs([]);
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  async function reloadCollabs() {
    try {
      const data = await api.getCollaborateurs();
      setCollabs(data || []);
      // Refresh current user role if needed
      if (user) {
        const collab = (data || []).find(c => c.id === user.collabId);
        if (collab) {
          const updated = { ...user, isAdmin: user.isSuperAdmin || collab.is_admin === true };
          setUser(updated);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        }
      }
    } catch (e) { console.error('Reload collabs error:', e); }
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
