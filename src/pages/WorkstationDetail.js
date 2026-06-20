import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import '../components/Parts.css';

export default function WorkstationDetail({ id, onBack, isAdmin }) {
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add machine modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [allMachines, setAllMachines] = useState([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/workstations/${id}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setWs(json);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openAddModal = async () => {
    setActionError('');
    setSelectedMachineId('');
    setShowAddModal(true);
    setLoadingMachines(true);
    try {
      const res = await authFetch('/api/machines');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json['hydra:member'] ?? json.items ?? json.data ?? []);
      setAllMachines(list);
    } catch (e) {
      setActionError(e.message || 'Impossible de charger les machines');
    } finally {
      setLoadingMachines(false);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setActionError('');
  };

  const availableMachines = allMachines.filter(
    m => !(ws?.machines || []).some(wm => wm.id === m.id)
  );

  const handleAddMachine = async (e) => {
    e.preventDefault();
    if (!selectedMachineId) return;
    setSaving(true); setActionError('');
    try {
      const res = await authFetch(`/api/workstations/${id}/machines/${selectedMachineId}`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      setShowAddModal(false);
      await load();
    } catch (e) {
      setActionError(e.message || 'Erreur lors de l\'association');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMachine = async (machineId) => {
    if (!window.confirm('Retirer cette machine du poste de travail ?')) return;
    setActionError('');
    try {
      const res = await authFetch(`/api/workstations/${id}/machines/${machineId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      await load();
    } catch (e) {
      setActionError(e.message || 'Erreur lors du retrait');
    }
  };

  if (loading) return <div className="loading-state"><p>Chargement du poste...</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!ws)     return <div className="empty-block">Aucune donnée</div>;

  const machineCount = (ws.machines || []).length;
  const workerCount  = (ws.qualifiedUsers || []).length;

  return (
    <div className="parts-container">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div>
          <h2 className="parts-title">{ws.label}</h2>
          <p className="parts-subtitle">
            Poste de travail{ws.reference ? ` · ${ws.reference}` : ''}
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {ws.reference && (
          <div className="dashboard-card">
            <div className="dashboard-label">Référence</div>
            <div className="dashboard-value-small">{ws.reference}</div>
          </div>
        )}
        {ws.capacity != null && (
          <div className="dashboard-card">
            <div className="dashboard-label">Capacité</div>
            <div className="dashboard-value">{ws.capacity}</div>
          </div>
        )}
        <div className="dashboard-card">
          <div className="dashboard-label">Machines</div>
          <div className="dashboard-value">{machineCount}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Ouvriers qualifiés</div>
          <div className="dashboard-value">{workerCount}</div>
        </div>
      </div>

      {actionError && <div className="alert-error">{actionError}</div>}

      {ws.description && (
        <div className="detail-section">
          <h3 className="section-title">Description</h3>
          <p className="detail-description">{ws.description}</p>
        </div>
      )}

      <div className="detail-section">
        <h3 className="section-title">
          Machines compatibles
          <span className="count-badge">{machineCount}</span>
          {isAdmin && (
            <button
              className="btn-primary"
              style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px' }}
              onClick={openAddModal}
            >
              + Associer une machine
            </button>
          )}
        </h3>
        {machineCount === 0 ? (
          <div className="empty-block">Aucune machine compatible</div>
        ) : (
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(ws.machines || []).map(m => (
                  <tr key={m.id}>
                    <td className="cell-reference">{m.reference ?? '—'}</td>
                    <td>{m.label ?? '—'}</td>
                    {isAdmin && (
                      <td>
                        <div className="cell-actions">
                          <button
                            className="btn-delete"
                            onClick={() => handleRemoveMachine(m.id)}
                          >
                            Retirer
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3 className="section-title">
          Ouvriers qualifiés
          <span className="count-badge">{workerCount}</span>
        </h3>
        {workerCount === 0 ? (
          <div className="empty-block">Aucun ouvrier qualifié</div>
        ) : (
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {(ws.qualifiedUsers || []).map(u => (
                  <tr key={u.id}>
                    <td>{`${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.email}</td>
                    <td className="cell-reference">{u.email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Associer une machine</h3>

            {actionError && <div className="alert-error">{actionError}</div>}

            <form onSubmit={handleAddMachine}>
              <label className="form-field">
                <span className="field-label">Machine</span>
                {loadingMachines ? (
                  <p style={{ color: '#64748b', fontSize: 14 }}>Chargement...</p>
                ) : availableMachines.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 14 }}>
                    Toutes les machines sont déjà associées à ce poste.
                  </p>
                ) : (
                  <select
                    className="field-input"
                    value={selectedMachineId}
                    onChange={e => setSelectedMachineId(e.target.value)}
                    required
                  >
                    <option value="">— Sélectionner une machine —</option>
                    {availableMachines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.reference ? `[${m.reference}] ` : ''}{m.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeAddModal}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || loadingMachines || availableMachines.length === 0 || !selectedMachineId}
                >
                  {saving ? 'Association...' : 'Associer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
