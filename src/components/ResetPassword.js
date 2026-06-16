import { useState } from 'react';
import './Login.css';

function ResetPassword({ token, onBack }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Veuillez renseigner le nouveau mot de passe.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || data?.error || `Erreur ${res.status}`);
      } else {
        setSuccess(true);
        setTimeout(onBack, 2500);
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-root">
        <div className="login-card reset-success" role="main">
          <div className="reset-check">✓</div>
          <h2 className="reset-success-title">Mot de passe modifié</h2>
          <p className="reset-success-sub">Redirection vers la connexion…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root">
      <div className="login-card" role="main">
        <div className="login-brand">
          <img src="/logo192.png" alt="logo" className="login-logo" />
          <div className="login-title-group">
            <h1>Nouveau mot de passe</h1>
            <p className="login-subtitle">Choisissez un nouveau mot de passe sécurisé</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="rp-password">Nouveau mot de passe</label>
            <input
              id="rp-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="rp-confirm">Confirmer le mot de passe</label>
            <input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="btn-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
