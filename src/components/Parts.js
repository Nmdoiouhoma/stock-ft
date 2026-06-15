import { useState, useEffect, useCallback, useMemo } from 'react';
import './Parts.css';
import { authFetch } from '../utils/auth';

const PIECE_TYPES = [
  { value: 'finished',     label: 'Fini' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'raw_material', label: 'Matière première' },
  { value: 'purchased',    label: 'Acheté' },
];

const EMPTY_FORM = {
  reference:     '',
  label:         '',
  type:          'finished',
  stockQuantity: 0,
  stockMin:      0,
  salePrice:     '',
  catalogPrice:  '',
  supplierId:    '',
};

function Parts({ isAdmin }) {
  const [parts,     setParts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [form,      setForm]      = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving,    setSaving]    = useState(false);

  // Search / sort / pagination
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('reference');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  // Dashboard statistics derived from parts
  const totalParts = parts.length;
  const totalQuantity = parts.reduce((s, p) => s + (Number(p.stockQuantity) || 0), 0);
  const lowStockCount = parts.filter(p => Number(p.stockQuantity) < Number(p.stockMin)).length;
  const totalValue = parts.reduce((s, p) => s + ((p.salePrice != null ? Number(p.salePrice) : 0) * (Number(p.stockQuantity) || 0)), 0);
  const typeCounts = PIECE_TYPES.reduce((acc, t) => ({ ...acc, [t.value]: 0 }), {});
  parts.forEach(p => { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1; });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/parts');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setParts(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); };

  const openEdit = (part) => {
    setForm({
      reference:     part.reference,
      label:         part.label,
      type:          part.type,
      stockQuantity: part.stockQuantity,
      stockMin:      part.stockMin,
      salePrice:     part.salePrice  ?? '',
      catalogPrice:  part.catalogPrice ?? '',
      supplierId:    part.supplier?.id ?? '',
    });
    setEditingId(part.id);
  };

  const closeForm = () => { setForm(null); setEditingId(null); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      reference:     form.reference,
      label:         form.label,
      type:          form.type,
      stockQuantity: parseInt(form.stockQuantity, 10),
      stockMin:      parseInt(form.stockMin, 10),
      salePrice:     form.salePrice    !== '' ? parseFloat(form.salePrice)    : null,
      catalogPrice:  form.catalogPrice !== '' ? parseFloat(form.catalogPrice) : null,
      supplierId:    form.supplierId   !== '' ? parseInt(form.supplierId, 10) : null,
    };

    const url    = editingId ? `/api/parts/${editingId}` : '/api/parts';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res  = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors
          ? data.errors.map(e => e.message).join(', ')
          : data?.error || `Erreur ${res.status}`;
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
    if (!window.confirm('Supprimer cette pièce ?')) return;
    setError('');
    try {
      const res = await authFetch(`/api/parts/${id}`, { method: 'DELETE' });
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

  const typeLabel = (val) => PIECE_TYPES.find(t => t.value === val)?.label ?? val;

  // Filtered, sorted and paginated view
  const filteredParts = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let arr = parts.slice();
    if (q) {
      arr = arr.filter(p => (
        String(p.reference || '').toLowerCase().includes(q)
        || String(p.label || '').toLowerCase().includes(q)
        || String(typeLabel(p.type)).toLowerCase().includes(q)
        || String(p.supplier?.name || '').toLowerCase().includes(q)
      ));
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[sortBy] != null) ? a[sortBy] : '';
      const vb = (b[sortBy] != null) ? b[sortBy] : '';
      // numeric for stock/salePrice
      if (sortBy === 'stockQuantity' || sortBy === 'stockMin' || sortBy === 'salePrice' || sortBy === 'catalogPrice') {
        return (Number(va) - Number(vb)) * dir;
      }
      // special: type -> label
      if (sortBy === 'type') {
        return String(typeLabel(va)).localeCompare(String(typeLabel(vb))) * dir;
      }
      return String(va).toLowerCase().localeCompare(String(vb).toLowerCase()) * dir;
    });

    return arr;
  }, [parts, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  // ensure page is valid
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const paginatedParts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredParts.slice(start, start + PAGE_SIZE);
  }, [filteredParts, page]);

  return (
    <div className="parts-container">
      {/* Header */}
      <div className="parts-header">
        <div>
          <h2 className="parts-title">Gestion des Pièces</h2>
          <p className="parts-subtitle">Consultez et gérez votre inventaire de pièces</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Nouvelle pièce</button>
      </div>

      {/* Dashboard summary */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-label">Total pièces</div>
          <div className="dashboard-value">{totalParts}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-label">Stock total</div>
          <div className="dashboard-value">{totalQuantity}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-label">Sous stock</div>
          <div className="dashboard-value" style={{ color: lowStockCount > 0 ? '#b91c1c' : 'inherit' }}>
            {lowStockCount}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-label">Valeur approximative</div>
          <div className="dashboard-value-small">{totalValue.toFixed(2)} €</div>
          <div className="dashboard-note">Basé sur prix vente</div>
        </div>
      </div>

      {/* Error message */}
      {error && !form && (
        <div className="alert-error">{error}</div>
      )}

      {/* Search / Sort controls */}
      <div className="controls-section">
        <div className="search-sort-bar">
          <input
            className="search-input"
            placeholder="Rechercher référence, désignation, type, fournisseur..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="reference">Référence</option>
            <option value="label">Désignation</option>
            <option value="type">Type</option>
            <option value="stockQuantity">Stock</option>
            <option value="stockMin">Stock min</option>
            <option value="salePrice">Prix vente</option>
          </select>
          <select className="sort-select" value={sortDir} onChange={e => setSortDir(e.target.value)}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <p>Chargement des pièces...</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Désignation</th>
                <th>Type</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Prix vente</th>
                <th>Prix catalogue</th>
                <th>Fournisseur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 && (
                <tr className="empty-state">
                  <td colSpan={9}>Aucune pièce trouvée</td>
                </tr>
              )}
              {paginatedParts.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="cell-reference">{p.reference}</td>
                  <td>{p.label}</td>
                  <td>{typeLabel(p.type)}</td>
                  <td className={p.stockQuantity < p.stockMin ? 'cell-low-stock' : ''}>
                    {p.stockQuantity}
                  </td>
                  <td>{p.stockMin}</td>
                  <td>{p.salePrice    != null ? p.salePrice.toFixed(2)    + ' €' : '—'}</td>
                  <td>{p.catalogPrice != null ? p.catalogPrice.toFixed(2) + ' €' : '—'}</td>
                  <td>{p.supplier?.name ?? '—'}</td>
                  <td className="cell-actions">
                    <button className="btn-edit" onClick={() => openEdit(p)}>Modifier</button>
                    {isAdmin && (
                      <button className="btn-delete" onClick={() => handleDelete(p.id)}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls - Bottom */}
      {!loading && filteredParts.length > 0 && (
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

      {/* Modal Form */}
      {form && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{editingId ? 'Modifier la pièce' : 'Nouvelle pièce'}</h3>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <Field label="Référence *" required>
                <input
                  type="text"
                  value={form.reference}
                  maxLength={50}
                  required
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="field-input"
                />
              </Field>

              <Field label="Désignation *" required>
                <input
                  type="text"
                  value={form.label}
                  maxLength={255}
                  required
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="field-input"
                />
              </Field>

              <Field label="Type *">
                <select
                  value={form.type}
                  required
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="field-input"
                >
                  {PIECE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <div className="form-grid">
                <Field label="Stock actuel">
                  <input
                    type="number"
                    value={form.stockQuantity}
                    min={0}
                    step={1}
                    onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                    className="field-input"
                  />
                </Field>
                <Field label="Stock minimum">
                  <input
                    type="number"
                    value={form.stockMin}
                    min={0}
                    step={1}
                    onChange={e => setForm(f => ({ ...f, stockMin: e.target.value }))}
                    className="field-input"
                  />
                </Field>
                <Field label="Prix de vente (€)">
                  <input
                    type="number"
                    value={form.salePrice}
                    min={0}
                    step={0.01}
                    placeholder="—"
                    onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))}
                    className="field-input"
                  />
                </Field>
                <Field label="Prix catalogue (€)">
                  <input
                    type="number"
                    value={form.catalogPrice}
                    min={0}
                    step={0.01}
                    placeholder="—"
                    onChange={e => setForm(f => ({ ...f, catalogPrice: e.target.value }))}
                    className="field-input"
                  />
                </Field>
              </div>

              <Field label="ID Fournisseur">
                <input
                  type="number"
                  value={form.supplierId}
                  min={1}
                  step={1}
                  placeholder="—"
                  onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="field-input"
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

export default Parts;
