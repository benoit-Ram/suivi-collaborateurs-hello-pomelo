import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated, isAdmin, GOOGLE_CLIENT_ID, loading } = useAuth();
  const [error, setError] = useState('');
  const [showChoice, setShowChoice] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);
  const navigate = useNavigate();

  // If already authenticated, redirect
  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (isAdmin) {
        setShowChoice(true);
      } else {
        navigate('/collab', { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, loading]);

  // Google Sign-In init
  useEffect(() => {
    if (loading || isAuthenticated) return;
    if (!GOOGLE_CLIENT_ID) return;

    // Wait for Google script to load (may be delayed or blocked)
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline', size: 'large', width: 340, text: 'signin_with', shape: 'rectangular', locale: 'fr'
          });
        }
        setGoogleReady(true);
      }
    };

    initGoogle();
    if (!window.google?.accounts?.id) {
      // Retry after script loads
      const timer = setTimeout(initGoogle, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated]);

  async function handleGoogleResponse(response) {
    // Send raw Google credential to backend for server-side verification
    const result = await login(response.credential);
    if (result.error) {
      setError(result.error);
    } else if (result.user.isAdmin) {
      setShowChoice(true);
    } else {
      navigate('/collab', { replace: true });
    }
  }

  if (loading) return null;

  // Admin choice screen
  if (showChoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: 'linear-gradient(135deg, #F0F0FF 0%, #FFF0F8 100%)' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: '52px 48px', maxWidth: 480, width: '100%', boxShadow: '0 12px 48px rgba(5,5,109,0.12)', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: '#0000EA', fontSize: '1.8rem', lineHeight: 1.08, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8 }}>
            Hello Pomelo
          </div>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #FF3285, #0000EA, #5BB6F4)', borderRadius: 99, margin: '24px 0' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#05056D', marginBottom: 24 }}>Choisir votre espace</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => navigate('/admin', { replace: true })}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderRadius: 14, border: '2px solid #CFD0E5', background: 'white', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#FF3285'; e.currentTarget.style.background = '#FFF0F6'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#CFD0E5'; e.currentTarget.style.background = 'white'; }}>
              <span style={{ fontSize: '1.8rem' }}>🛠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#05056D' }}>Espace Administration</div>
                <div style={{ fontSize: '0.8rem', color: '#6B6B9A', marginTop: 2 }}>Gérer les collaborateurs, objectifs, congés...</div>
              </div>
            </button>
            <button onClick={() => navigate('/collab', { replace: true })}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderRadius: 14, border: '2px solid #CFD0E5', background: 'white', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#5BB6F4'; e.currentTarget.style.background = '#F0F8FF'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#CFD0E5'; e.currentTarget.style.background = 'white'; }}>
              <span style={{ fontSize: '1.8rem' }}>👤</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#05056D' }}>Mon Espace Collaborateur</div>
                <div style={{ fontSize: '0.8rem', color: '#6B6B9A', marginTop: 2 }}>Mes objectifs, entretiens, congés...</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: 'linear-gradient(135deg, #F0F0FF 0%, #FFF0F8 100%)' }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '52px 48px', maxWidth: 440, width: '100%', boxShadow: '0 12px 48px rgba(5,5,109,0.12)', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: '#0000EA', fontSize: '2.05rem', lineHeight: 1.08, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            Hello<br />Pomelo
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6B6B9A', fontWeight: 600, letterSpacing: '0.06em', marginTop: 10 }}>Suivi Collaborateurs</div>
        </div>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #FF3285, #0000EA, #5BB6F4)', borderRadius: 99, margin: '28px 0' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#05056D', marginBottom: 8 }}>Connexion</h2>
        <p style={{ fontSize: '0.85rem', color: '#6B6B9A', marginBottom: 32, lineHeight: 1.6 }}>
          Connectez-vous avec votre compte Hello Pomelo.
        </p>
        {GOOGLE_CLIENT_ID ? (
          <>
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
            {!googleReady && <p style={{ color: '#6B6B9A', fontSize: '0.82rem', marginTop: 12 }}>Chargement de Google Sign-In... Si le bouton n'apparait pas, verifiez que votre navigateur n'a pas bloque le script.</p>}
          </>
        ) : (
          <p style={{ color: '#6B6B9A', fontSize: '0.85rem' }}>Google Sign-In non configure.</p>
        )}
        {error && (
          <div style={{ background: '#FFF1F2', color: '#881337', borderLeft: '4px solid #F43F5E', borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem', fontWeight: 600, marginTop: 16, textAlign: 'left' }}>
            {error}
          </div>
        )}
        <p style={{ fontSize: '0.72rem', color: '#CFD0E5', marginTop: 20, fontWeight: 600, letterSpacing: '0.04em' }}>
          Utilisez votre email @hello-pomelo.com
        </p>
      </div>
    </div>
  );
}
