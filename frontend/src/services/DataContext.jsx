import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [collabs, setCollabs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const reload = useCallback(async () => {
    try {
      const [c, a, s] = await Promise.all([
        api.getCollaborateurs(),
        api.getAbsences(),
        api.getSettings(),
      ]);
      setCollabs(c || []);
      setAbsences(a || []);
      const settingsMap = {};
      (s || []).forEach(r => { settingsMap[r.key] = r.value; });
      setSettings(settingsMap);
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const getCollab = useCallback((id) => collabs.find(c => c.id === id), [collabs]);
  const getManagerName = useCallback((id) => {
    const m = collabs.find(c => c.id === id);
    return m ? `${m.prenom} ${m.nom}` : '—';
  }, [collabs]);

  return (
    <DataContext.Provider value={{ collabs, setCollabs, absences, setAbsences, settings, loading, reload, toast, showToast, getCollab, getManagerName }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() { return useContext(DataContext); }
