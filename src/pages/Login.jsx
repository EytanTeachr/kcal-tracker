import { useState } from 'react';
import { supabase } from '../utils/supabase';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        // If email confirmation is disabled, user is logged in immediately
        if (data.session) {
          if (!stayLoggedIn) {
            // Mark session as "don't persist" — we'll clear on tab close
            sessionStorage.setItem('kcal_session_only', 'true');
          }
          onAuth(data.session.user);
        } else {
          setError('Un email de confirmation a été envoyé. Vérifie ta boîte mail puis connecte-toi.');
          setMode('login');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        if (!stayLoggedIn) {
          sessionStorage.setItem('kcal_session_only', 'true');
        } else {
          sessionStorage.removeItem('kcal_session_only');
        }

        onAuth(data.session.user);
      }
    } catch (err) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (err.message?.includes('already registered')) {
        setError('Cet email est déjà utilisé. Connecte-toi !');
        setMode('login');
      } else if (err.message?.includes('Password should be')) {
        setError('Le mot de passe doit faire au moins 6 caractères.');
      } else {
        setError(err.message || 'Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="login-header">
          <h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="hint">
            {mode === 'login'
              ? 'Connecte-toi pour retrouver tes données'
              : 'Crée ton compte pour sauvegarder tes données'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? '6 caractères minimum' : 'Ton mot de passe'}
              required
              minLength={6}
            />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
            />
            <span>Rester connecté</span>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading
              ? 'Chargement...'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <p>
              Pas encore de compte ?{' '}
              <button className="link-btn" onClick={() => { setMode('signup'); setError(null); }}>
                Créer un compte
              </button>
            </p>
          ) : (
            <p>
              Déjà un compte ?{' '}
              <button className="link-btn" onClick={() => { setMode('login'); setError(null); }}>
                Se connecter
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
