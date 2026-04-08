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
import Missions from './pages/admin/Missions';
import Settings from './pages/admin/Settings';
import CollabLayout from './pages/collab/CollabLayout';
import CollabAccueil from './pages/collab/CollabAccueil';
import LoginPage from './pages/LoginPage';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--offwhite)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #CFD0E5', borderTopColor: '#FF3285', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: '#05056D', fontSize: '0.9rem', fontWeight: 700 }}>Chargement...</div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
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
          <Route path="missions" element={<Missions />} />
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
