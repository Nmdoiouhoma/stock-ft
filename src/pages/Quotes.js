import { useState, useEffect, useCallback, useMemo } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const STATUS_LABELS = { pending: 'En attente', accepted: 'Accepté', expired: 'Expiré', cancelled: 'Annulé' };
const STATUS_CLASS  = { pending: 'badge-warning', accepted: 'badge-success', expired: 'badge-danger', cancelled: 'badge-neutral' };

const PAGE_SIZE = 10;

export default function Quotes({ canEdit, onView, onCreate }) {
  const [quotes,  setQuotes]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/quotes');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setQuotes(Array.isArray(json) ? json : []);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(qt =>
      String(qt.reference || '').toLowerCase().includes(q) ||
      String(qt.client?.firstname || '').toLowerCase().includes(q) ||
      String(qt.client?.lastname  || '').toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="parts-header">
        <div>
          <h2 className="parts-title">Devis</h2>
          <p className="parts-subtitle">{quotes.length} devis</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={onCreate}>+ Nouveau devis</button>
        )}
      </div>

      <div className="table-controls">
        <input
          className="search-input"
          placeholder="Rechercher par référence ou client…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="loading-state"><p>Chargement des devis…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Aucun devis trouvé</p></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Date limite</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(qt => (
                  <tr key={qt.id}>
                    <td className="cell-reference">{qt.reference}</td>
                    <td>{qt.client ? `${qt.client.firstname} ${qt.client.lastname}` : '—'}</td>
                    <td>{qt.deadline || '—'}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[qt.status] || 'badge-neutral'}`}>
                        {STATUS_LABELS[qt.status] || qt.status}
                      </span>
                    </td>
                    <td className="cell-numeric">
                      {qt.totalAmount ? `${parseFloat(qt.totalAmount).toFixed(2)} €` : '—'}
                    </td>
                    <td className="cell-actions">
                      <button className="btn-view" onClick={() => onView(qt.id)}>Voir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-bottom">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
