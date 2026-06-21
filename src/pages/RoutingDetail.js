import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';
import './Routings.css';

const FORECAST_STATUSES = [
  { value: 'pending',     label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed',   label: 'Terminé' },
];

const STATUS_LABEL = Object.fromEntries(FORECAST_STATUSES.map(s => [s.value, s.label]));

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function RoutingDetail({ id, isAdmin, isSupervisor, onBack }) {
  const { toasts, addToast, removeToast } = useToast();
  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workstations, setWorkstations] = useState([]);
  const [machines, setMachines] = useState([]);

  // Add-operation modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', unitTime: '', workstationId: '', machineId: '' });
  const [adding, setAdding] = useState(false);

  // Per-operation data
  const [forecasts, setForecasts] = useState({});   // { [opId]: [...] }
  const [completions, setCompletions] = useState({}); // { [opId]: [...] }

  // Edit-operation modal: { op, form, saving }
  const [opModal, setOpModal] = useState(null);

  // Generic sub-modal: { type, mode, operationId, itemId, form, saving }
  const [modal, setModal] = useState(null);

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
        const subResults = await Promise.allSettled(
          ops.flatMap(op => [
            authFetch(`/api/operations/${op.id}/forecasts`)
              .then(r => r.ok ? r.json() : {})
              .then(j => ({ opId: op.id, kind: 'forecast', list: Array.isArray(j) ? j : (j['hydra:member'] ?? j.items ?? j.data ?? []) })),
            authFetch(`/api/operations/${op.id}/completions`)
              .then(r => r.ok ? r.json() : {})
              .then(j => ({ opId: op.id, kind: 'completion', list: Array.isArray(j) ? j : (j['hydra:member'] ?? j.items ?? j.data ?? []) })),
          ])
        );
        const fc = {}, cp = {};
        for (const r of subResults) {
          if (r.status === 'fulfilled') {
            const { opId, kind, list } = r.value;
            if (kind === 'forecast') fc[opId] = list;
            else cp[opId] = list;
          }
        }
        setForecasts(fc);
        setCompletions(cp);
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

  const move = (index, dir) => {
    if (!routing) return;
    const ops = (routing.operations || []).slice();
    const to = index + dir;
    if (to < 0 || to >= ops.length) return;
    const tmp = ops[to]; ops[to] = ops[index]; ops[index] = tmp;
    setRouting(r => ({ ...r, operations: ops }));
  };

  const openAdd = () => {
    setShowAdd(true);
    setAddForm({ label: '', unitTime: '', workstationId: '', machineId: '' });
    setError('');
  };
  const closeAdd = () => { setShowAdd(false); setError(''); };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAdding(true); setError('');
    try {
      const body = {
        label: addForm.label,
        unitTime: parseFloat(addForm.unitTime),
        workstationId: addForm.workstationId ? parseInt(addForm.workstationId, 10) : undefined,
        machineId: addForm.machineId ? parseInt(addForm.machineId, 10) : null,
      };
      const res = await authFetch(`/api/routings/${id}/operations`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`;
        addToast(msg, 'error');
        return;
      }
      addToast('Opération ajoutée avec succès', 'success');
      setRouting(r => ({ ...r, operations: [...(r.operations || []), data] }));
      setForecasts(prev => ({ ...prev, [data.id]: [] }));
      setCompletions(prev => ({ ...prev, [data.id]: [] }));
      closeAdd();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setAdding(false);
    }
  };

  // ── Operation edit / delete ─────────────────────────────────────────

  const openEditOp = (op) => {
    setOpModal({
      op,
      form: {
        label: op.label ?? '',
        unitTime: String(op.unitTime ?? ''),
        workstationId: String(op.workstation?.id ?? op.workstationId ?? ''),
        machineId: String(op.machine?.id ?? op.machineId ?? ''),
      },
      saving: false,
    });
  };

  const closeOpModal = () => setOpModal(null);

  const handleEditOpSubmit = async (e) => {
    e.preventDefault();
    if (!opModal) return;
    setOpModal(m => ({ ...m, saving: true }));
    const { op, form } = opModal;
    const body = {
      label: form.label,
      unitTime: parseFloat(form.unitTime),
      workstationId: form.workstationId ? parseInt(form.workstationId, 10) : undefined,
      machineId: form.machineId ? parseInt(form.machineId, 10) : null,
    };
    try {
      const res = await authFetch(`/api/operations/${op.id}`, { method: 'PUT', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`;
        addToast(msg, 'error');
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

  const handleDeleteOp = async (opId) => {
    if (!window.confirm('Supprimer cette opération ?')) return;
    const res = await authFetch(`/api/operations/${opId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      addToast(`Erreur suppression ${res.status}`, 'error');
      return;
    }
    addToast('Opération supprimée', 'success');
    setRouting(r => ({ ...r, operations: r.operations.filter(o => o.id !== opId) }));
    setForecasts(prev => { const next = { ...prev }; delete next[opId]; return next; });
    setCompletions(prev => { const next = { ...prev }; delete next[opId]; return next; });
  };

  // ── Sub-modal ───────────────────────────────────────────────────────

  const openModal = (type, operationId, item = null) => {
    const form = type === 'forecast'
      ? { date: item?.plannedDate?.split('T')[0] ?? '', quantity: String(item?.plannedQuantity ?? ''), status: item?.status ?? 'pending' }
      : { date: item?.date?.split('T')[0] ?? '', quantity: String(item?.actualQuantity ?? ''), duration: String(item?.actualDuration ?? '') };
    setModal({ type, mode: item ? 'edit' : 'create', operationId, itemId: item?.id ?? null, form, saving: false });
  };

  const closeModal = () => setModal(null);

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setModal(m => ({ ...m, saving: true }));
    const { type, mode, operationId, itemId, form } = modal;
    const isEdit = mode === 'edit';
    const body = type === 'forecast'
      ? { plannedDate: form.date, plannedQuantity: parseInt(form.quantity, 10), status: form.status }
      : { date: form.date, actualQuantity: parseInt(form.quantity, 10), actualDuration: parseInt(form.duration, 10) };
    const url = isEdit
      ? `/api/operations/${operationId}/${type}s/${itemId}`
      : `/api/operations/${operationId}/${type}s`;
    try {
      const res = await authFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? data.errors.map(x => x.message).join(', ') : data?.error || `Erreur ${res.status}`;
        addToast(msg, 'error');
        setModal(m => ({ ...m, saving: false }));
        return;
      }
      if (type === 'forecast') {
        const isDone = form.status === 'completed' || data.status === 'completed';
        if (isDone) {
          addToast('Opération terminée — stock de la pièce mis à jour', 'success');
          closeModal();
          load();
          window.dispatchEvent(new CustomEvent('parts:added'));
          return;
        } else {
          setForecasts(prev => ({
            ...prev,
            [operationId]: isEdit
              ? (prev[operationId] ?? []).map(f => f.id === itemId ? data : f)
              : [...(prev[operationId] ?? []), data],
          }));
          addToast(`Prévision ${isEdit ? 'modifiée' : 'ajoutée'}`, 'success');
        }
      } else {
        setCompletions(prev => ({
          ...prev,
          [operationId]: isEdit
            ? (prev[operationId] ?? []).map(c => c.id === itemId ? data : c)
            : [...(prev[operationId] ?? []), data],
        }));
        addToast(`Réalisation ${isEdit ? 'modifiée' : 'ajoutée'}`, 'success');
      }
      closeModal();
    } catch {
      addToast('Impossible de contacter le serveur.', 'error');
      setModal(m => ({ ...m, saving: false }));
    }
  };

  const handleDelete = async (type, operationId, itemId) => {
    const label = type === 'forecast' ? 'prévision' : 'réalisation';
    if (!window.confirm(`Supprimer cette ${label} ?`)) return;
    const res = await authFetch(`/api/operations/${operationId}/${type}s/${itemId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      addToast(`Erreur suppression ${res.status}`, 'error');
      return;
    }
    addToast(`${type === 'forecast' ? 'Prévision' : 'Réalisation'} supprimée`, 'success');
    if (type === 'forecast') {
      setForecasts(prev => ({ ...prev, [operationId]: (prev[operationId] ?? []).filter(f => f.id !== itemId) }));
    } else {
      setCompletions(prev => ({ ...prev, [operationId]: (prev[operationId] ?? []).filter(c => c.id !== itemId) }));
    }
  };

  if (loading) return <div className="loading-state"><p>Chargement du détail...</p></div>;
  if (error) return <div className="alert-error">{error}</div>;
  if (!routing) return <div>Aucune donnée</div>;

  const canSupervisor = isAdmin || isSupervisor;

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
          <div className="card-label">Créé le</div>
          <div className="card-value">{routing.createdAt ? new Date(routing.createdAt).toLocaleString() : '—'}</div>
        </div>
      </div>

      <div className="operations-list">
        <h3>Opérations</h3>
        {canSupervisor && (
          <div style={{ marginBottom: 8 }}>
            <button className="btn-primary" onClick={openAdd}>+ Ajouter une opération</button>
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
                    <span className="op-index">{i + 1}</span>
                    <span className="op-title">Opération {i + 1} — {op.label ?? op.name ?? 'Opération'}</span>
                  </div>
                  {canSupervisor && (
                    <div className="op-reorder">
                      <button className="btn-small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn-small" onClick={() => move(i, 1)} disabled={i === routing.operations.length - 1}>↓</button>
                      <button className="btn-icon" title="Modifier" onClick={() => openEditOp(op)}>✎</button>
                      <button className="btn-icon btn-icon-del" title="Supprimer" onClick={() => handleDeleteOp(op.id)}>✕</button>
                    </div>
                  )}
                </div>

                <div className="op-sub-sections">
                  {/* Forecasts */}
                  <div className="op-sub-section">
                    <div className="sub-section-header">
                      <span className="sub-section-title">Prévu :</span>
                      {canSupervisor && (forecasts[op.id] ?? []).length === 0 && (
                        <button className="btn-add-inline" onClick={() => openModal('forecast', op.id)}>
                          + Ajouter une prévision
                        </button>
                      )}
                    </div>
                    {(forecasts[op.id] ?? []).length === 0 ? (
                      <p className="sub-empty">Aucune prévision</p>
                    ) : (
                      <ul className="sub-list">
                        {(forecasts[op.id] ?? []).map(fc => (
                          <li key={fc.id} className="sub-item">
                            <span className="sub-bullet">•</span>
                            <span className="sub-text">
                              {fmtDate(fc.plannedDate)} → {fc.plannedQuantity} unités →{' '}
                              <span className={`status-badge status-${fc.status ?? ''}`}>{STATUS_LABEL[fc.status] ?? fc.status ?? '—'}</span>
                            </span>
                            {canSupervisor && (
                              <span className="sub-actions">
                                <button className="btn-icon" title="Modifier" onClick={() => openModal('forecast', op.id, fc)}>✎</button>
                                <button className="btn-icon btn-icon-del" title="Supprimer" onClick={() => handleDelete('forecast', op.id, fc.id)}>✕</button>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Completions */}
                  <div className="op-sub-section">
                    <div className="sub-section-header">
                      <span className="sub-section-title">Réalisations :</span>
                      {(completions[op.id] ?? []).length === 0 && (
                        <button className="btn-add-inline" onClick={() => openModal('completion', op.id)}>
                          + Ajouter une réalisation
                        </button>
                      )}
                    </div>
                    {(completions[op.id] ?? []).length === 0 ? (
                      <p className="sub-empty">Aucune réalisation</p>
                    ) : (
                      <ul className="sub-list">
                        {(completions[op.id] ?? []).map(cp => (
                          <li key={cp.id} className="sub-item">
                            <span className="sub-bullet">•</span>
                            <span className="sub-text">
                              {fmtDate(cp.date)} → {cp.actualQuantity} unités → {cp.actualDuration} min
                            </span>
                            {canSupervisor && (
                              <span className="sub-actions">
                                <button className="btn-icon" title="Modifier" onClick={() => openModal('completion', op.id, cp)}>✎</button>
                                <button className="btn-icon btn-icon-del" title="Supprimer" onClick={() => handleDelete('completion', op.id, cp.id)}>✕</button>
                              </span>
                            )}
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
                  {workstations.map(w => (
                    <option key={w.id} value={w.id}>{w.label ?? w.name ?? `#${w.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Machine</span>
                <select className="field-input" value={addForm.machineId}
                  onChange={e => setAddForm(f => ({ ...f, machineId: e.target.value }))}>
                  <option value="">-- Aucune --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.label ?? m.name ?? `#${m.id}`}</option>
                  ))}
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
                  {workstations.map(w => (
                    <option key={w.id} value={w.id}>{w.label ?? w.name ?? `#${w.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Machine</span>
                <select className="field-input" value={opModal.form.machineId}
                  onChange={e => setOpModal(m => ({ ...m, form: { ...m.form, machineId: e.target.value } }))}>
                  <option value="">-- Aucune --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.label ?? m.name ?? `#${m.id}`}</option>
                  ))}
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

      {/* ── Prévision / Réalisation modal ── */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              {modal.mode === 'edit'
                ? (modal.type === 'forecast' ? 'Modifier la prévision' : 'Modifier la réalisation')
                : (modal.type === 'forecast' ? 'Nouvelle prévision' : 'Nouvelle réalisation')}
            </h3>
            <form onSubmit={handleModalSubmit}>
              <label className="form-field">
                <span className="field-label">Date *</span>
                <input type="date" className="field-input" required
                  value={modal.form.date}
                  onChange={e => setModal(m => ({ ...m, form: { ...m.form, date: e.target.value } }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Quantité (unités) *</span>
                <input type="number" min="1" className="field-input" required
                  value={modal.form.quantity}
                  onChange={e => setModal(m => ({ ...m, form: { ...m.form, quantity: e.target.value } }))} />
              </label>
              {modal.type === 'forecast' && modal.mode === 'edit' ? (
                <label className="form-field">
                  <span className="field-label">Statut</span>
                  <select className="field-input"
                    value={modal.form.status}
                    onChange={e => setModal(m => ({ ...m, form: { ...m.form, status: e.target.value } }))}>
                    {FORECAST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              ) : modal.type === 'completion' ? (
                <label className="form-field">
                  <span className="field-label">Durée (minutes) *</span>
                  <input type="number" min="1" className="field-input" required
                    value={modal.form.duration}
                    onChange={e => setModal(m => ({ ...m, form: { ...m.form, duration: e.target.value } }))} />
                </label>
              ) : null}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={modal.saving}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={modal.saving}>
                  {modal.saving ? 'Enregistrement...' : modal.mode === 'edit' ? 'Enregistrer' : 'Créer'}
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
