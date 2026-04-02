import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar-w)', flex: 1, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)' }}>
        <Outlet />
      </main>
    </div>
  );
}
