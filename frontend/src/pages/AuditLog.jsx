import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAudit, undoChange } from '../api.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

const UNDOABLE = new Set(['update', 'create', 'delete', 'link', 'bulk']);

export default function AuditLog() {
  const [changes, setChanges] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getAudit(80).then((d) => setChanges(d.changes)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function undo(id) {
    try { await undoChange(id); toast.success('Change undone'); load(); }
    catch (e) { toast.error(e.message); }
  }

  if (error) return <ErrorState message={error} />;
  if (!changes) return <Loading />;

  return (
    <>
      <h1 className="page-title">Recent changes</h1>
      <p className="page-sub">Every edit made through the dashboard. Undo restores the previous value.</p>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'default' }}>When</th>
              <th style={{ cursor: 'default' }}>Who</th>
              <th style={{ cursor: 'default' }}>Action</th>
              <th style={{ cursor: 'default' }}>Record</th>
              <th style={{ cursor: 'default' }}></th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.performed_at).toLocaleString()}</td>
                <td>{c.performed_by}</td>
                <td><span className={`badge ${c.undone ? 'off' : 'on'}`}>{c.action}</span></td>
                <td>
                  {c.row_pk
                    ? <Link className="chip-link" to={`/records/${c.table_name}/${c.row_pk}`}>{c.table_name} #{c.row_pk}</Link>
                    : <span className="muted">{c.table_name} (bulk)</span>}
                </td>
                <td>
                  {c.undone
                    ? <span className="muted">undone</span>
                    : UNDOABLE.has(c.action)
                      ? <button className="btn small" onClick={() => undo(c.id)}>Undo</button>
                      : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
            {changes.length === 0 && <tr><td colSpan={5} className="state">No changes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
