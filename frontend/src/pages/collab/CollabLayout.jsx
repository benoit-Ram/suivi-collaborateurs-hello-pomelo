import React from 'react';
import { Outlet } from 'react-router-dom';

export default function CollabLayout() {
  return (
    <div>
      <header style={{
        background: '#05056D', padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Hello Pomelo" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 8 }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hello Pomelo</span>
          <span style={{ background: 'rgba(255,50,133,0.25)', color: '#FF3285', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Mon espace</span>
        </div>
      </header>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px' }}>
        <Outlet />
      </div>
    </div>
  );
}
