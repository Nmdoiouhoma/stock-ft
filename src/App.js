import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Parts from './pages/Parts';
import { setToken, getToken, clearToken, decodeToken } from './utils/auth';

function App() {
  const [user,       setUser]       = useState(null);
  const [activePage, setActivePage] = useState('parts-list');

  useEffect(() => {
    const token = getToken();
    if (token) {
      const payload = decodeToken(token);
      setUser({ token, email: payload?.username, roles: payload?.roles });
    }
  }, []);

  const handleLoginSuccess = (data, email) => {
    if (typeof data === 'string') {
      setToken(data);
      setUser({ email, token: data });
    } else if (data && data.token) {
      setToken(data.token);
      setUser({ email, token: data.token });
    } else {
      const maybeToken = data?.accessToken || data?.token || null;
      if (maybeToken) {
        setToken(maybeToken);
        setUser({ email, token: maybeToken });
      } else {
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

  const isAdmin = user.roles?.includes('ROLE_ADMIN');

  const renderPage = () => {
    switch (activePage) {
      case 'parts-list':
        return <Parts key="parts-list" isAdmin={isAdmin} />;
      case 'parts-add':
        return <Parts key="parts-add" isAdmin={isAdmin} autoOpenAdd onAfterAdd={() => setActivePage('parts-list')} />;
      default:
        return null;
    }
  };

  return (
    <Layout
      activePage={activePage}
      onNavigate={setActivePage}
      user={user}
      onLogout={logout}
    >
      {renderPage()}
    </Layout>
  );
}

export default App;
