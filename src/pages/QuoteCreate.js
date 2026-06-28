import { useState, useEffect, useCallback } from 'react';
import '../components/Parts.css';
import '../components/Quotes.css';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';

const EMPTY_FORM = { reference: '', clientId: '', deadline: '', status: 'pending' };
const EMPTY_LINE = { partId: '', quantity: 1 };

export default function QuoteCreate({ onBack, onCreated }) {
  const [form,     setForm]     = useState({ ...EMPTY_FORM });
  const [lines,    setLines]    = useState([]);
  const [pending,  setPending]  = useState({ ...EMPTY_LINE });
  const [clients,  setClients]  = useState([]);
  const [parts,    setParts]    = useState([]);
  const [saving,   setSaving]   = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const loadClients = useCallback(async () => {
    try {
      const res = await authFetch('/api/clients');
      if (!res.ok) return;
      const json = await res.json();
      setClients(Array.isArray(json) ? json : []);
    } catch { /* silencieux si non autorisé */ }
  }, []);

  const loadParts = useCallback(async () => {
    try {
      const res = await authFetch('/api/parts');
      if (!res.ok) return;
      const json = await res.json();
      const all = Array.isArray(json) ? json : (json['hydra:member'] ?? json.items ?? []);
      setParts(all.filter(p => p.type === 'finished'));
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { loadClients(); loadParts(); }, [loadClients, loadParts]);

  const totalAmount = lines.reduce(
    (sum, l) => sum + parseFloat(l.unitPrice || 0) * (parseInt(l.quantity, 10) || 0),
    0
  );

  const selectedPartIds = new Set(lines.map(l => l.partId));

  const selectedPart = parts.find(p => String(p.id) === String(pending.partId));

  const addLine = () => {
    if (!pending.partId || !selectedPart) return;
    if (selectedPartIds.has(String(pending.partId))) {
      addToast('Cette pièce est déjà dans le devis.', 'error');
      return;
    }
    setLines(prev => [
      ...prev,
      {
        partId:    String(selectedPart.id),
        label:     selectedPart.label,
        reference: selectedPart.reference,
        unitPrice: String(selectedPart.salePrice ?? 0),
        quantity:  parseInt(pending.quantity, 10) || 1,
      },
    ]);
    setPending({ ...EMPTY_LINE });
  };

  const removeLine = (partId) => setLines(prev => prev.filter(l => l.partId !== partId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) {
      addToast('Ajoutez au moins une ligne avant de créer le devis.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        reference:   form.reference,
        clientId:    parseInt(form.clientId, 10),
        deadline:    form.deadline,
        status:      form.status,
        totalAmount: totalAmount.toFixed(2),
        lines:       lines.map(l => ({
          partId:    parseInt(l.partId, 10),
          quantity:  l.quantity,
          unitPrice: l.unitPrice,
        })),
      };

      const res  = await authFetch('/api/quotes', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      addToast('Devis créé avec succès', 'success');
      onCreated(data.id);
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="parts-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div>
          <h2 className="parts-title">Nouveau devis</h2>
          <p className="parts-subtitle">Renseignez les informations et ajoutez les lignes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Informations générales */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 0 }}>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label className="field-label">Référence *</label>
              <input
                className="field-input"
                required
                placeholder="DEV-2024-001"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="field-label">Client *</label>
              {clients.length > 0 ? (
                <select
                  className="field-input"
                  required
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">— Sélectionner un client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.firstname} {c.lastname}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  type="number"
                  required
                  placeholder="ID du client"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                />
              )}
            </div>

            <div className="form-field">
              <label className="field-label">Date limite *</label>
              <input
                className="field-input"
                type="date"
                required
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="field-label">Statut</label>
              <select
                className="field-input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="pending">En attente</option>
                <option value="accepted">Accepté</option>
                <option value="expired">Expiré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lignes du devis */}
        <div className="lines-section">
          <p className="lines-section-title">Lignes du devis</p>

          {/* Formulaire d'ajout de ligne */}
          {parts.length > 0 ? (
            <div className="add-line-row">
              <div>
                <label>Pièce (finished)</label>
                <select
                  value={pending.partId}
                  onChange={e => setPending(p => ({ ...p, partId: e.target.value }))}
                >
                  <option value="">— Sélectionner —</option>
                  {parts.map(p => (
                    <option key={p.id} value={p.id} disabled={selectedPartIds.has(String(p.id))}>
                      {p.reference} — {p.label} ({parseFloat(p.salePrice || 0).toFixed(2)} €)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Qté</label>
                <input
                  type="number"
                  min="1"
                  value={pending.quantity}
                  onChange={e => setPending(p => ({ ...p, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label>Prix unitaire</label>
                <input
                  readOnly
                  value={selectedPart ? `${parseFloat(selectedPart.salePrice || 0).toFixed(2)} €` : '—'}
                />
              </div>
              <button type="button" className="btn-primary" onClick={addLine} disabled={!pending.partId}>
                + Ajouter
              </button>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
              Chargement des pièces…
            </p>
          )}

          {/* Table des lignes */}
          {lines.length === 0 ? (
            <div className="empty-block">Aucune ligne ajoutée</div>
          ) : (
            <table className="lines-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th style={{ textAlign: 'right' }}>Qté</th>
                  <th style={{ textAlign: 'right' }}>Prix unitaire</th>
                  <th style={{ textAlign: 'right' }}>Sous-total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.partId}>
                    <td className="cell-reference">{l.reference}</td>
                    <td>{l.label}</td>
                    <td style={{ textAlign: 'right' }}>{l.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(l.unitPrice).toFixed(2)} €</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {(parseFloat(l.unitPrice) * l.quantity).toFixed(2)} €
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-delete"
                        style={{ padding: '2px 8px' }}
                        onClick={() => removeLine(l.partId)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {lines.length > 0 && (
            <div className="total-row">
              <span>Total :</span>
              <span>{totalAmount.toFixed(2)} €</span>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onBack}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Création…' : 'Créer le devis'}
          </button>
        </div>
      </form>
    </div>
  );
}
