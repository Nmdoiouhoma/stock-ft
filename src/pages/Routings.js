import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';
import './Routings.css';

const PAGE_SIZE = 5;

const EMPTY_FORM = {
  reference: '',
  label: '',
  partId: '',
  supervisorId: '',
};

export default function Routings({ isAdmin, isSupervisor, onView }) {
  const { toasts, addToast, removeToast } = useToast();
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [partsList, setPartsList] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/routings');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setRoutings(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadParts = useCallback(async () => {
    try {
      const res = await authFetch('/api/parts');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setPartsList(await res.json());
    } catch (e) {
      // ignore part loading errors for the select; the form will show empty options
      console.error('Erreur chargement pièces', e.message || e);
    }
  }, []);

  useEffect(() => { loadParts(); }, [loadParts]);

  const loadUsers = useCallback(async () => {
    try {
      const url = isAdmin ? '/api/users' : '/api/users/supervisors';
      const res = await authFetch(url);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data['hydra:member'] ?? data.items ?? data.users ?? data.data ?? []);
      setUsersList(list);
    } catch (e) {
      console.error('Erreur chargement utilisateurs', e.message || e);
    }
  }, [isAdmin]);

  useEffect(() => { if (isAdmin || isSupervisor) loadUsers(); }, [isAdmin, isSupervisor, loadUsers]);

  // Listen to global events so other components can notify us when parts/users are added
  useEffect(() => {
    const onPartsAdded = () => { loadParts(); };
    const onUsersAdded = () => { loadUsers(); };
    window.addEventListener('parts:added', onPartsAdded);
    window.addEventListener('users:added', onUsersAdded);
    return () => {
      window.removeEventListener('parts:added', onPartsAdded);
      window.removeEventListener('users:added', onUsersAdded);
    };
  }, [loadParts, loadUsers]);

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); };
  const openEdit = (r) => {
    setForm({
      reference: r.reference || '',
      label: r.label || '',
      partId: r.part?.id ?? '',
      supervisorId: r.supervisor?.id ?? '',
    });
    setEditingId(r.id);
  };
  const closeForm = () => { setForm(null); setEditingId(null); setError(''); };

  // Only allow these part types when creating a routing
  const isPartAllowedForCreate = (p) => {
    if (!p) return false;
    const t = String(p.type ?? p.kind ?? '').toLowerCase();
    return t.includes('finished') || t.includes('intermediate');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    // Validate that selected part and supervisor are available
    const supervisorCandidates = (usersList || []).filter(u => {
      const rolesRaw = u.roles ?? u.userRoles ?? [];
      let rolesArr;
      if (Array.isArray(rolesRaw)) rolesArr = rolesRaw.map(r => String(r || ''));
      else rolesArr = String(rolesRaw || '').split(',').map(s => s.trim()).filter(Boolean);
      rolesArr = rolesArr.map(r => r.replace(/^ROLE_/i, '').toLowerCase());
      return rolesArr.includes('supervisor') || rolesArr.join(',').toLowerCase().includes('supervisor');
    });
    if (!editingId) {
      const allowed = (partsList || []).filter(isPartAllowedForCreate);
      if (allowed.length === 0) {
        setError('Impossible de créer une gamme : aucune pièce de type autorisé (intermediate/finished).');
        setSaving(false);
        return;
      }
    } else if ((partsList || []).length === 0) {
      setError('Impossible de créer/éditer une gamme : aucune pièce disponible.');
      setSaving(false);
      return;
    }
    if (supervisorCandidates.length === 0) {
      setError('Impossible de créer une gamme : aucun superviseur trouvé. Créez un utilisateur avec le rôle superviseur.');
      setSaving(false);
      return;
    }
    const body = {
      reference: form.reference,
      label: form.label,
      partId: form.partId ? parseInt(form.partId, 10) : undefined,
      supervisorId: form.supervisorId ? parseInt(form.supervisorId, 10) : undefined,
    };
    const url = editingId ? `/api/routings/${editingId}` : '/api/routings';
    const method = editingId ? 'PUT' : 'POST';
    try {
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`;
        addToast(msg, 'error');
        return;
      }
      addToast(editingId ? 'Gamme modifiée avec succès' : 'Gamme créée avec succès', 'success');
      closeForm();
      load();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette gamme ?')) return;
    try {
      const res = await authFetch(`/api/routings/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      addToast('Gamme supprimée', 'success');
      load();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return routings;
    return routings.filter(r => (
      String(r.reference || '').toLowerCase().includes(q)
      || String(r.label || '').toLowerCase().includes(q)
      || String(r.part?.reference || '').toLowerCase().includes(q)
      || String(r.supervisor?.firstname || '').toLowerCase().includes(q)
      || String(r.supervisor?.lastname || '').toLowerCase().includes(q)
    ));
  }, [routings, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // compute supervisor candidates once for render
  const supervisorCandidates = (usersList || []).filter(u => {
    const rolesRaw = u.roles ?? u.userRoles ?? [];
    let rolesArr;
    if (Array.isArray(rolesRaw)) rolesArr = rolesRaw.map(r => String(r || ''));
    else rolesArr = String(rolesRaw || '').split(',').map(s => s.trim()).filter(Boolean);
    rolesArr = rolesArr.map(r => r.replace(/^ROLE_/i, '').toLowerCase());
    return rolesArr.includes('supervisor') || rolesArr.join(',').toLowerCase().includes('supervisor');
  });

  return (
    <div className="routings-container">
      <div className="routings-header">
        <div>
          <h2 className="routings-title">Liste des gammes</h2>
          <p className="routings-sub">Consultez et gérez les gammes</p>
        </div>
        {(isAdmin || isSupervisor) && (
          <div>
            <button className="btn-primary" onClick={openCreate}>+ Nouvelle gamme</button>
          </div>
        )}
      </div>

      <div className="controls">
        <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state"><p>Chargement des gammes...</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Pièce associée</th>
                <th>Responsable</th>
                <th>Nb opérations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr className="empty-state"><td colSpan={5}>Aucune gamme trouvée</td></tr>
              )}
              {paginated.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="cell-reference">{r.label || r.reference}</td>
                  <td>{r.part ? `${r.part.reference} — ${r.part.label}` : '—'}</td>
                  <td>{r.supervisor ? `${r.supervisor.firstname} ${r.supervisor.lastname}` : '—'}</td>
                  <td>{r.operations?.length ?? r.operationsCount ?? 0}</td>
                  <td className="cell-actions">
                    <button className="btn-view" onClick={() => onView && onView(r.id)}>Voir</button>
                    {(isAdmin || isSupervisor) && <button className="btn-edit" onClick={() => openEdit(r)}>Modifier</button>}
                    {(isAdmin || isSupervisor) && <button className="btn-delete" onClick={() => handleDelete(r.id)}>Supprimer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="pagination-bottom">
          <button className="btn-nav" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>←</button>
          <div className="pagination-info">Page {page} / {totalPages}</div>
          <button className="btn-nav" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>→</button>
        </div>
      )}

      {form && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{editingId ? 'Modifier la gamme' : 'Nouvelle gamme'}</h3>
            {error && <div className="alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label className="form-field">
                <span className="field-label">Référence *</span>
                <input className="field-input" value={form.reference} required onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Label *</span>
                <input className="field-input" value={form.label} required onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Pièce *</span>
                {partsList.length === 0 && (
                  <div className="alert-error">Aucune pièce disponible — créez une pièce avant de créer une gamme.</div>
                )}
                <select className="field-input" value={form.partId} required onChange={e => setForm(f => ({ ...f, partId: e.target.value }))}>
                  <option value="">-- Sélectionner une pièce --</option>
                  {(editingId ? partsList : partsList.filter(isPartAllowedForCreate)).map(p => (
                    <option key={p.id} value={p.id}>{`${p.reference || ''} — ${p.label || p.reference || ''}`}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Responsable *</span>
                {usersList.length === 0 && (
                  <div className="alert-error">Aucun utilisateur disponible — créez un utilisateur avant de créer une gamme.</div>
                )}
                {/** Filter to users with role ROLE_SUPERVISOR if present, otherwise fallback to all users */}
                <select className="field-input" value={form.supervisorId} required onChange={e => setForm(f => ({ ...f, supervisorId: e.target.value }))}>
                  <option value="">-- Sélectionner un responsable --</option>
                  {supervisorCandidates.map(u => (
                    <option key={u.id} value={u.id}>{`${u.firstname ?? u.username ?? u.email ?? ''} ${u.lastname ? u.lastname : ''}`.trim()}</option>
                  ))}
                </select>
              </label>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving || (editingId ? (partsList || []).length === 0 : (partsList || []).filter(isPartAllowedForCreate).length === 0) || supervisorCandidates.length === 0}>{saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
