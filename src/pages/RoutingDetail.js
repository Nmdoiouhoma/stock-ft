import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth';
import './Routings.css';

export default function RoutingDetail({ id, onBack }) {
  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/routings/${id}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setRouting(await res.json());
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
        {(routing.operations || []).length === 0 ? (
          <div className="empty-state">Aucune opération</div>
        ) : (
          <ul>
            {routing.operations.map((op, i) => (
              <li key={op.id} className="operation-row">
                <div className="op-index">{i + 1}</div>
                <div className="op-desc">{op.label ?? op.name ?? 'Opération'}</div>
                <div className="op-actions">
                  <button className="btn-small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn-small" onClick={() => move(i, 1)} disabled={i === (routing.operations.length - 1)}>↓</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn-secondary" onClick={onBack}>Retour</button>
      </div>
    </div>
  );
}
