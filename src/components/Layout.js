import { useState } from 'react';
import './Layout.css';

const NAV_TREE = [
  {
    id: 'atelier',
    label: 'Atelier',
    children: [
      {
        id: 'pieces',
        label: 'Pièces',
        children: [
          { id: 'parts-list', label: 'Liste des pièces' },
          { id: 'parts-add',  label: 'Ajouter une pièce' },
        ],
      },
    ],
  },
];

export default function Layout({ activePage, onNavigate, user, onLogout, children }) {
  const [open, setOpen] = useState({ atelier: true, pieces: true });

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
            {NAV_TREE.map(section => (
              <div key={section.id} className="nav-section">
                <button
                  className="nav-section-btn"
                  onClick={() => toggle(section.id)}
                >
                  <span className={`nav-chevron ${open[section.id] ? 'open' : ''}`}>›</span>
                  {section.label}
                </button>

                {open[section.id] && section.children?.map(sub => (
                  <div key={sub.id} className="nav-subsection">
                    <button
                      className="nav-sub-btn"
                      onClick={() => toggle(sub.id)}
                    >
                      <span className={`nav-chevron ${open[sub.id] ? 'open' : ''}`}>›</span>
                      {sub.label}
                    </button>

                    {open[sub.id] && sub.children?.map(item => (
                      <button
                        key={item.id}
                        className={`nav-item${activePage === item.id ? ' active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
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
