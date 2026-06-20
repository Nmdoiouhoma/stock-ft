import { useState, useEffect } from 'react';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Layout from './components/Layout';
import Parts from './pages/Parts';
import AdminUsers from './pages/AdminUsers';
import Routings from './pages/Routings';
import RoutingDetail from './pages/RoutingDetail';
import Workstations from './pages/Workstations';
import WorkstationDetail from './pages/WorkstationDetail';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import { setToken, getToken, clearToken, decodeToken } from './utils/auth';

function App() {
  const [user,       setUser]       = useState(null);
  const [activePage, setActivePage] = useState('parts-list');
  const [selectedRoutingId, setSelectedRoutingId] = useState(null);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState(null);
  const [selectedMachineId,     setSelectedMachineId]     = useState(null);
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

  // roles are normalized by decodeToken to lowercase short names (e.g. 'admin')
  const isAdmin      = user.roles?.includes('admin');
  const isSupervisor = user.roles?.includes('supervisor');
  // supervisors can view everything but cannot perform admin actions
  const canAdmin     = isAdmin && !isSupervisor;

  const renderPage = () => {
    switch (activePage) {
      case 'parts-list':
        return <Parts key="parts-list" isAdmin={canAdmin} />;
      case 'parts-add':
        return <Parts key="parts-add" isAdmin={canAdmin} autoOpenAdd onAfterAdd={() => setActivePage('parts-list')} />;
      case 'routings-list':
        return <Routings key="routings-list" isAdmin={canAdmin} isSupervisor={isSupervisor} onView={(id) => { setSelectedRoutingId(id); setActivePage('routings-detail'); }} />;
      case 'routings-detail':
        return selectedRoutingId ? <RoutingDetail key={`routing-${selectedRoutingId}`} id={selectedRoutingId} isAdmin={canAdmin} isSupervisor={isSupervisor} onBack={() => setActivePage('routings-list')} /> : null;
      case 'workstations-list':
        return <Workstations key="workstations-list" isAdmin={canAdmin} onView={(id) => { setSelectedWorkstationId(id); setActivePage('workstations-detail'); }} />;
      case 'workstations-detail':
        return selectedWorkstationId ? <WorkstationDetail key={`workstation-${selectedWorkstationId}`} id={selectedWorkstationId} isAdmin={canAdmin} onBack={() => setActivePage('workstations-list')} /> : null;
      case 'machines-list':
        return <Machines key="machines-list" isAdmin={canAdmin} onView={(id) => { setSelectedMachineId(id); setActivePage('machines-detail'); }} />;
      case 'machines-detail':
        return selectedMachineId ? <MachineDetail key={`machine-${selectedMachineId}`} id={selectedMachineId} onBack={() => setActivePage('machines-list')} /> : null;
      case 'admin-users-list':
        return canAdmin ? <AdminUsers key="admin-users-list" /> : null;
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
