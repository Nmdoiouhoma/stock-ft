import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth';
import './AdminUsers.css';
import '../components/Parts.css';

const ALL_ROLES = ['admin', 'worker', 'customer', 'seller', 'supervisor'];

const ROLE_LABELS = {
  admin:      'Administrateur',
  worker:     'Opérateur',
  customer:   'Client',
  seller:     'Vendeur',
  supervisor: 'Superviseur',
};

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
  roles = roles.map(r => String(r).trim()).filter(Boolean)
    .map(r => r.replace(/^ROLE_/i, '').toLowerCase());
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

  // Workstation association modal
  const [wsModal,    setWsModal]    = useState(null);
  const [wsDetails,  setWsDetails]  = useState([]);
  const [loadingWs,  setLoadingWs]  = useState(false);
  const [wsSelectId, setWsSelectId] = useState('');
  const [wsSaving,   setWsSaving]   = useState(false);
  const [wsError,    setWsError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
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

  // ── User form ────────────────────────────────────────────────────────────
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

  // ── Workstation modal ────────────────────────────────────────────────────
  const fetchWsDetails = async () => {
    const listRes = await authFetch('/api/workstations');
    if (!listRes.ok) throw new Error(`Erreur ${listRes.status}`);
    const listJson = await listRes.json();
    const list = Array.isArray(listJson)
      ? listJson
      : (listJson['hydra:member'] ?? listJson.items ?? listJson.data ?? []);
    const details = await Promise.all(
      list.map(ws =>
        authFetch(`/api/workstations/${ws.id}`).then(r => r.ok ? r.json() : null)
      )
    );
    return details.filter(Boolean);
  };

  const openWsModal = async (user) => {
    const userName = `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim()
      || user.username || user.email || `#${user.id}`;
    setWsModal({ userId: user.id, userName });
    setWsSelectId('');
    setWsError('');
    setLoadingWs(true);
    try {
      setWsDetails(await fetchWsDetails());
    } catch (e) {
      setWsError(e.message || 'Impossible de charger les postes de travail');
    } finally {
      setLoadingWs(false);
    }
  };

  const closeWsModal = () => { setWsModal(null); setWsError(''); setWsDetails([]); };

  const reloadWsDetails = async () => {
    try { setWsDetails(await fetchWsDetails()); } catch { /* ignore */ }
  };

  const handleAddWs = async (e) => {
    e.preventDefault();
    if (!wsSelectId || !wsModal) return;
    setWsSaving(true); setWsError('');
    try {
      const res = await authFetch(
        `/api/workstations/${wsSelectId}/users/${wsModal.userId}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      setWsSelectId('');
      await reloadWsDetails();
    } catch (e) {
      setWsError(e.message || "Erreur lors de l'association");
    } finally {
      setWsSaving(false);
    }
  };

  const handleRemoveWs = async (wsId) => {
    if (!wsModal) return;
    if (!window.confirm('Retirer la qualification sur ce poste de travail ?')) return;
    setWsError('');
    try {
      const res = await authFetch(
        `/api/workstations/${wsId}/users/${wsModal.userId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      await reloadWsDetails();
    } catch (e) {
      setWsError(e.message || 'Erreur lors du retrait');
    }
  };

  const userWs = useMemo(() => {
    if (!wsModal) return [];
    return wsDetails.filter(ws =>
      (ws.qualifiedUsers || []).some(u => u.id === wsModal.userId)
    );
  }, [wsDetails, wsModal]);

  const availableWs = useMemo(() => {
    if (!wsModal) return [];
    return wsDetails.filter(ws =>
      !(ws.qualifiedUsers || []).some(u => u.id === wsModal.userId)
    );
  }, [wsDetails, wsModal]);

  // ── List filter ──────────────────────────────────────────────────────────
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
                        <span key={r} className={`role-badge role-${String(r).toLowerCase()}`}>
                          {ROLE_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn-view" onClick={() => openWsModal(u)}>Postes</button>
                      <button className="btn-edit" onClick={() => openEdit(u)}>Modifier</button>
                      <button className="btn-delete" onClick={() => handleDelete(u.id)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── User create/edit modal ── */}
      {form && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              {editingId ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
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

      {/* ── Workstation association modal ── */}
      {wsModal && (
        <div className="modal-overlay" onClick={closeWsModal}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Postes de travail — {wsModal.userName}</h3>

            {wsError && <div className="alert-error">{wsError}</div>}

            {loadingWs ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>Chargement des postes...</p>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <p className="field-label" style={{ marginBottom: 8 }}>
                    Postes qualifiés
                    <span className="count-badge" style={{ marginLeft: 8 }}>{userWs.length}</span>
                  </p>
                  {userWs.length === 0 ? (
                    <div className="empty-block" style={{ padding: '12px 16px', fontSize: 13 }}>
                      Aucun poste qualifié
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="parts-table">
                        <thead>
                          <tr>
                            <th>Référence</th>
                            <th>Désignation</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {userWs.map(ws => (
                            <tr key={ws.id}>
                              <td className="cell-reference">{ws.reference ?? '—'}</td>
                              <td>{ws.label ?? '—'}</td>
                              <td>
                                <button className="btn-delete" onClick={() => handleRemoveWs(ws.id)}>
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddWs}>
                  <label className="form-field">
                    <span className="field-label">Qualifier sur un poste</span>
                    {availableWs.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
                        Tous les postes sont déjà associés à cet utilisateur.
                      </p>
                    ) : (
                      <select
                        className="field-input"
                        value={wsSelectId}
                        onChange={e => setWsSelectId(e.target.value)}
                        required
                      >
                        <option value="">— Sélectionner un poste —</option>
                        {availableWs.map(ws => (
                          <option key={ws.id} value={ws.id}>
                            {ws.reference ? `[${ws.reference}] ` : ''}{ws.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeWsModal}>
                      Fermer
                    </button>
                    {availableWs.length > 0 && (
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={wsSaving || !wsSelectId}
                      >
                        {wsSaving ? 'Association...' : 'Qualifier'}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
