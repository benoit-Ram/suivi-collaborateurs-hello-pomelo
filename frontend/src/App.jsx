import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './services/DataContext';
import { Toast } from './components/UI';
import { useData } from './services/DataContext';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Collaborateurs from './pages/admin/Collaborateurs';
import CollabProfile from './pages/admin/CollabProfile';
import Objectifs from './pages/admin/Objectifs';
import Organigramme from './pages/admin/Organigramme';
import Absences from './pages/admin/Absences';
import Settings from './pages/admin/Settings';
import CollabLayout from './pages/collab/CollabLayout';
import CollabAccueil from './pages/collab/CollabAccueil';

function AppContent() {
  const { toast } = useData();
  return (
    <>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="collaborateurs" element={<Collaborateurs />} />
          <Route path="collaborateurs/:id" element={<CollabProfile />} />
          <Route path="organigramme" element={<Organigramme />} />
          <Route path="objectifs" element={<Objectifs />} />
          <Route path="absences" element={<Absences />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/collab" element={<CollabLayout />}>
          <Route index element={<CollabAccueil />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" />} />
      </Routes>
      <Toast message={toast} />
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
