import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useData } from '../services/DataContext';
import { Avatar } from './UI';

export default function Sidebar() {
  const { collabs, absences } = useData();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('hp_theme')==='dark');
  const navigate = useNavigate();

  const pendingAbs = absences.filter(a => a.statut === 'en_attente').length;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('hp_theme', dark ? 'dark' : 'light');
  }, [dark]);

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

  return (
    <nav style={{ width:'var(--sidebar-w)', minHeight:'100vh', background:'#05056D', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, zIndex:100 }}>
      <NavLink to="/admin" style={{ textDecoration:'none', padding:'24px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color:'white', fontWeight:700, fontSize:'1rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Hello Pomelo</div>
        <div style={{ color:'#8F8FBC', fontSize:'0.72rem', marginTop:2, fontWeight:600 }}>Suivi Collaborateurs</div>
      </NavLink>

      {/* Global search */}
      <div style={{ padding:'8px 12px', position:'relative' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(()=>setShowResults(false), 200)}
          placeholder="🔍 Rechercher..."
          style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:'0.82rem', background:'rgba(255,255,255,0.12)', color:'white', outline:'none' }} />
        {showResults && searchResults.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:12, right:12, background:'white', borderRadius:10, boxShadow:'0 8px 32px rgba(5,5,109,0.2)', zIndex:200, maxHeight:300, overflowY:'auto', marginTop:4 }}>
            {searchResults.map(c => (
              <div key={c.id} onMouseDown={() => { navigate(`/admin/collaborateurs/${c.id}`); setSearch(''); }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', transition:'background 0.1s' }}
                onMouseOver={e=>e.currentTarget.style.background='#F0F0FF'} onMouseOut={e=>e.currentTarget.style.background='white'}>
                <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} />
                <div><div style={{fontWeight:700,fontSize:'0.85rem',color:'#05056D'}}>{c.prenom} {c.nom}</div><div style={{fontSize:'0.72rem',color:'#6B6B9A'}}>{c.poste}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8F8FBC', padding:'12px 8px 6px' }}>Navigation</span>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            style={({ isActive }) => ({ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, cursor:'pointer', transition:'all 0.15s', color: isActive?'#FF3285':'rgba(255,255,255,0.65)', background: isActive?'rgba(255,50,133,0.2)':'transparent', fontSize:'0.85rem', fontWeight:600, textDecoration:'none', fontFamily:'inherit' })}>
            <span style={{ fontSize:'1rem', width:20, textAlign:'center' }}>{item.icon}</span>
            <span style={{ flex:1 }}>{item.label}</span>
            {item.badge > 0 && <span style={{ background:'var(--pink)', color:'white', fontSize:'0.65rem', fontWeight:800, padding:'2px 7px', borderRadius:99 }}>{item.badge}</span>}
          </NavLink>
        ))}
      </div>

      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.65rem', color:'#8F8FBC', fontWeight:600, textTransform:'uppercase' }}>Hello Pomelo © 2025</span>
        <button onClick={() => setDark(!dark)} style={{ background:'none', border:'none', fontSize:'1rem', cursor:'pointer' }}>{dark?'☀️':'🌙'}</button>
      </div>
    </nav>
  );
}
