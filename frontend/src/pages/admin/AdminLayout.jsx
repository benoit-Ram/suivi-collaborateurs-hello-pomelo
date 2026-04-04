import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
