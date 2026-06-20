import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import { useToast, ToastContainer } from '../components/Toast';
import './Routings.css';

export default function RoutingDetail({ id, isAdmin, isSupervisor, onBack }) {
  const { toasts, addToast, removeToast } = useToast();
  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workstations, setWorkstations] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', unitTime: '', workstationId: '', machineId: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // load routing, workstations and machines in parallel
      const [rRes, wRes, mRes] = await Promise.all([
        authFetch(`/api/routings/${id}`),
        authFetch('/api/workstations'),
        authFetch('/api/machines'),
      ]);

      if (!rRes.ok) throw new Error(`Erreur routings ${rRes.status}`);
      const rJson = await rRes.json();
      setRouting(rJson);

      if (wRes.ok) {
        const wJson = await wRes.json();
        setWorkstations(Array.isArray(wJson) ? wJson : (wJson['hydra:member'] ?? wJson.items ?? wJson.data ?? []));
      } else {
        console.error('Erreur chargement postes', wRes.status);
      }

      if (mRes.ok) {
        const mJson = await mRes.json();
        setMachines(Array.isArray(mJson) ? mJson : (mJson['hydra:member'] ?? mJson.items ?? mJson.data ?? []));
      } else {
        console.error('Erreur chargement machines', mRes.status);
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
    // Note: backend reorder endpoint not provided; this only updates UI.
  };

  const openAdd = () => { setShowAdd(true); setAddForm({ label: '', unitTime: '', workstationId: '', machineId: '' }); setError(''); };
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
      closeAdd();
    } catch (err) {
      addToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="loading-state"><p>Chargement du détail...</p></div>;

  if (error) return <div className="alert-error">{error}</div>;

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
          <div className="card-label">Créé le</div>
          <div className="card-value">{routing.createdAt ? new Date(routing.createdAt).toLocaleString() : '—'}</div>
        </div>
      </div>

      <div className="operations-list">
        <h3>Opérations</h3>
        {(isAdmin || isSupervisor) && (
          <div style={{ marginBottom: 8 }}>
            <button className="btn-primary" onClick={openAdd}>+ Ajouter une opération</button>
          </div>
        )}
        {(routing.operations || []).length === 0 ? (
          <div className="empty-state">Aucune opération</div>
        ) : (
          <ul>
            {routing.operations.map((op, i) => (
              <li key={op.id} className="operation-row">
                <div className="op-index">{i + 1}</div>
                <div className="op-desc">{op.label ?? op.name ?? 'Opération'}</div>
                {(isAdmin || isSupervisor) && (
                  <div className="op-actions">
                    <button className="btn-small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                    <button className="btn-small" onClick={() => move(i, 1)} disabled={i === (routing.operations.length - 1)}>↓</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Nouvelle opération</h3>
            <form onSubmit={handleAddSubmit}>
              <label className="form-field">
                <span className="field-label">Label *</span>
                <input className="field-input" required value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Temps unitaire *</span>
                <input type="number" step="any" className="field-input" required value={addForm.unitTime} onChange={e => setAddForm(f => ({ ...f, unitTime: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Poste de travail *</span>
                <select className="field-input" required value={addForm.workstationId} onChange={e => setAddForm(f => ({ ...f, workstationId: e.target.value }))}>
                  <option value="">-- Sélectionner un poste --</option>
                  {workstations.map(w => (
                    <option key={w.id} value={w.id}>{w.label ?? w.name ?? `#${w.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Machine</span>
                <select className="field-input" value={addForm.machineId} onChange={e => setAddForm(f => ({ ...f, machineId: e.target.value }))}>
                  <option value="">-- Aucune --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.label ?? m.name ?? `#${m.id}`}</option>
                  ))}
                </select>
              </label>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeAdd} disabled={adding}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Enregistrement...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="btn-secondary" onClick={onBack}>Retour</button>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
