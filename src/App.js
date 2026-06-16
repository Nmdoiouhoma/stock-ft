import { useState, useEffect } from 'react';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Layout from './components/Layout';
import Parts from './pages/Parts';
import AdminUsers from './pages/AdminUsers';
import Routings from './pages/Routings';
import RoutingDetail from './pages/RoutingDetail';
import { setToken, getToken, clearToken, decodeToken } from './utils/auth';

function App() {
  const [user,       setUser]       = useState(null);
  const [activePage, setActivePage] = useState('parts-list');
  const [selectedRoutingId, setSelectedRoutingId] = useState(null);
  const [authScreen, setAuthScreen] = useState('login');
  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const payload = decodeToken(token);
      setUser({ token, email: payload?.username, roles: payload?.roles });
    }
  }, []);

  const handleLoginSuccess = (data, email) => {
    const token = typeof data === 'string'
      ? data
      : (data?.token || data?.accessToken || null);

    if (token) {
      setToken(token);
      const payload = decodeToken(token);
      setUser({ token, email: payload?.username || email, roles: payload?.roles });
    } else {
      setUser({ email, data });
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  if (!user) {
    if (authScreen === 'forgot-password') {
      return (
        <ForgotPassword
          onBack={() => setAuthScreen('login')}
          onSuccess={(token) => { setResetToken(token); setAuthScreen('reset-password'); }}
        />
      );
    }
    if (authScreen === 'reset-password') {
      return (
        <ResetPassword
          token={resetToken}
          onBack={() => { setAuthScreen('login'); setResetToken(null); }}
        />
      );
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Login onSuccess={handleLoginSuccess} onForgotPassword={() => setAuthScreen('forgot-password')} />
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
      case 'routings-list':
        return <Routings key="routings-list" isAdmin={isAdmin} onView={(id) => { setSelectedRoutingId(id); setActivePage('routings-detail'); }} />;
      case 'routings-detail':
        return selectedRoutingId ? <RoutingDetail key={`routing-${selectedRoutingId}`} id={selectedRoutingId} onBack={() => setActivePage('routings-list')} /> : null;
      case 'admin-users-list':
        return isAdmin ? <AdminUsers key="admin-users-list" /> : null;
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
