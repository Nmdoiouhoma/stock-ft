import { useState } from 'react';
import { API_BASE } from '../utils/auth';
import './Login.css';

function ForgotPassword({ onBack, onSuccess }) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Veuillez renseigner votre email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || data?.error || `Erreur ${res.status}`);
      } else {
        const token = data?.reset_token || data?.resetToken || data?.token;
        if (token) {
          onSuccess(token);
        } else {
          setError('Réponse inattendue du serveur.');
        }
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card" role="main">
        <div className="login-brand">
          <img src="/logo192.png" alt="logo" className="login-logo" />
          <div className="login-title-group">
            <h1>Mot de passe oublié</h1>
            <p className="login-subtitle">Saisissez votre email pour réinitialiser</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="btn-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : 'Envoyer'}
          </button>

          <button type="button" className="forgot back-link" onClick={onBack}>
            ← Retour à la connexion
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
