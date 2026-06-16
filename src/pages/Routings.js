import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth';
import './Routings.css';

const PAGE_SIZE = 5;

const EMPTY_FORM = {
  reference: '',
  label: '',
  partId: '',
  supervisorId: '',
};

export default function Routings({ isAdmin, onView }) {
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
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
        setError(msg);
        return;
      }
      closeForm();
      load();
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette gamme ?')) return;
    setError('');
    try {
      const res = await authFetch(`/api/routings/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Erreur ${res.status}`);
        return;
      }
      load();
    } catch {
      setError('Impossible de contacter le serveur.');
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

  return (
    <div className="routings-container">
      <div className="routings-header">
        <div>
          <h2 className="routings-title">Liste des gammes</h2>
          <p className="routings-sub">Consultez et gérez les gammes</p>
        </div>
        <div>
          <button className="btn-primary" onClick={openCreate}>+ Nouvelle gamme</button>
        </div>
      </div>

      {error && !form && <div className="alert-error">{error}</div>}

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
                  <td>{r.operationsCount ?? 0}</td>
                  <td className="cell-actions">
                    <button className="btn-view" onClick={() => onView && onView(r.id)}>Voir</button>
                    <button className="btn-edit" onClick={() => openEdit(r)}>Modifier</button>
                    {isAdmin && <button className="btn-delete" onClick={() => handleDelete(r.id)}>Supprimer</button>}
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
                <span className="field-label">ID Pièce *</span>
                <input type="number" className="field-input" value={form.partId} required onChange={e => setForm(f => ({ ...f, partId: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">ID Responsable *</span>
                <input type="number" className="field-input" value={form.supervisorId} required onChange={e => setForm(f => ({ ...f, supervisorId: e.target.value }))} />
              </label>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
