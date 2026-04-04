import React from 'react';
import { Outlet } from 'react-router-dom';

export default function CollabLayout() {
  return (
    <div>
      <header className="collab-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Hello Pomelo" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 8 }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hello Pomelo</span>
          <span className="badge badge-pink" style={{ background: 'rgba(255,50,133,0.25)', color: '#FF3285', textTransform: 'uppercase' }}>Mon espace</span>
        </div>
      </header>
      <div className="collab-content">
        <Outlet />
      </div>
    </div>
  );
}
