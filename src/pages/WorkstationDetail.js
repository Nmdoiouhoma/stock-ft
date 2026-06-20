import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import '../components/Parts.css';

export default function WorkstationDetail({ id, onBack }) {
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                </tr>
              </thead>
              <tbody>
                {(ws.machines || []).map(m => (
                  <tr key={m.id}>
                    <td className="cell-reference">{m.reference ?? '—'}</td>
                    <td>{m.label ?? '—'}</td>
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
    </div>
  );
}
