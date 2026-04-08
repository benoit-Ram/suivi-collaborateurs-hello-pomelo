import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { fmtDate, moisLabel } from '../../components/UI';
import { generateGuideCollab } from '../../components/GuidePDF';

/** Compute relative time label in French */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff/86400)}j`;
  return fmtDate(dateStr.split('T')[0]);
}

/** Compute notifications from collab data */
function computeNotifications(data, collabId) {
  if (!data || !collabId) return [];
  const notifs = [];
  const lastSeen = localStorage.getItem('hp_notif_seen_' + collabId) || '2000-01-01T00:00:00';

  // Congés approuvés/refusés
  (data.absences || []).forEach(a => {
    if (a.approved_at && a.approved_at > lastSeen) {
      if (a.statut === 'approuve') {
        notifs.push({ id: 'abs-a-'+a.id, icon: '✅', text: `Congé approuvé${a.approved_by ? ' par '+a.approved_by : ''}`, date: a.approved_at, tab: 'conges', isNew: true });
      } else if (a.statut === 'refuse') {
        notifs.push({ id: 'abs-r-'+a.id, icon: '❌', text: `Congé refusé${a.motif_refus ? ' : '+a.motif_refus.substring(0,50) : ''}`, date: a.approved_at, tab: 'conges', isNew: true });
      }
    }
  });

  // Entretien à remplir (mois courant)
  const now = new Date();
  const cm = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const currentPoint = (data.points || []).find(p => p.mois === cm);
  if (currentPoint) {
    const cd = currentPoint.collab_data || {};
    const hasCollab = Object.keys(cd).some(k => cd[k] && String(cd[k]).trim());
    if (!hasCollab) {
      notifs.push({ id: 'point-'+cm, icon: '📋', text: `Entretien RH de ${moisLabel(cm)} à remplir`, date: now.toISOString(), tab: 'points', isNew: false });
    }
  }

  // Objectifs modifiés récemment
  (data.objectifs || []).forEach(o => {
    (o.historique || []).forEach((h, idx) => {
      if (h.date && h.date + 'T23:59:59' > lastSeen && h.auteur) {
        const change = (h.changes||[]).map(c => c.champ).join(', ');
        notifs.push({ id: 'obj-'+o.id+'-'+idx, icon: '🎯', text: `Objectif "${o.titre}" modifié par ${h.auteur} (${change})`, date: h.date+'T12:00:00', tab: 'objectifs', isNew: true });
      }
    });
  });

  // Solde faible
  if (typeof data.solde === 'number' && data.solde < 3 && data.solde >= 0) {
    notifs.push({ id: 'solde-low', icon: '⚠️', text: `Solde de congés faible : ${data.solde.toFixed(1)}j restants`, date: now.toISOString(), tab: 'conges', isNew: false });
  }

  // Congés équipe en attente (manager)
  if ((data.teamPendingAbs || []).length > 0) {
    notifs.push({ id: 'team-pending', icon: '🔔', text: `${data.teamPendingAbs.length} demande${data.teamPendingAbs.length>1?'s':''} de congés en attente dans votre équipe`, date: now.toISOString(), tab: 'management', isNew: false });
  }

  return notifs.sort((a,b) => new Date(b.date) - new Date(a.date));
}

export default function CollabLayout() {
  const { user, logout, isAdmin, collabs } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notifs, setNotifs] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);

  // Impersonate mode
  const impersonateId = searchParams.get('impersonate');
  const impersonatedCollab = impersonateId ? (collabs || []).find(c => c.id === impersonateId) : null;
  const displayUser = impersonatedCollab
    ? { name: `${impersonatedCollab.prenom} ${impersonatedCollab.nom}`, picture: impersonatedCollab.photo_url }
    : user;
  const activeCollabId = impersonateId || user?.collabId;

  // Listen for data updates from CollabAccueil
  useEffect(() => {
    const handler = () => {
      const data = window.__collabNotifData;
      if (data) setNotifs(computeNotifications(data, data.collabId));
    };
    window.addEventListener('collab-data-update', handler);
    handler(); // compute on mount
    return () => window.removeEventListener('collab-data-update', handler);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const newCount = notifs.filter(n => n.isNew).length;
  const totalCount = notifs.length;

  const markAllRead = () => {
    if (activeCollabId) localStorage.setItem('hp_notif_seen_' + activeCollabId, new Date().toISOString());
    setNotifs(notifs.map(n => ({ ...n, isNew: false })));
  };

  const handleNotifClick = (notif) => {
    setShowPanel(false);
    // Navigate to the relevant tab by dispatching an event
    if (notif.tab && window.__collabSetTab) window.__collabSetTab(notif.tab);
  };

  return (
    <div>
      <header style={{
        background: '#05056D', padding: '0 clamp(16px, 3vw, 32px)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div onClick={() => { navigate('/collab'); window.dispatchEvent(new Event('collab-go-home')); }} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}>
          <img src="/logo.png" alt="Hello Pomelo" style={{ height: 32, width: 32, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          <span className="hide-mobile" style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Hello Pomelo</span>
          <span style={{ background: 'rgba(255,50,133,0.25)', color: '#FF3285', fontSize: '0.6rem', fontWeight: 700, padding: '3px 6px', borderRadius: 6, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {impersonatedCollab ? 'Vue collab' : 'Mon espace'}
          </span>
        </div>
        {displayUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {isAdmin && (
              <button onClick={() => navigate('/admin')}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                🛠️ Admin
              </button>
            )}
            {/* Guide PDF */}
            <button onClick={generateGuideCollab} title="Guide utilisateur" aria-label="Guide utilisateur"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
              📖
            </button>
            {/* Notification bell */}
            <div ref={panelRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowPanel(!showPanel)} aria-label="Notifications"
                style={{ position: 'relative', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0, transition: 'all 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                🔔
                {newCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: '#FF3285', color: 'white', width: 18, height: 18, borderRadius: '50%', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(255,50,133,0.4)' }}>{newCount > 9 ? '9+' : newCount}</span>}
              </button>
              {/* Notification panel */}
              {showPanel && (
                <div style={{
                  position: 'absolute', top: 40, right: 0, width: 'min(380px, 90vw)',
                  background: 'white', borderRadius: 16, boxShadow: '0 12px 48px rgba(5,5,109,0.2)',
                  zIndex: 200, overflow: 'hidden', animation: 'fadeIn 0.15s ease'
                }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #CFD0E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#05056D', fontSize: '0.9rem' }}>Notifications {totalCount > 0 && `(${totalCount})`}</span>
                    {newCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#FF3285', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Tout marquer comme lu</button>}
                  </div>
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: '32px 18px', textAlign: 'center', color: '#6B6B9A', fontSize: '0.85rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>🔔</div>
                        Aucune notification
                      </div>
                    ) : notifs.map(n => (
                      <div key={n.id} onClick={() => handleNotifClick(n)}
                        style={{
                          padding: '12px 18px', borderBottom: '1px solid #F0F0F8', cursor: 'pointer',
                          background: n.isNew ? '#F0F0FF' : 'white', transition: 'background 0.15s',
                          display: 'flex', gap: 10, alignItems: 'flex-start'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = n.isNew ? '#E8E8FF' : '#F8F7FC'}
                        onMouseOut={e => e.currentTarget.style.background = n.isNew ? '#F0F0FF' : 'white'}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: n.isNew ? 700 : 600, color: '#05056D', lineHeight: 1.4 }}>{n.text}</div>
                          <div style={{ fontSize: '0.68rem', color: '#8F8FBC', marginTop: 2 }}>{timeAgo(n.date)}</div>
                        </div>
                        {n.isNew && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3285', flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {displayUser.picture ? (
              <img src={displayUser.picture} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3285, #0000EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                {(displayUser.name || '').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <span className="hide-mobile" style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{displayUser.name}</span>
            {!impersonatedCollab && (
              <button onClick={() => { logout(); navigate('/'); }} aria-label="Déconnexion" title="Déconnexion"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,50,133,0.3)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                ↩
              </button>
            )}
          </div>
        )}
      </header>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(16px, 3vw, 36px) clamp(12px, 3vw, 24px)' }}>
        <Outlet />
      </div>
    </div>
  );
}
