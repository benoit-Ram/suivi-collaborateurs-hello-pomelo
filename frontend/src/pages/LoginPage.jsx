import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated, isAdmin, GOOGLE_CLIENT_ID, loading } = useAuth();
  const [error, setError] = useState('');
  const [showChoice, setShowChoice] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  // Banner shown when user landed here because their JWT expired mid-session.
  // Read from sessionStorage which is set by api.js on 401, then consumed once.
  const [expiredNotice, setExpiredNotice] = useState(() => {
    const flag = sessionStorage.getItem('hp_auth_expired_notice') === '1';
    if (flag) sessionStorage.removeItem('hp_auth_expired_notice');
    return flag;
  });
  const googleBtnRef = useRef(null);
  // Guard: Google Identity Services warns "initialize() called multiple times"
  // if we call it more than once. We init at most once per page life.
  const googleInitialized = useRef(false);
  const navigate = useNavigate();

  // If already authenticated, redirect
  useEffect(() => {
    if (!loading && !loggingIn && isAuthenticated) {
      if (isAdmin) {
        setShowChoice(true);
      } else {
        navigate('/collab', { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, loading, loggingIn]);

  // Google Sign-In: initialize ONCE, then just re-render the button when
  // the visible state (loading/auth/loggingIn) changes.
  useEffect(() => {
    if (loading || isAuthenticated || loggingIn) return;
    if (!GOOGLE_CLIENT_ID) return;

    const initOrRender = () => {
      if (!window.google?.accounts?.id) return false;
      if (!googleInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });
        googleInitialized.current = true;
      }
      if (googleBtnRef.current) {
        // Clear before re-rendering so we don't stack buttons
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: Math.min(340, window.innerWidth - 100), text: 'signin_with', shape: 'rectangular', locale: 'fr'
        });
      }
      setGoogleReady(true);
      return true;
    };

    if (!initOrRender()) {
      const timer = setTimeout(initOrRender, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated, loggingIn]);

  async function handleGoogleResponse(response) {
    setLoggingIn(true);
    setError('');
    try {
      const result = await login(response.credential);
      if (result.error) {
        setError(result.error);
        setLoggingIn(false);
      } else if (result.user.isAdmin) {
        setLoggingIn(false);
        setShowChoice(true);
      } else {
        // Small delay to let React state settle before navigating
        setTimeout(() => navigate('/collab', { replace: true }), 100);
      }
    } catch (e) {
      setError('Erreur de connexion. Réessayez.');
      setLoggingIn(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F0F0FF 0%, #FFF0F8 100%)' }}>
      <div style={{ textAlign: 'center', color: '#6B6B9A', fontSize: '0.9rem', fontWeight: 600 }}>Chargement...</div>
    </div>
  );

  // Logging in spinner
  if (loggingIn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F0F0FF 0%, #FFF0F8 100%)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #CFD0E5', borderTopColor: '#FF3285', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: '#05056D', fontSize: '0.95rem', fontWeight: 700 }}>Connexion en cours...</div>
      </div>
    </div>
  );

  // Admin choice screen
  if (showChoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: 'linear-gradient(135deg, #F0F0FF 0%, #FFF0F8 100%)' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 'clamp(28px, 5vw, 52px) clamp(20px, 4vw, 48px)', maxWidth: 480, width: '100%', boxShadow: '0 12px 48px rgba(5,5,109,0.12)', textAlign: 'center' }}>
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
      <div style={{ background: 'white', borderRadius: 24, padding: 'clamp(28px, 5vw, 52px) clamp(20px, 4vw, 48px)', maxWidth: 440, width: '100%', boxShadow: '0 12px 48px rgba(5,5,109,0.12)', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: '#0000EA', fontSize: '2.05rem', lineHeight: 1.08, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            Hello<br />Pomelo
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6B6B9A', fontWeight: 600, letterSpacing: '0.06em', marginTop: 10 }}>Suivi Collaborateurs</div>
        </div>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #FF3285, #0000EA, #5BB6F4)', borderRadius: 99, margin: '28px 0' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#05056D', marginBottom: 8 }}>Connexion</h2>
        <p style={{ fontSize: '0.85rem', color: '#6B6B9A', marginBottom: 24, lineHeight: 1.6 }}>
          Connectez-vous avec votre compte Hello Pomelo.
        </p>
        {expiredNotice && (
          <div style={{ background: '#FFF8E6', color: '#854D0E', borderLeft: '4px solid #EAB308', borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem', fontWeight: 600, marginBottom: 20, textAlign: 'left' }}>
            ⏱️ Ta session a expiré. Reconnecte-toi avec Google pour continuer.
          </div>
        )}
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
