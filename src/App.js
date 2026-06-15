import { useState, useEffect } from 'react';
import Login from './components/Login';
import Parts from './components/Parts';
import { setToken, getToken, clearToken, decodeToken } from './utils/auth';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // try to restore a logged user from localStorage
    const token = getToken();
    if (token) {
      const payload = decodeToken(token);
      setUser({ token, email: payload?.username, roles: payload?.roles });
    }
  }, []);

  const handleLoginSuccess = (data, email) => {
    // If the Login passed a token string, store it; otherwise store the data
    if (typeof data === 'string') {
      setToken(data);
      setUser({ email, token: data });
    } else if (data && data.token) {
      setToken(data.token);
      setUser({ email, token: data.token });
    } else {
      // fallback: store the whole response object as token field
      const maybeToken = data?.accessToken || data?.token || null;
      if (maybeToken) {
        setToken(maybeToken);
        setUser({ email, token: maybeToken });
      } else {
        // store whatever was returned
        setUser({ email, data });
      }
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Login onSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Stock Management</h1>
        <div>
          <span style={{ marginRight: 12 }}>Connecté en tant que {user.email}</span>
          <button onClick={logout}>Se déconnecter</button>
        </div>
      </div>

      <Parts isAdmin={user.roles?.includes('ROLE_ADMIN')} />
    </div>
  );
}

export default App;
