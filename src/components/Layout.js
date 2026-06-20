import { useState } from 'react';
import './Layout.css';

function buildNavTree(isAdmin) {
  const tree = [
    {
      id: 'atelier',
      label: 'Atelier',
      children: [
        { id: 'parts-list',    label: 'Pièces' },
        { id: 'routings-list',      label: 'Gammes' },
        { id: 'workstations-list', label: 'Postes de travail' },
      ],
    },
  ];

  if (isAdmin) {
    tree.push({
      id: 'administration',
      label: 'Administration',
      adminOnly: true,
      children: [
        {
          id: 'admin-users',
          label: 'Utilisateurs',
          children: [
            { id: 'admin-users-list', label: 'Liste des utilisateurs' },
          ],
        },
      ],
    });
  }

  return tree;
}

export default function Layout({ activePage, onNavigate, user, onLogout, children }) {
  const isAdmin = user.roles?.includes('ROLE_ADMIN');
  const navTree = buildNavTree(isAdmin);

  const [open, setOpen] = useState({ atelier: true, pieces: true, administration: true, 'admin-users': true });

  const toggle = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="layout">
      <header className="layout-header">
        <span className="layout-title">Stock Management</span>
        <div className="layout-user">
          <span className="layout-user-email">{user.email}</span>
          <button className="layout-logout-btn" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="layout-body">
        <aside className="layout-sidebar">
          <nav>
            {navTree.map(section => (
              <div key={section.id} className="nav-section">
                <button
                  className={`nav-section-btn${section.adminOnly ? ' nav-section-admin' : ''}`}
                  onClick={() => toggle(section.id)}
                >
                  <span className={`nav-chevron ${open[section.id] ? 'open' : ''}`}>›</span>
                  {section.label}
                  {section.adminOnly && <span className="nav-admin-badge">Admin</span>}
                </button>

                {open[section.id] && section.children?.map(child => (
                  child.children ? (
                    <div key={child.id} className="nav-subsection">
                      <button className="nav-sub-btn" onClick={() => toggle(child.id)}>
                        <span className={`nav-chevron ${open[child.id] ? 'open' : ''}`}>›</span>
                        {child.label}
                      </button>
                      {open[child.id] && child.children.map(item => (
                        <button
                          key={item.id}
                          className={`nav-item${activePage === item.id ? ' active' : ''}`}
                          onClick={() => onNavigate(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      key={child.id}
                      className={`nav-item${activePage === child.id ? ' active' : ''}`}
                      onClick={() => onNavigate(child.id)}
                    >
                      {child.label}
                    </button>
                  )
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="layout-main">
          {children}
        </main>
      </div>
    </div>
  );
}
