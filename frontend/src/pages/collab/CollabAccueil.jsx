import React from 'react';

export default function CollabAccueil() {
  return (
    <div>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Bonjour 👋</h2>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Votre espace collaborateur est en cours de migration vers React.</p>
      <div className="divider" />
      <div className="stats-grid stats-grid--3">
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--pink)' }}>—</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Objectifs en cours</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green)' }}>—</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Atteints</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>—</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Congés restants</div>
        </div>
      </div>
    </div>
  );
}
