import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getUnmapped, linkRecord } from '../api.js';
import { Cell } from '../format.jsx';
import LinkPicker from '../components/LinkPicker.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';
import { fieldLabel, relationLabel } from '../labels.js';

// maps an FK column to the table it should be linked to, from the API's fkColumns
function targetFor(fkColumns, column) {
  return fkColumns.find((f) => f.column === column)?.target;
}

export default function Worklist() {
  const { table } = useParams();
  const [params, setParams] = useSearchParams();
  const column = params.get('column') || undefined;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(null); // row id being linked
  const [done, setDone] = useState({});         // id -> label just linked

  // reset when switching tabs
  useEffect(() => { setPage(1); setDone({}); setPicking(null); }, [table, column]);

  const load = useCallback(() => {
    setError(null);
    getUnmapped(table, { column, page }).then(setData).catch((e) => setError(e.message));
  }, [table, column, page]);
  useEffect(() => { load(); }, [load]);

  async function pick(rowId, targetId, label) {
    try {
      await linkRecord(table, rowId, data.column, targetId);
      setPicking(null);
      setDone((d) => ({ ...d, [rowId]: label }));
      toast.success(`Linked to ${label}`);
    } catch (e) { toast.error(e.message); }
  }

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const target = targetFor(data.fkColumns, data.column);

  if (!data.fkColumns.length || !data.column) {
    return (
      <>
        <Link to="/quality" className="back-link">← Data quality</Link>
        <h1 className="page-title">Resolve unmapped: {data.label}</h1>
        <div className="panel">
          <EmptyState icon="✓" title="Nothing to resolve here"
            hint={`${data.label} has no linkable fields to clean up.`} />
        </div>
      </>
    );
  }

  return (
    <>
      <Link to="/quality" className="back-link">← Data quality</Link>
      <h1 className="page-title">Resolve unmapped: {data.label}</h1>
      <p className="page-sub">
        Pick the correct <strong>{relationLabel(data.column)}</strong> for each row.
      </p>

      <div className="tabs">
        {data.fkColumns.map((f) => (
          <button
            key={f.column}
            className={`tab ${f.column === data.column ? 'active' : ''}`}
            onClick={() => setParams({ column: f.column })}
          >
            {relationLabel(f.column)}
          </button>
        ))}
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              {data.listColumns.map((c) => <th key={c} style={{ cursor: 'default' }}>{fieldLabel(c)}</th>)}
              <th style={{ cursor: 'default' }}>Link to {relationLabel(data.column)}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const id = row[data.primaryKey];
              return (
                <tr key={id}>
                  {data.listColumns.map((c) => <td key={c}><Cell column={c} value={row[c]} /></td>)}
                  <td>
                    {done[id] ? (
                      <span className="badge on">Linked: {done[id]}</span>
                    ) : picking === id && target ? (
                      <LinkPicker table={target} onCancel={() => setPicking(null)}
                        onPick={(tid, label) => pick(id, tid, label)} />
                    ) : (
                      <button className="btn" disabled={!target} onClick={() => setPicking(id)}>Link…</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data.rows.length === 0 && (
              <tr><td colSpan={data.listColumns.length + 1} className="state">Nothing left unmapped here. 🎉</td></tr>
            )}
          </tbody>
        </table>
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {data.page} of {data.totalPages} · {data.total} unmapped</span>
          <button className="btn" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}
