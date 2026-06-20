import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import '../components/Parts.css';

export default function MachineDetail({ id, onBack }) {
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/machines/${id}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setMachine(json);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-state"><p>Chargement de la machine...</p></div>;
  if (error)   return <div className="alert-error">{error}</div>;
  if (!machine) return <div className="empty-block">Aucune donnée</div>;

  const workstations = machine.workstations || [];

  return (
    <div className="parts-container">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div>
          <h2 className="parts-title">{machine.label}</h2>
          <p className="parts-subtitle">
            Machine{machine.reference ? ` · ${machine.reference}` : ''}
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {machine.reference && (
          <div className="dashboard-card">
            <div className="dashboard-label">Référence</div>
            <div className="dashboard-value-small">{machine.reference}</div>
          </div>
        )}
        <div className="dashboard-card">
          <div className="dashboard-label">Postes de travail</div>
          <div className="dashboard-value">{workstations.length}</div>
        </div>
      </div>

      {machine.description && (
        <div className="detail-section">
          <h3 className="section-title">Description</h3>
          <p className="detail-description">{machine.description}</p>
        </div>
      )}

      <div className="detail-section">
        <h3 className="section-title">
          Postes de travail compatibles
          <span className="count-badge">{workstations.length}</span>
        </h3>
        {workstations.length === 0 ? (
          <div className="empty-block">Aucun poste de travail compatible</div>
        ) : (
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                </tr>
              </thead>
              <tbody>
                {workstations.map(ws => (
                  <tr key={ws.id}>
                    <td className="cell-reference">{ws.reference ?? '—'}</td>
                    <td>{ws.label ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
