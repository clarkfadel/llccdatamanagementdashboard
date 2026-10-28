import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDuplicates, mergeRecords } from '../api.js';
import { Cell } from '../format.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

export default function Duplicates() {
  const { table } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getDuplicates(table).then(setData).catch((e) => setError(e.message));
  }, [table]);
  useEffect(() => { load(); }, [load]);

  async function merge(keepId, dropId) {
    if (!confirm(`Merge #${dropId} into #${keepId}? References move to #${keepId} and #${dropId} is deleted.`)) return;
    setBusy(dropId);
    try {
      const r = await mergeRecords(table, dropId, keepId);
      toast.success(`Merged #${dropId} into #${keepId} (${r.repointedReferences} references moved)`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <Link to="/quality" className="back-link">← Data quality</Link>
      <h1 className="page-title">Possible duplicates: {data.label}</h1>
      <p className="page-sub">Records that share the same name. Keep one, merge the other into it.</p>

      {data.groups.length === 0 && (
        <div className="panel"><EmptyState icon="✓" title="No likely duplicates" hint="No records share the same name." /></div>
      )}

      {data.groups.map((g, i) => (
        <div key={i} className="panel dup-group">
          <div className="dup-key">{g.count} records · “{g.key.replace(/\|/g, ' ')}”</div>
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>ID</th>
                {g.listColumns.map((c) => <th key={c} style={{ cursor: 'default' }}>{c}</th>)}
                <th style={{ cursor: 'default' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {g.records.map((r) => {
                const id = r[g.primaryKey];
                return (
                  <tr key={id}>
                    <td><Link className="chip-link" to={`/records/${table}/${id}`}>#{id}</Link></td>
                    {g.listColumns.map((c) => <td key={c}><Cell column={c} value={r[c]} /></td>)}
                    <td>
                      {g.records.filter((o) => o[g.primaryKey] !== id).map((o) => (
                        <button key={o[g.primaryKey]} className="btn small" disabled={busy === id}
                          onClick={() => merge(o[g.primaryKey], id)}>
                          merge into #{o[g.primaryKey]}
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
