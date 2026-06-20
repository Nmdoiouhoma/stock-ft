import { useState } from 'react';
import './Layout.css';

const ICONS = {
  parts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <polyline points="3.29 7 12 12 20.71 7"/>
      <line x1="12" y1="22" x2="12" y2="12"/>
    </svg>
  ),
  routings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="2"/>
      <circle cx="18" cy="6" r="2"/>
      <circle cx="6" cy="6" r="2"/>
      <path d="M6 8v8M8 6h6a4 4 0 0 1 4 4v2"/>
    </svg>
  ),
  workstations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  machines: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'user-list': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3" cy="6" r="1" fill="currentColor"/>
      <circle cx="3" cy="12" r="1" fill="currentColor"/>
      <circle cx="3" cy="18" r="1" fill="currentColor"/>
    </svg>
  ),
};

function buildNavTree(isAdmin) {
  const tree = [
    {
      id: 'atelier',
      label: 'Atelier',
      children: [
        { id: 'parts-list',        label: 'Pièces',            icon: 'parts' },
        { id: 'routings-list',     label: 'Gammes',            icon: 'routings' },
        { id: 'workstations-list', label: 'Postes de travail', icon: 'workstations' },
        { id: 'machines-list',     label: 'Machines',          icon: 'machines' },
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
          icon: 'users',
          children: [
            { id: 'admin-users-list', label: 'Liste des utilisateurs', icon: 'user-list' },
          ],
        },
      ],
    });
  }

  return tree;
}

export default function Layout({ activePage, onNavigate, user, onLogout, children }) {
  const isAdmin = user.roles?.includes('admin');
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
                        <span className="nav-icon">{ICONS[child.icon]}</span>
                        {child.label}
                      </button>
                      {open[child.id] && child.children.map(item => (
                        <button
                          key={item.id}
                          className={`nav-item nav-item-nested${activePage === item.id ? ' active' : ''}`}
                          onClick={() => onNavigate(item.id)}
                        >
                          <span className="nav-icon">{ICONS[item.icon]}</span>
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
                      <span className="nav-icon">{ICONS[child.icon]}</span>
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
