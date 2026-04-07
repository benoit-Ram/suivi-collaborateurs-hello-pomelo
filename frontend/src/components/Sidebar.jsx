import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useData } from '../services/DataContext';
import { useAuth } from '../services/AuthContext';
import { Avatar, useKeyboard } from './UI';
import { APP_VERSION, BUILD_DATE } from '../version';

export default function Sidebar() {
  const { collabs, absences } = useData();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('hp_theme')==='dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const pendingAbs = absences.filter(a => a.statut === 'en_attente').length;

  useKeyboard('ctrl+k', useCallback(() => { searchRef.current?.focus(); }, []));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('hp_theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Close sidebar on navigation (mobile)
  const handleNav = (to) => {
    setMobileOpen(false);
    navigate(to);
  };

  const searchResults = search.length >= 2
    ? collabs.filter(c => (c.prenom+' '+c.nom+' '+c.poste+' '+(c.email||'')).toLowerCase().includes(search.toLowerCase())).slice(0,8)
    : [];

  const navItems = [
    { to: '/admin', icon: '🏠', label: 'Tableau de bord', end: true },
    { to: '/admin/collaborateurs', icon: '👥', label: 'Collaborateurs' },
    { to: '/admin/organigramme', icon: '🗂️', label: 'Organigramme' },
    { to: '/admin/objectifs', icon: '🎯', label: 'Objectifs' },
    { to: '/admin/absences', icon: '🏖️', label: 'Congés', badge: pendingAbs },
    { to: '/admin/settings', icon: '⚙️', label: 'Paramètres' },
  ];

  const sidebarContent = (
    <>
      <NavLink to="/admin" onClick={()=>setMobileOpen(false)} style={{ textDecoration:'none', padding:'24px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color:'white', fontWeight:700, fontSize:'1rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Hello Pomelo</div>
        <div style={{ color:'#8F8FBC', fontSize:'0.72rem', marginTop:2, fontWeight:600 }}>Suivi Collaborateurs</div>
      </NavLink>

      <div style={{ padding:'8px 12px', position:'relative' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(()=>setShowResults(false), 200)}
          ref={searchRef}
          placeholder="🔍 Rechercher... (Ctrl+K)"
          style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:'0.85rem', background:'rgba(255,255,255,0.12)', color:'white', outline:'none' }} />
        {showResults && searchResults.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:12, right:12, background:'var(--white)', borderRadius:10, boxShadow:'var(--shadow-lg)', zIndex:200, maxHeight:300, overflowY:'auto', marginTop:4 }}>
            {searchResults.map(c => (
              <div key={c.id} onMouseDown={() => { handleNav(`/admin/collaborateurs/${c.id}`); setSearch(''); }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', transition:'background 0.15s' }}
                onMouseOver={e=>e.currentTarget.style.background='var(--hover-surface, #F0F0FF)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} />
                <div><div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--navy)'}}>{c.prenom} {c.nom}</div><div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{c.poste}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8F8FBC', padding:'12px 8px 6px' }}>Navigation</span>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={()=>setMobileOpen(false)}
            style={({ isActive }) => ({ display:'flex', alignItems:'center', gap:10, padding:'12px 12px', borderRadius:10, cursor:'pointer', transition:'all 0.15s', color: isActive?'#FF3285':'rgba(255,255,255,0.65)', background: isActive?'rgba(255,50,133,0.2)':'transparent', fontSize:'0.88rem', fontWeight:600, textDecoration:'none', fontFamily:'inherit' })}>
            <span style={{ fontSize:'1rem', width:20, textAlign:'center' }}>{item.icon}</span>
            <span style={{ flex:1 }}>{item.label}</span>
            {item.badge > 0 && <span style={{ background:'var(--pink)', color:'white', fontSize:'0.65rem', fontWeight:800, padding:'2px 7px', borderRadius:99 }}>{item.badge}</span>}
          </NavLink>
        ))}
      </div>

      {/* User info */}
      {user && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {user.picture ? <img src={user.picture} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' }} />
              : <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#FF3285,#0000EA)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'0.75rem', fontWeight:700 }}>{(user.name||'').split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)}</div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'white', fontSize:'0.8rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
              <div style={{ color:'#8F8FBC', fontSize:'0.65rem', fontWeight:600 }}>{user.isSuperAdmin ? 'Super Admin' : 'Admin'}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setMobileOpen(false); navigate('/collab'); }} style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.7)', fontSize:'0.7rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>👤 Mon espace</button>
            <button onClick={() => { logout(); navigate('/'); }} style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.7)', fontSize:'0.7rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Déconnexion</button>
          </div>
        </div>
      )}
      <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.55rem', color:'#8F8FBC', fontWeight:600 }}>© 2026 · v{APP_VERSION} · {BUILD_DATE}</span>
        <button onClick={() => setDark(!dark)} style={{ background:'none', border:'none', fontSize:'1rem', cursor:'pointer' }}>{dark?'☀️':'🌙'}</button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger toggle — hidden by default, shown via CSS on mobile */}
      <button className="sidebar-mobile-toggle" onClick={()=>setMobileOpen(!mobileOpen)} style={{
        position:'fixed', top:12, left:12, zIndex:301,
        width:44, height:44, borderRadius:12, border:'none', cursor:'pointer',
        background: mobileOpen ? 'var(--pink)' : '#05056D', color:'white',
        fontSize:'1.2rem', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 14px rgba(5,5,109,0.3)'
      }}>
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div onClick={()=>setMobileOpen(false)} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:199
      }} />}

      {/* Desktop sidebar — hidden via CSS on mobile */}
      <nav className="sidebar-desktop" style={{ width:'var(--sidebar-w)', minHeight:'100vh', background:'#05056D', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, zIndex:100 }}>
        {sidebarContent}
      </nav>

      {/* Mobile sidebar (slide-in) — only rendered when open */}
      {mobileOpen && (
        <nav style={{
          width:280, minHeight:'100vh', background:'#05056D',
          display:'flex', flexDirection:'column',
          position:'fixed', left:0, top:0, zIndex:300,
          boxShadow:'4px 0 24px rgba(0,0,0,0.3)', overflowY:'auto'
        }}>
          <div style={{height:60}} />
          {sidebarContent}
        </nav>
      )}
    </>
  );
}
