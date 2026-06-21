import { useState } from 'react';
import './Login.css';

function Login({ apiUrl = '/api/login', onSuccess, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError("Veuillez renseigner l'email et le mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.message || data?.error || `Erreur ${res.status}`;
        setError(String(message));
      } else {
        const token = data?.token || data?.accessToken || null;
        if (token) {
          if (onSuccess) onSuccess(token, email, { remember });
        } else {
          if (onSuccess) onSuccess(data, email, { remember });
        }
      }
    } catch (err) {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card" role="main" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/logo192.png" alt="logo" className="login-logo" />
          <div className="login-title-group">
            <h1 id="login-title">Ping Pong Stock</h1>
            <p className="login-subtitle">Accédez à votre espace de gestion</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="controls">
              <label className="remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Se souvenir de moi
              </label>
              <button type="button" className="forgot" onClick={onForgotPassword}>Mot de passe oublié ?</button>
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="btn-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : 'Se connecter'}
          </button>
        </form>

  {/* footer removed as requested */}
      </div>
    </div>
  );
}

export default Login;
