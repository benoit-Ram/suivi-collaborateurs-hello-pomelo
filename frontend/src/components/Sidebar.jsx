import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/admin', icon: '🏠', label: 'Tableau de bord', end: true },
  { to: '/admin/collaborateurs', icon: '👥', label: 'Collaborateurs' },
  { to: '/admin/objectifs', icon: '🎯', label: 'Objectifs' },
  { to: '/admin/absences', icon: '🏖️', label: 'Congés & Absences' },
  { to: '/admin/settings', icon: '⚙️', label: 'Paramètres' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button
        className="sidebar-toggle"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
      >
        <span className={`hamburger-icon ${open ? 'open' : ''}`}>
          <span /><span /><span />
        </span>
      </button>

      {/* Overlay - mobile only */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar nav */}
      <nav className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <NavLink to="/admin" style={{ textDecoration: 'none' }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hello Pomelo</div>
            <div style={{ color: '#8F8FBC', fontSize: '0.72rem', marginTop: 2, fontWeight: 600 }}>Suivi Collaborateurs</div>
          </NavLink>
        </div>
        <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8F8FBC', padding: '12px 8px 6px' }}>Navigation</span>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                color: isActive ? '#FF3285' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(255,50,133,0.2)' : 'transparent',
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
                fontFamily: 'inherit',
              })}
            >
              <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.65rem', color: '#8F8FBC', fontWeight: 600, textTransform: 'uppercase' }}>Hello Pomelo © 2025</p>
        </div>
      </nav>
    </>
  );
}
