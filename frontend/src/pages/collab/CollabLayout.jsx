import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';

export default function CollabLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <header style={{
        background: '#05056D', padding: '0 clamp(16px, 3vw, 32px)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <img src="/logo.png" alt="Hello Pomelo" style={{ height: 32, width: 32, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          <span className="hide-mobile" style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Hello Pomelo</span>
          <span style={{ background: 'rgba(255,50,133,0.25)', color: '#FF3285', fontSize: '0.6rem', fontWeight: 700, padding: '3px 6px', borderRadius: 6, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>Mon espace</span>
        </div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {isAdmin && (
              <button onClick={() => navigate('/admin')}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                🛠️ Admin
              </button>
            )}
            {user.picture ? (
              <img src={user.picture} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3285, #0000EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                {(user.name || '').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <span className="hide-mobile" style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{user.name}</span>
            <button onClick={() => { logout(); navigate('/'); }}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
              ↩
            </button>
          </div>
        )}
      </header>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(16px, 3vw, 36px) clamp(12px, 3vw, 24px)' }}>
        <Outlet />
      </div>
    </div>
  );
}
