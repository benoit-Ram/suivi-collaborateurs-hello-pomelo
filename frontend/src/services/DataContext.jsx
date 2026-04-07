import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { currentMois } from '../components/UI';

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

      // Auto-create monthly entretiens for current month
      const cm = currentMois();
      const missing = (c || []).filter(collab => {
        const hasPoint = (collab.points_suivi || []).some(p => p.mois === cm && p.type === 'mensuel');
        return !hasPoint;
      });
      if (missing.length > 0) {
        try {
          const rows = missing.map(collab => ({
            collaborateur_id: collab.id,
            date: cm + '-01',
            type: 'mensuel',
            mois: cm,
            manager_data: {},
            collab_data: {},
            contenu: 'Entretien RH ' + cm,
          }));
          for (const row of rows) {
            try { await api.createPointSuivi(row); } catch(e) { /* ignore duplicates */ }
          }
        } catch(e) { console.warn('Auto-create entretiens:', e); }
      }
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const toastTimerRef = React.useRef(null);
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
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
