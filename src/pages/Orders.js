import { useState, useEffect, useCallback, useMemo } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const STATUS_LABELS = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
const STATUS_CLASS  = { pending: 'badge-warning', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-neutral' };

const PAGE_SIZE = 10;

export default function Orders({ onView }) {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/orders');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setOrders(Array.isArray(json) ? json : []);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      String(o.quote?.reference || '').toLowerCase().includes(q) ||
      String(o.status || '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="parts-header">
        <div>
          <h2 className="parts-title">Commandes</h2>
          <p className="parts-subtitle">{orders.length} commande{orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="table-controls">
        <input
          className="search-input"
          placeholder="Rechercher par référence de devis…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="loading-state"><p>Chargement des commandes…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Aucune commande trouvée</p></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Devis</th>
                  <th>Client</th>
                  <th>Créée le</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => (
                  <tr key={o.id}>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>#{o.id}</td>
                    <td className="cell-reference">{o.quote?.reference ?? '—'}</td>
                    <td>
                      {o.quote?.client
                        ? `${o.quote.client.firstname} ${o.quote.client.lastname}`
                        : '—'}
                    </td>
                    <td>{o.createdAt || '—'}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[o.status] || 'badge-neutral'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="cell-numeric">
                      {o.quote?.totalAmount
                        ? `${parseFloat(o.quote.totalAmount).toFixed(2)} €`
                        : '—'}
                    </td>
                    <td className="cell-actions">
                      <button className="btn-view" onClick={() => onView(o.id)}>Voir</button>
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
