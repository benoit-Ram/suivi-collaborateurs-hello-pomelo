import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/AuthContext';
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
import LoginPage from './pages/LoginPage';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/collab" replace />;
  return children;
}

function AppContent() {
  const { toast } = useData();
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Dashboard />} />
          <Route path="collaborateurs" element={<Collaborateurs />} />
          <Route path="collaborateurs/:id" element={<CollabProfile />} />
          <Route path="organigramme" element={<Organigramme />} />
          <Route path="objectifs" element={<Objectifs />} />
          <Route path="absences" element={<Absences />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/collab" element={<RequireAuth><CollabLayout /></RequireAuth>}>
          <Route index element={<CollabAccueil />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toast message={toast} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
