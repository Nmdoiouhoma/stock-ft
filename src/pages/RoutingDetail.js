import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';
import './Routings.css';

const ORDER_STATUSES = [
  { value: 'pending',     label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed',   label: 'Terminé' },
];

const STATUS_LABEL = Object.fromEntries(ORDER_STATUSES.map(s => [s.value, s.label]));

const EMPTY_ORDER_FORM = {
  plannedDate: '',
  plannedQuantity: '',
  status: 'pending',
  actualQuantity: '',
  actualDuration: '',
};

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function RoutingDetail({ id, isAdmin, isSupervisor, onBack }) {
  const { toasts, addToast, removeToast } = useToast();
  const [routing, setRouting]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [workstations, setWorkstations]   = useState([]);
  const [machines, setMachines]           = useState([]);

  // Add-operation modal (create new)
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', unitTime: '', workstationId: '', machineId: '' });
  const [adding, setAdding]   = useState(false);

  // Associate existing operation modal
  const [showAssoc, setShowAssoc]       = useState(false);
  const [allOperations, setAllOperations] = useState([]);
  const [assocLoading, setAssocLoading] = useState(false);
  const [associating, setAssociating]   = useState(false);

  // Per-operation production orders: { [opId]: [...] }
  const [productionOrders, setProductionOrders] = useState({});

  // Edit-operation modal
  const [opModal, setOpModal] = useState(null);

  // Production order modal: { mode, operationId, itemId, form, saving }
  const [orderModal, setOrderModal] = useState(null);

  const canSupervisor = isAdmin || isSupervisor;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rRes, wRes, mRes] = await Promise.all([
        authFetch(`/api/routings/${id}`),
        authFetch('/api/workstations'),
        authFetch('/api/machines'),
      ]);

      if (!rRes.ok) throw new Error(`Erreur routings ${rRes.status}`);
      const rJson = await rRes.json();
      setRouting(rJson);

      const ops = rJson.operations ?? [];
      if (ops.length > 0) {
        const results = await Promise.allSettled(
          ops.map(op =>
            authFetch(`/api/operations/${op.id}/production-orders`)
              .then(r => r.ok ? r.json() : [])
              .then(j => ({ opId: op.id, list: Array.isArray(j) ? j : [] }))
          )
        );
        const po = {};
        for (const r of results) {
          if (r.status === 'fulfilled') po[r.value.opId] = r.value.list;
        }
        setProductionOrders(po);
      }

      if (wRes.ok) {
        const wJson = await wRes.json();
        setWorkstations(Array.isArray(wJson) ? wJson : (wJson['hydra:member'] ?? wJson.items ?? wJson.data ?? []));
      }
      if (mRes.ok) {
        const mJson = await mRes.json();
        setMachines(Array.isArray(mJson) ? mJson : (mJson['hydra:member'] ?? mJson.items ?? mJson.data ?? []));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Visual-only reorder (moves are sent to backend via the existing /move endpoint)
  const move = async (op, dir) => {
    if (!routing) return;
    const ops = (routing.operations || []).slice();
    const i   = ops.findIndex(o => o.id === op.id);
    const to  = i + dir;
    if (to < 0 || to >= ops.length) return;

    const res = await authFetch(`/api/operations/${op.id}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction: dir < 0 ? 'up' : 'down' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast(data?.error || `Erreur déplacement ${res.status}`, 'error');
      return;
    }
    // Reflect the swap locally
    const tmp = ops[to]; ops[to] = ops[i]; ops[i] = tmp;
    setRouting(r => ({ ...r, operations: ops }));
  };

  // ── Associate existing operation ──────────────────────────────────────

  const openAssoc = async () => {
    setShowAssoc(true);
    setAssocLoading(true);
    try {
      const res = await authFetch('/api/operations');
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (json['hydra:member'] ?? json.items ?? json.data ?? []);
        const linked = new Set((routing?.operations ?? []).map(o => o.id));
        setAllOperations(list.filter(o => !linked.has(o.id)));
      }
    } catch { /* ignore */ }
    finally { setAssocLoading(false); }
  };

  const closeAssoc = () => { setShowAssoc(false); setAllOperations([]); };

  const handleAssociate = async (opId) => {
    setAssociating(true);
    try {
      const res = await authFetch(`/api/routings/${id}/operations/${opId}`, { method: 'POST' });
      if (res.status === 409) {
        addToast('Cette opération est déjà associée à la gamme.', 'error');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      const data = await res.json().catch(() => ({}));
      addToast('Opération associée', 'success');
      setRouting(r => ({ ...r, operations: [...(r.operations || []), data] }));
      setProductionOrders(prev => ({ ...prev, [opId]: [] }));
      setAllOperations(prev => prev.filter(o => o.id !== opId));
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally { setAssociating(false); }
  };

  // ── Add operation ─────────────────────────────────────────────────────

  const openAdd  = () => { setShowAdd(true); setAddForm({ label: '', unitTime: '', workstationId: '', machineId: '' }); };
  const closeAdd = () => { setShowAdd(false); };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const body = {
        label:         addForm.label,
        unitTime:      parseFloat(addForm.unitTime),
        workstationId: addForm.workstationId ? parseInt(addForm.workstationId, 10) : undefined,
        machineId:     addForm.machineId     ? parseInt(addForm.machineId,     10) : null,
      };
      const res  = await authFetch(`/api/routings/${id}/operations`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`, 'error');
        return;
      }
      addToast('Opération ajoutée', 'success');
      setRouting(r => ({ ...r, operations: [...(r.operations || []), data] }));
      setProductionOrders(prev => ({ ...prev, [data.id]: [] }));
      closeAdd();
    } catch { addToast('Impossible de contacter le serveur.', 'error'); }
    finally  { setAdding(false); }
  };

  // ── Edit / Remove operation ───────────────────────────────────────────

  const openEditOp  = (op) => setOpModal({ op, form: { label: op.label ?? '', unitTime: String(op.unitTime ?? ''), workstationId: String(op.workstation?.id ?? ''), machineId: String(op.machine?.id ?? '') }, saving: false });
  const closeOpModal = () => setOpModal(null);

  const handleEditOpSubmit = async (e) => {
    e.preventDefault();
    if (!opModal) return;
    setOpModal(m => ({ ...m, saving: true }));
    const { op, form } = opModal;
    const body = {
      label:         form.label,
      unitTime:      parseFloat(form.unitTime),
      workstationId: form.workstationId ? parseInt(form.workstationId, 10) : undefined,
      machineId:     form.machineId     ? parseInt(form.machineId,     10) : null,
    };
    try {
      const res  = await authFetch(`/api/operations/${op.id}`, { method: 'PUT', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`, 'error');
        setOpModal(m => ({ ...m, saving: false }));
        return;
      }
      addToast('Opération modifiée', 'success');
      setRouting(r => ({ ...r, operations: r.operations.map(o => o.id === op.id ? { ...o, ...data } : o) }));
      closeOpModal();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
      setOpModal(m => ({ ...m, saving: false }));
    }
  };

  // Removes operation from this routing (does NOT delete the operation entity)
  const handleRemoveOp = async (opId) => {
    if (!window.confirm('Retirer cette opération de la gamme ?')) return;
    const res = await authFetch(`/api/routings/${id}/operations/${opId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      addToast(data?.error || `Erreur ${res.status}`, 'error');
      return;
    }
    addToast('Opération retirée de la gamme', 'success');
    setRouting(r => ({ ...r, operations: r.operations.filter(o => o.id !== opId) }));
    setProductionOrders(prev => { const next = { ...prev }; delete next[opId]; return next; });
  };

  // ── Production order modal ────────────────────────────────────────────

  const openOrderModal = (operationId, item = null) => {
    const form = item ? {
      plannedDate:    item.plannedDate?.split('T')[0] ?? '',
      plannedQuantity: String(item.plannedQuantity ?? ''),
      status:         item.status ?? 'pending',
      actualQuantity: item.actualQuantity != null ? String(item.actualQuantity) : '',
      actualDuration: item.actualDuration != null ? String(item.actualDuration) : '',
    } : { ...EMPTY_ORDER_FORM };
    setOrderModal({ mode: item ? 'edit' : 'create', operationId, itemId: item?.id ?? null, form, saving: false });
  };

  const closeOrderModal = () => setOrderModal(null);

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!orderModal) return;
    setOrderModal(m => ({ ...m, saving: true }));
    const { mode, operationId, itemId, form } = orderModal;
    const isEdit = mode === 'edit';

    const prevStatus = isEdit
      ? (productionOrders[operationId] ?? []).find(o => o.id === itemId)?.status
      : null;

    const body = {
      plannedDate:     form.plannedDate,
      plannedQuantity: parseInt(form.plannedQuantity, 10),
      status:          form.status,
      actualQuantity:  form.actualQuantity  !== '' ? parseInt(form.actualQuantity,  10) : null,
      actualDuration:  form.actualDuration  !== '' ? parseFloat(form.actualDuration)    : null,
    };
    // Workers cannot send plannedDate/plannedQuantity (backend returns 403)
    // Supervisors can always send them — no client-side strip needed

    const url = isEdit
      ? `/api/operations/${operationId}/production-orders/${itemId}`
      : `/api/operations/${operationId}/production-orders`;

    try {
      const res  = await authFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`, 'error');
        setOrderModal(m => ({ ...m, saving: false }));
        return;
      }

      setProductionOrders(prev => ({
        ...prev,
        [operationId]: isEdit
          ? (prev[operationId] ?? []).map(o => o.id === itemId ? data : o)
          : [...(prev[operationId] ?? []), data],
      }));

      // Notify stock update when transitioning to completed
      if (data.status === 'completed' && prevStatus !== 'completed') {
        window.dispatchEvent(new CustomEvent('parts:added'));
      }

      addToast(isEdit ? 'Ordre mis à jour' : 'Ordre créé', 'success');
      closeOrderModal();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
      setOrderModal(m => ({ ...m, saving: false }));
    }
  };

  const handleDeleteOrder = async (operationId, itemId) => {
    if (!window.confirm('Supprimer cet ordre de fabrication ?')) return;
    const res = await authFetch(`/api/operations/${operationId}/production-orders/${itemId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      addToast(`Erreur suppression ${res.status}`, 'error');
      return;
    }
    addToast('Ordre supprimé', 'success');
    setProductionOrders(prev => ({
      ...prev,
      [operationId]: (prev[operationId] ?? []).filter(o => o.id !== itemId),
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return <div className="loading-state"><p>Chargement du détail...</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!routing) return <div>Aucune donnée</div>;

  return (
    <div className="routing-detail">
      <div className="detail-top-cards">
        <div className="card">
          <div className="card-label">Pièce</div>
          <div className="card-value">{routing.part ? `${routing.part.reference} — ${routing.part.label}` : '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">Responsable</div>
          <div className="card-value">{routing.supervisor ? `${routing.supervisor.firstname} ${routing.supervisor.lastname}` : '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">Nb opérations</div>
          <div className="card-value">{routing.operationsCount ?? (routing.operations?.length ?? 0)}</div>
        </div>
      </div>

      <div className="operations-list">
        <h3>Opérations</h3>
        {canSupervisor && (
          <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={openAdd}>+ Nouvelle opération</button>
            <button className="btn-secondary" onClick={openAssoc}>+ Associer une opération existante</button>
          </div>
        )}
        {(routing.operations || []).length === 0 ? (
          <div className="empty-state">Aucune opération</div>
        ) : (
          <ul>
            {routing.operations.map((op, i) => (
              <li key={op.id} className="operation-card">
                <div className="operation-header">
                  <div className="op-header-left">
                    <span className="op-index">{op.rank ?? i + 1}</span>
                    <span className="op-title">{op.label ?? 'Opération'}</span>
                    {op.workstation && <span className="op-meta">{op.workstation.label}</span>}
                    {op.machine     && <span className="op-meta op-meta-machine">{op.machine.label}</span>}
                  </div>
                  {canSupervisor && (
                    <div className="op-reorder">
                      <button className="btn-small" onClick={() => move(op, -1)} disabled={i === 0}>↑</button>
                      <button className="btn-small" onClick={() => move(op,  1)} disabled={i === routing.operations.length - 1}>↓</button>
                      <button className="btn-icon" title="Modifier" onClick={() => openEditOp(op)}>✎</button>
                      <button className="btn-icon btn-icon-del" title="Retirer de la gamme" onClick={() => handleRemoveOp(op.id)}>✕</button>
                    </div>
                  )}
                </div>

                {/* Ordres de fabrication */}
                <div className="op-sub-sections">
                  <div className="op-sub-section">
                    <div className="sub-section-header">
                      <span className="sub-section-title">Ordres de fabrication :</span>
                      {canSupervisor && (productionOrders[op.id] ?? []).length === 0 && (
                        <button className="btn-add-inline" onClick={() => openOrderModal(op.id)}>
                          + Nouvel ordre
                        </button>
                      )}
                    </div>
                    {(productionOrders[op.id] ?? []).length === 0 ? (
                      <p className="sub-empty">Aucun ordre de fabrication</p>
                    ) : (
                      <ul className="sub-list">
                        {(productionOrders[op.id] ?? []).map(order => (
                          <li key={order.id} className="sub-item">
                            <span className="sub-bullet">•</span>
                            <span className="sub-text">
                              {fmtDate(order.plannedDate)} — {order.plannedQuantity} prévus
                              {order.actualQuantity != null && ` · ${order.actualQuantity} réels`}
                              {order.actualDuration  != null && ` · ${order.actualDuration} min`}
                              {' '}
                              <span className={`status-badge status-${order.status ?? ''}`}>
                                {STATUS_LABEL[order.status] ?? order.status ?? '—'}
                              </span>
                            </span>
                            <span className="sub-actions">
                              <button className="btn-icon" title="Modifier" onClick={() => openOrderModal(op.id, order)}>✎</button>
                              {canSupervisor && (
                                <button className="btn-icon btn-icon-del" title="Supprimer" onClick={() => handleDeleteOrder(op.id, order.id)}>✕</button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Associate existing operation modal ── */}
      {showAssoc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Associer une opération existante</h3>
            {assocLoading ? (
              <p>Chargement...</p>
            ) : allOperations.length === 0 ? (
              <p className="sub-empty">Aucune opération disponible à associer.</p>
            ) : (
              <ul className="sub-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {allOperations.map(op => (
                  <li key={op.id} className="sub-item" style={{ justifyContent: 'space-between' }}>
                    <span className="sub-text">
                      <strong>{op.label ?? `#${op.id}`}</strong>
                      {op.workstation && <span className="op-meta" style={{ marginLeft: 8 }}>{op.workstation.label}</span>}
                      {op.machine     && <span className="op-meta op-meta-machine" style={{ marginLeft: 4 }}>{op.machine.label}</span>}
                    </span>
                    <button className="btn-small btn-primary" disabled={associating}
                      onClick={() => handleAssociate(op.id)}>
                      Associer
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={closeAssoc}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add operation modal ── */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Nouvelle opération</h3>
            <form onSubmit={handleAddSubmit}>
              <label className="form-field">
                <span className="field-label">Label *</span>
                <input className="field-input" required value={addForm.label}
                  onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Temps unitaire *</span>
                <input type="number" step="any" className="field-input" required value={addForm.unitTime}
                  onChange={e => setAddForm(f => ({ ...f, unitTime: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Poste de travail *</span>
                <select className="field-input" required value={addForm.workstationId}
                  onChange={e => setAddForm(f => ({ ...f, workstationId: e.target.value }))}>
                  <option value="">-- Sélectionner un poste --</option>
                  {workstations.map(w => <option key={w.id} value={w.id}>{w.label ?? `#${w.id}`}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Machine</span>
                <select className="field-input" value={addForm.machineId}
                  onChange={e => setAddForm(f => ({ ...f, machineId: e.target.value }))}>
                  <option value="">-- Aucune --</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.label ?? `#${m.id}`}</option>)}
                </select>
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeAdd} disabled={adding}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={adding}>
                  {adding ? 'Enregistrement...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit operation modal ── */}
      {opModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Modifier l'opération</h3>
            <form onSubmit={handleEditOpSubmit}>
              <label className="form-field">
                <span className="field-label">Label *</span>
                <input className="field-input" required value={opModal.form.label}
                  onChange={e => setOpModal(m => ({ ...m, form: { ...m.form, label: e.target.value } }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Temps unitaire *</span>
                <input type="number" step="any" className="field-input" required value={opModal.form.unitTime}
                  onChange={e => setOpModal(m => ({ ...m, form: { ...m.form, unitTime: e.target.value } }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Poste de travail *</span>
                <select className="field-input" required value={opModal.form.workstationId}
                  onChange={e => setOpModal(m => ({ ...m, form: { ...m.form, workstationId: e.target.value } }))}>
                  <option value="">-- Sélectionner un poste --</option>
                  {workstations.map(w => <option key={w.id} value={w.id}>{w.label ?? `#${w.id}`}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Machine</span>
                <select className="field-input" value={opModal.form.machineId}
                  onChange={e => setOpModal(m => ({ ...m, form: { ...m.form, machineId: e.target.value } }))}>
                  <option value="">-- Aucune --</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.label ?? `#${m.id}`}</option>)}
                </select>
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeOpModal} disabled={opModal.saving}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={opModal.saving}>
                  {opModal.saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Production order modal ── */}
      {orderModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              {orderModal.mode === 'edit' ? "Modifier l'ordre de fabrication" : 'Nouvel ordre de fabrication'}
            </h3>
            <form onSubmit={handleOrderSubmit}>
              {/* Planned fields — only editable by supervisors/admins */}
              {canSupervisor && (
                <>
                  <label className="form-field">
                    <span className="field-label">Date prévue *</span>
                    <input type="date" className="field-input"
                      required={orderModal.mode === 'create'}
                      value={orderModal.form.plannedDate}
                      onChange={e => setOrderModal(m => ({ ...m, form: { ...m.form, plannedDate: e.target.value } }))} />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Qté prévue *</span>
                    <input type="number" min="1" className="field-input"
                      required={orderModal.mode === 'create'}
                      value={orderModal.form.plannedQuantity}
                      onChange={e => setOrderModal(m => ({ ...m, form: { ...m.form, plannedQuantity: e.target.value } }))} />
                  </label>
                </>
              )}
              <label className="form-field">
                <span className="field-label">Statut</span>
                <select className="field-input"
                  value={orderModal.form.status}
                  onChange={e => setOrderModal(m => ({ ...m, form: { ...m.form, status: e.target.value } }))}>
                  {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Qté réelle</span>
                <input type="number" min="1" className="field-input"
                  value={orderModal.form.actualQuantity}
                  onChange={e => setOrderModal(m => ({ ...m, form: { ...m.form, actualQuantity: e.target.value } }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Durée réelle (min)</span>
                <input type="number" min="0" step="any" className="field-input"
                  value={orderModal.form.actualDuration}
                  onChange={e => setOrderModal(m => ({ ...m, form: { ...m.form, actualDuration: e.target.value } }))} />
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeOrderModal} disabled={orderModal.saving}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={orderModal.saving}>
                  {orderModal.saving ? 'Enregistrement...' : orderModal.mode === 'edit' ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn-secondary" onClick={onBack}>← Retour</button>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
