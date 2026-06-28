import { useState, useEffect, useCallback } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const STATUS_LABELS = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
const STATUS_CLASS  = { pending: 'badge-warning', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-neutral' };

export default function OrderDetail({ id, canEdit, onBack }) {
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setOrder(await res.json());
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (newStatus) => {
    setSaving(true);
    try {
      const res  = await authFetch(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      setOrder(data);
      addToast('Statut mis à jour', 'success');
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state"><p>Chargement de la commande…</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!order)  return <div className="empty-block">Aucune donnée</div>;

  const lines = order.lines || [];
  const total = lines.reduce((s, l) => s + parseFloat(l.unitPrice || 0) * (l.quantity || 0), 0);

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="parts-title">Commande #{order.id}</h2>
          <p className="parts-subtitle">
            Devis : <strong>{order.quote?.reference ?? '—'}</strong>
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Statut :</span>
            <select
              className="status-select"
              value={order.status}
              disabled={saving}
              onChange={e => updateStatus(e.target.value)}
            >
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        )}
      </div>

      {/* Infos générales */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-label">Statut</div>
          <div style={{ marginTop: 8 }}>
            <span className={`status-badge ${STATUS_CLASS[order.status] || 'badge-neutral'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Devis référencé</div>
          <div className="dashboard-value-small">{order.quote?.reference ?? '—'}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Montant devis</div>
          <div className="dashboard-value">
            {parseFloat(order.quote?.totalAmount || 0).toFixed(2)} €
          </div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Créée le</div>
          <div className="dashboard-value-small">{order.createdAt || '—'}</div>
        </div>
      </div>

      {/* Lignes */}
      <div className="detail-section">
        <h3 className="section-title">
          Lignes de la commande
          <span className="count-badge">{lines.length}</span>
        </h3>

        {lines.length === 0 ? (
          <div className="empty-block">Aucune ligne dans cette commande</div>
        ) : (
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th style={{ textAlign: 'right' }}>Quantité</th>
                  <th style={{ textAlign: 'right' }}>Prix unitaire</th>
                  <th style={{ textAlign: 'right' }}>Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td className="cell-reference">{l.part?.reference ?? '—'}</td>
                    <td>{l.part?.label ?? '—'}</td>
                    <td className="cell-numeric">{l.quantity}</td>
                    <td className="cell-numeric">{parseFloat(l.unitPrice).toFixed(2)} €</td>
                    <td className="cell-numeric" style={{ fontWeight: 600 }}>
                      {(parseFloat(l.unitPrice) * l.quantity).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total-row" style={{ padding: '12px 16px 4px' }}>
              <span>Total :</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
