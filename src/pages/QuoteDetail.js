import { useState, useEffect, useCallback } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const STATUS_LABELS = { pending: 'En attente', accepted: 'Accepté', completed: 'Terminé', expired: 'Expiré', cancelled: 'Annulé' };
const STATUS_CLASS  = { pending: 'badge-warning', accepted: 'badge-success', completed: 'badge-success', expired: 'badge-danger', cancelled: 'badge-neutral' };

export default function QuoteDetail({ id, canEdit, onBack, onOrderCreated }) {
  const [quote,         setQuote]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [saving,        setSaving]        = useState(false);

  // Inline field edit (deadline | status)
  const [editField,     setEditField]     = useState(null);
  const [editValue,     setEditValue]     = useState('');

  // Line qty inline edit
  const [editLineId,    setEditLineId]    = useState(null);
  const [editQty,       setEditQty]       = useState('');

  // Add-line form
  const [showAddLine,   setShowAddLine]   = useState(false);
  const [parts,         setParts]         = useState([]);
  const [pendingLine,   setPendingLine]   = useState({ partId: '', quantity: 1 });

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

  // Lazy-load finished parts when the add-line form opens
  useEffect(() => {
    if (!showAddLine || parts.length > 0) return;
    authFetch('/api/parts')
      .then(r => r.json())
      .then(json => {
        const all = Array.isArray(json) ? json : (json['hydra:member'] ?? json.items ?? []);
        setParts(all.filter(p => p.type === 'finished'));
      })
      .catch(() => {});
  }, [showAddLine, parts.length]);

  // ── Helpers ──────────────────────────────────────────────────

  const isPending = quote?.status === 'pending';
  const canModify = canEdit && isPending;

  const startFieldEdit = (field) => {
    setEditField(field);
    setEditValue(quote[field] ?? '');
    // Close add-line form and line edit when switching
    setShowAddLine(false);
    setEditLineId(null);
  };

  const cancelFieldEdit = () => setEditField(null);

  // ── API calls ─────────────────────────────────────────────────

  const saveField = async () => {
    setSaving(true);
    try {
      const res  = await authFetch(`/api/quotes/${id}`, { method: 'PUT', body: JSON.stringify({ [editField]: editValue }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(data?.error || `Erreur ${res.status}`, 'error'); return; }
      setQuote(data);
      setEditField(null);
      addToast('Devis mis à jour', 'success');
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setSaving(false); }
  };

  const saveLineQty = async (lineId) => {
    const qty = parseInt(editQty, 10);
    if (!qty || qty < 1) { addToast('Quantité invalide', 'error'); return; }
    setSaving(true);
    try {
      const res  = await authFetch(`/api/quotes/${id}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(data?.error || `Erreur ${res.status}`, 'error'); return; }
      setEditLineId(null);
      await load();
      addToast('Quantité mise à jour', 'success');
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setSaving(false); }
  };

  const addLine = async () => {
    if (!pendingLine.partId) return;
    setSaving(true);
    try {
      const body = { partId: parseInt(pendingLine.partId, 10), quantity: parseInt(pendingLine.quantity, 10) || 1 };
      const res  = await authFetch(`/api/quotes/${id}/lines`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(data?.error || `Erreur ${res.status}`, 'error'); return; }
      setPendingLine({ partId: '', quantity: 1 });
      setShowAddLine(false);
      await load();
      addToast('Ligne ajoutée', 'success');
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setSaving(false); }
  };

  const deleteLine = async (lineId) => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/quotes/${id}/lines/${lineId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      await load();
      addToast('Ligne supprimée', 'success');
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setSaving(false); }
  };

  const createOrder = async () => {
    setCreatingOrder(true);
    try {
      const quoteLineIds = (quote?.lines || []).filter(l => !l.inOrder).map(l => l.id);
      if (quoteLineIds.length === 0) {
        addToast('Toutes les lignes sont déjà commandées', 'error');
        return;
      }
      const res  = await authFetch('/api/orders', { method: 'POST', body: JSON.stringify({ quoteLineIds }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(data?.error || `Erreur ${res.status}`, 'error'); return; }
      addToast('Commande créée avec succès', 'success');
      onOrderCreated(data.id);
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setCreatingOrder(false); }
  };

  // ── Render guards ─────────────────────────────────────────────

  if (loading) return <div className="loading-state"><p>Chargement du devis…</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!quote)  return <div className="empty-block">Aucune donnée</div>;

  const lines = quote.lines || [];
  const hasUnorderedLines = lines.some(l => !l.inOrder);
  const canCreateOrder = canEdit && hasUnorderedLines && !['expired', 'cancelled', 'completed'].includes(quote.status);
  const existingPartIds = new Set(lines.map(l => l.part?.id));
  const selectedPart = parts.find(p => String(p.id) === String(pendingLine.partId));

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>

        <div style={{ flex: 1 }}>
          <h2 className="parts-title">{quote.reference}</h2>

          {/* Status — editable if pending */}
          {editField === 'status' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <select
                className="status-select"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
              >
                <option value="pending">En attente</option>
                <option value="accepted">Accepté</option>
                <option value="expired">Expiré</option>
                <option value="cancelled">Annulé</option>
              </select>
              <button className="btn-save" onClick={saveField} disabled={saving}>✓ Sauvegarder</button>
              <button className="btn-cancel-sm" onClick={cancelFieldEdit}>Annuler</button>
            </div>
          ) : (
            <p className="parts-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={`status-badge ${STATUS_CLASS[quote.status] || 'badge-neutral'}`}>
                {STATUS_LABELS[quote.status] || quote.status}
              </span>
              {canModify && (
                <button className="btn-icon" onClick={() => startFieldEdit('status')} title="Modifier le statut">
                  ✎
                </button>
              )}
            </p>
          )}
        </div>

        {canCreateOrder && (
          <button className="btn-create-order" onClick={createOrder} disabled={creatingOrder}>
            {creatingOrder ? 'Création…' : '✓ Créer une commande'}
          </button>
        )}
      </div>

      {/* ── Infos générales ────────────────────────────────── */}
      <div className="dashboard-grid">
        {/* Client — non modifiable */}
        <div className="dashboard-card">
          <div className="dashboard-label">Client</div>
          <div className="dashboard-value-small" style={{ marginTop: 8 }}>
            {quote.client ? `${quote.client.firstname} ${quote.client.lastname}` : '—'}
          </div>
          {quote.client?.email && <div className="dashboard-note">{quote.client.email}</div>}
        </div>

        {/* Deadline — éditable si pending */}
        <div className="dashboard-card">
          <div className="dashboard-label">Date limite</div>
          {editField === 'deadline' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="field-input"
                style={{ width: 'auto', flex: '0 0 auto' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') cancelFieldEdit(); }}
                autoFocus
              />
              <button className="btn-save" onClick={saveField} disabled={saving}>✓</button>
              <button className="btn-cancel-sm" onClick={cancelFieldEdit}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div className="dashboard-value-small">{quote.deadline || '—'}</div>
              {canModify && (
                <button className="btn-icon" onClick={() => startFieldEdit('deadline')} title="Modifier la date limite">
                  ✎
                </button>
              )}
            </div>
          )}
        </div>

        {/* Montant total — calculé automatiquement */}
        <div className="dashboard-card">
          <div className="dashboard-label">Montant total</div>
          <div className="dashboard-value" style={{ marginTop: 8 }}>
            {parseFloat(quote.totalAmount || 0).toFixed(2)} €
          </div>
        </div>

        {/* Créé le */}
        <div className="dashboard-card">
          <div className="dashboard-label">Créé le</div>
          <div className="dashboard-value-small" style={{ marginTop: 8 }}>{quote.createdAt || '—'}</div>
        </div>
      </div>

      {/* ── Lignes du devis ────────────────────────────────── */}
      <div className="detail-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Lignes du devis
            <span className="count-badge">{lines.length}</span>
          </h3>
          {canModify && !showAddLine && (
            <button
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => { setShowAddLine(true); setEditField(null); setEditLineId(null); }}
            >
              + Ajouter une ligne
            </button>
          )}
        </div>

        {/* ── Formulaire d'ajout de ligne ── */}
        {showAddLine && (
          <div className="add-line-panel" style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: '#0f172a' }}>Nouvelle ligne</p>
            <div className="add-line-row">
              <div>
                <label>Pièce (finished)</label>
                {parts.length > 0 ? (
                  <select
                    value={pendingLine.partId}
                    onChange={e => setPendingLine(p => ({ ...p, partId: e.target.value }))}
                  >
                    <option value="">— Sélectionner —</option>
                    {parts.map(p => (
                      <option key={p.id} value={p.id} disabled={existingPartIds.has(p.id)}>
                        {p.reference} — {p.label}
                        {existingPartIds.has(p.id) ? ' (déjà présente)' : ` (${parseFloat(p.salePrice || 0).toFixed(2)} €)`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input readOnly value="Chargement…" />
                )}
              </div>
              <div>
                <label>Qté</label>
                <input
                  type="number" min="1"
                  value={pendingLine.quantity}
                  onChange={e => setPendingLine(p => ({ ...p, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label>Prix unitaire</label>
                <input
                  readOnly
                  value={selectedPart ? `${parseFloat(selectedPart.salePrice || 0).toFixed(2)} €` : '—'}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 0 }}>
                <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={addLine} disabled={!pendingLine.partId || saving}>
                  Ajouter
                </button>
                <button className="btn-cancel-sm" style={{ padding: '8px 14px' }} onClick={() => { setShowAddLine(false); setPendingLine({ partId: '', quantity: 1 }); }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table des lignes ── */}
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
                  {canModify && <th></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td className="cell-reference">{l.part?.reference ?? '—'}</td>
                    <td>{l.part?.label ?? '—'}</td>

                    {/* Quantité — éditable si non commandée */}
                    {editLineId === l.id ? (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <input
                            type="number" min="1"
                            className="qty-input"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveLineQty(l.id); if (e.key === 'Escape') setEditLineId(null); }}
                            autoFocus
                          />
                          <button className="btn-save" onClick={() => saveLineQty(l.id)} disabled={saving}>✓</button>
                          <button className="btn-cancel-sm" onClick={() => setEditLineId(null)}>✕</button>
                        </div>
                      </td>
                    ) : (
                      <td className="cell-numeric">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          {l.quantity}
                          {canModify && !l.inOrder && (
                            <button
                              className="btn-icon"
                              onClick={() => { setEditLineId(l.id); setEditQty(String(l.quantity)); setShowAddLine(false); setEditField(null); }}
                              title="Modifier la quantité"
                            >✎</button>
                          )}
                          {canModify && l.inOrder && (
                            <span className="lock-icon" title="Ligne déjà commandée">🔒</span>
                          )}
                        </div>
                      </td>
                    )}

                    <td className="cell-numeric">{parseFloat(l.unitPrice).toFixed(2)} €</td>
                    <td className="cell-numeric" style={{ fontWeight: 600 }}>
                      {(parseFloat(l.unitPrice) * l.quantity).toFixed(2)} €
                    </td>

                    {canModify && (
                      <td className="cell-actions">
                        {l.inOrder ? (
                          <span className="lock-icon" title="Ligne déjà commandée — non supprimable">commandée</span>
                        ) : (
                          <button
                            className="btn-delete"
                            onClick={() => deleteLine(l.id)}
                            disabled={saving}
                            title="Supprimer cette ligne"
                          >✕</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total-row" style={{ padding: '12px 16px 4px' }}>
              <span>Total :</span>
              <span>{parseFloat(quote.totalAmount || 0).toFixed(2)} €</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
