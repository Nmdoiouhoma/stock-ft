import { useState, useEffect, useCallback } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const STATUS_LABELS = { pending: 'En attente', accepted: 'Accepté', expired: 'Expiré', cancelled: 'Annulé' };
const STATUS_CLASS  = { pending: 'badge-warning', accepted: 'badge-success', expired: 'badge-danger', cancelled: 'badge-neutral' };

export default function QuoteDetail({ id, canEdit, onBack, onOrderCreated }) {
  const [quote,       setQuote]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setQuote(await res.json());
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const createOrder = async () => {
    setCreatingOrder(true);
    try {
      const res  = await authFetch('/api/orders', { method: 'POST', body: JSON.stringify({ quoteId: id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      addToast('Commande créée avec succès', 'success');
      onOrderCreated(data.id);
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) return <div className="loading-state"><p>Chargement du devis…</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!quote)  return <div className="empty-block">Aucune donnée</div>;

  const lines = quote.lines || [];
  const total = lines.reduce((s, l) => s + parseFloat(l.unitPrice || 0) * (l.quantity || 0), 0);
  const canCreateOrder = canEdit && (quote.status === 'pending' || quote.status === 'accepted') && lines.length > 0;

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="parts-title">{quote.reference}</h2>
          <p className="parts-subtitle">
            Devis · <span className={`status-badge ${STATUS_CLASS[quote.status] || 'badge-neutral'}`}>
              {STATUS_LABELS[quote.status] || quote.status}
            </span>
          </p>
        </div>
        {canCreateOrder && (
          <button className="btn-create-order" onClick={createOrder} disabled={creatingOrder}>
            {creatingOrder ? 'Création…' : '✓ Créer une commande'}
          </button>
        )}
      </div>

      {/* Infos générales */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-label">Client</div>
          <div className="dashboard-value-small">
            {quote.client ? `${quote.client.firstname} ${quote.client.lastname}` : '—'}
          </div>
          {quote.client?.email && (
            <div className="dashboard-note">{quote.client.email}</div>
          )}
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Date limite</div>
          <div className="dashboard-value-small">{quote.deadline || '—'}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Montant total</div>
          <div className="dashboard-value">
            {parseFloat(quote.totalAmount || 0).toFixed(2)} €
          </div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Créé le</div>
          <div className="dashboard-value-small">{quote.createdAt || '—'}</div>
        </div>
      </div>

      {/* Lignes du devis */}
      <div className="detail-section">
        <h3 className="section-title">
          Lignes du devis
          <span className="count-badge">{lines.length}</span>
        </h3>

        {lines.length === 0 ? (
          <div className="empty-block">Aucune ligne dans ce devis</div>
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
              <span>Total calculé :</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        )}
      </div>

      {!canCreateOrder && canEdit && lines.length === 0 && (
        <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 14 }}>
          Ajoutez des lignes pour pouvoir créer une commande.
        </p>
      )}
    </div>
  );
}
