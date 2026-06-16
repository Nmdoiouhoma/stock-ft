import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth';
import './AdminUsers.css';

const ALL_ROLES = ['admin', 'worker', 'customer', 'seller', 'supervisor'];

const ROLE_LABELS = {
  admin:      'Administrateur',
  worker:     'Opérateur',
  customer:   'Client',
  seller:     'Vendeur',
  supervisor: 'Superviseur',
};

// Normalise un utilisateur venant de l'API quel que soit le format des rôles
function normalizeUser(u) {
  const raw = u.roles ?? u.userRoles ?? [];
  let roles;
  if (Array.isArray(raw)) {
    roles = raw.map(r => (typeof r === 'string' ? r : r?.name ?? r?.role ?? String(r)));
  } else if (typeof raw === 'string') {
    roles = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    roles = [];
  }
  // Ensure roles are strings, trimmed and unique
  roles = roles.map(r => String(r).trim()).filter(Boolean);
  roles = Array.from(new Set(roles));
  return { ...u, roles };
}

const EMPTY_FORM = {
  username: '',
  password: '',
  roles: ['worker'],
};

export default function AdminUsers({ onAfterAdd }) {
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [form,      setForm]      = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      // Support tableau brut ou enveloppe Hydra/API Platform
      const list = Array.isArray(data)
        ? data
        : (data['hydra:member'] ?? data.items ?? data.users ?? data.data ?? []);
      setUsers(list.map(normalizeUser));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); };

  const openEdit = (user) => {
    const normalized = normalizeUser(user);
    setForm({
      username: normalized.username ?? normalized.email ?? '',
      password: '',
      roles: normalized.roles.length ? normalized.roles : ['worker'],
    });
    setEditingId(user.id);
  };

  const closeForm = () => { setForm(null); setEditingId(null); setError(''); };

  const toggleRole = (role) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter(r => r !== role)
        : [...f.roles, role],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.roles.length === 0) {
      setError('Sélectionnez au moins un rôle.');
      return;
    }
    setSaving(true);
    setError('');

    const body = {
      username: form.username,
      roles:    form.roles,
      ...(form.password ? { password: form.password } : {}),
    };

    const url    = editingId ? `/api/users/${editingId}` : '/api/users';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res  = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors
          ? data.errors.map(e => e.message).join(', ')
          : data?.error || data?.message || `Erreur ${res.status}`;
        setError(msg);
        return;
      }
      closeForm();
      load();
      if (!editingId && onAfterAdd) onAfterAdd();
      if (!editingId) {
        try { window.dispatchEvent(new CustomEvent('users:added')); } catch (e) { /* ignore */ }
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    setError('');
    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || data?.message || `Erreur ${res.status}`);
        return;
      }
      load();
    } catch {
      setError('Impossible de contacter le serveur.');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      String(u.username ?? u.email ?? '').toLowerCase().includes(q) ||
      (u.roles ?? []).some(r => r.toLowerCase().includes(q))
    );
  }, [users, search]);

  const adminCount = users.filter(u => (u.roles ?? []).includes('admin')).length;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="admin-title">Gestion des utilisateurs</h2>
          <p className="admin-subtitle">Créez, modifiez et supprimez les comptes utilisateurs</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Nouvel utilisateur</button>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-label">Total utilisateurs</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Administrateurs</div>
          <div className="stat-value admin-accent">{adminCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Utilisateurs simples</div>
          <div className="stat-value">{users.length - adminCount}</div>
        </div>
      </div>

      {error && !form && <div className="alert-error">{error}</div>}

      <div className="admin-search-bar">
        <input
          className="search-input"
          placeholder="Rechercher par nom ou rôle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state"><p>Chargement des utilisateurs...</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Nom d'utilisateur</th>
                <th>Rôles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr className="empty-state">
                  <td colSpan={3}>Aucun utilisateur trouvé</td>
                </tr>
              )}
              {filteredUsers.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="cell-username">{u.username ?? u.email ?? '—'}</td>
                  <td>
                    <div className="role-badges">
                      {(u.roles ?? []).map(r => (
                        <span key={r} className={`role-badge role-${r.replace('ROLE_', '').toLowerCase()}`}>
                          {ROLE_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="cell-actions">
                    <button className="btn-edit" onClick={() => openEdit(u)}>Modifier</button>
                    <button className="btn-delete" onClick={() => handleDelete(u.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              {editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h3>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label className="form-field">
                <span className="field-label">Nom d'utilisateur *</span>
                <input
                  type="text"
                  className="field-input"
                  value={form.username}
                  required
                  autoComplete="off"
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              </label>

              <label className="form-field">
                <span className="field-label">
                  {editingId ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
                </span>
                <input
                  type="password"
                  className="field-input"
                  value={form.password}
                  required={!editingId}
                  autoComplete="new-password"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </label>

              <div className="form-field">
                <span className="field-label">Rôles *</span>
                <div className="role-checkboxes">
                  {ALL_ROLES.map(role => (
                    <label key={role} className="role-checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      <span>{ROLE_LABELS[role] ?? role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
