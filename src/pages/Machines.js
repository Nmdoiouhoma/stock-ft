import { useState, useEffect, useCallback, useMemo } from 'react';
import '../components/Parts.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const EMPTY_FORM = {
  reference:   '',
  label:       '',
  description: '',
};

function Machines({ isAdmin, onView }) {
  const [machines,  setMachines]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('label');
  const [sortDir, setSortDir] = useState('asc');
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 5;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/machines');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setMachines(Array.isArray(json) ? json : (json['hydra:member'] ?? json.items ?? json.data ?? []));
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); };

  const openEdit = (m) => {
    setForm({
      reference:   m.reference ?? '',
      label:       m.label ?? '',
      description: m.description ?? '',
    });
    setEditingId(m.id);
  };

  const closeForm = () => { setForm(null); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const body = {
      reference:   form.reference !== '' ? form.reference : null,
      label:       form.label,
      description: form.description !== '' ? form.description : null,
    };

    const url    = editingId ? `/api/machines/${editingId}` : '/api/machines';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res  = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors
          ? data.errors.map(e => e.message).join(', ')
          : data?.error || `Erreur ${res.status}`;
        addToast(msg, 'error');
        return;
      }
      addToast(editingId ? 'Machine modifiée avec succès' : 'Machine créée avec succès', 'success');
      closeForm();
      load();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette machine ?')) return;
    try {
      const res = await authFetch(`/api/machines/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      addToast('Machine supprimée', 'success');
      load();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let arr = machines.slice();
    if (q) {
      arr = arr.filter(m =>
        String(m.label       || '').toLowerCase().includes(q) ||
        String(m.description || '').toLowerCase().includes(q)
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = String(a[sortBy] ?? '').toLowerCase();
      const vb = String(b[sortBy] ?? '').toLowerCase();
      return va.localeCompare(vb) * dir;
    });
    return arr;
  }, [machines, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="parts-container">
      <div className="parts-header">
        <div>
          <h2 className="parts-title">Machines</h2>
          <p className="parts-subtitle">Consultez et gérez les machines</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openCreate}>+ Nouvelle machine</button>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-label">Total machines</div>
          <div className="dashboard-value">{machines.length}</div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="controls-section">
        <div className="search-sort-bar">
          <input
            className="search-input"
            placeholder="Rechercher par désignation ou description..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="label">Désignation</option>
            <option value="description">Description</option>
          </select>
          <select className="sort-select" value={sortDir} onChange={e => setSortDir(e.target.value)}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Chargement des machines...</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Référence</th>
                <th>Désignation</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr className="empty-state">
                  <td colSpan={5}>Aucune machine trouvée</td>
                </tr>
              )}
              {paginated.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="cell-reference">{m.id}</td>
                  <td className="cell-reference">{m.reference ?? '—'}</td>
                  <td>{m.label}</td>
                  <td className={m.description ? '' : 'cell-empty'}>{m.description ?? '—'}</td>
                  <td className="cell-actions">
                    <button className="btn-view" onClick={() => onView ? onView(m.id) : null}>Voir</button>
                    {isAdmin && (
                      <>
                        <button className="btn-edit" onClick={() => openEdit(m)}>Modifier</button>
                        <button className="btn-delete" onClick={() => handleDelete(m.id)}>Supprimer</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="pagination-bottom">
          <button className="btn-nav" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Précédent
          </button>
          <div className="pagination-info">Page {page} / {totalPages}</div>
          <button className="btn-nav" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Suivant →
          </button>
        </div>
      )}

      {form && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{editingId ? 'Modifier la machine' : 'Nouvelle machine'}</h3>

            <form onSubmit={handleSubmit}>
              <Field label="Référence">
                <input
                  type="text"
                  value={form.reference}
                  maxLength={100}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="field-input"
                  placeholder="ex. MCH-001"
                />
              </Field>

              <Field label="Désignation *">
                <input
                  type="text"
                  value={form.label}
                  maxLength={255}
                  required
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="field-input"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  rows={3}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="field-input"
                  style={{ resize: 'vertical' }}
                />
              </Field>

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

function Field({ label, children }) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default Machines;
