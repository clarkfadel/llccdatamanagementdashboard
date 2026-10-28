import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRecord, updateRecord, linkRecord } from '../api.js';
import { Cell } from '../format.jsx';
import LinkPicker from '../components/LinkPicker.jsx';
import { Loading, ErrorState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

const AUTO = new Set(['TimeStamp', 'Timestamp', 'Created_At', 'Updated_At']);
const META = new Set(['TimeStamp', 'Timestamp', 'Created_At', 'Updated_At', 'UserId']);

export default function RecordDetail() {
  const { table, id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [linking, setLinking] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getRecord(table, id).then((d) => { setData(d); setEditing(false); setDraft({}); })
      .catch((e) => setError(e.message));
  }, [table, id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const changes = {};
      for (const k of Object.keys(draft)) if (draft[k] !== data.record[k]) changes[k] = draft[k];
      const n = Object.keys(changes).length;
      if (n) await updateRecord(table, id, changes);
      toast.success(n ? `Saved ${n} change${n > 1 ? 's' : ''}` : 'No changes to save');
      setSaving(false);
      load();
    } catch (e) { toast.error(e.message); setSaving(false); }
  }

  async function doLink(column, targetId, label) {
    try {
      await linkRecord(table, id, column, targetId);
      setLinking(null);
      toast.success(`Linked ${column}${label ? ` → ${label}` : ''}`);
      load();
    } catch (e) { toast.error(e.message); }
  }

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const outgoingByCol = Object.fromEntries(data.outgoing.map((o) => [o.column, o]));
  const mainCols = data.columns.filter((c) => !META.has(c));
  const metaCols = data.columns.filter((c) => META.has(c));

  function renderValue(col, allowEdit) {
    const fk = outgoingByCol[col];
    const value = data.record[col];
    if (allowEdit && editing && col !== data.primaryKey && !AUTO.has(col)) {
      return (
        <input className="cell-input" value={draft[col] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))} />
      );
    }
    if (fk) {
      return (
        <FkValue fk={fk} value={value} table={table}
          linking={linking === col}
          onStartLink={() => setLinking(col)}
          onCancelLink={() => setLinking(null)}
          onPick={(tid, label) => doLink(col, tid, label)} />
      );
    }
    return <Cell column={col} value={value} />;
  }

  return (
    <>
      <Link to={`/records/${table}`} className="back-link no-print">← {data.label}</Link>
      <div className="page-head-row">
        <div>
          <div className="crumbs">{data.label}</div>
          <h1 className="page-title">{data.title}</h1>
        </div>
        <div className="no-print detail-actions">
          {editing ? (
            <>
              <button className="btn" onClick={() => { setEditing(false); setDraft({}); }}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => window.print()}>Print</button>
              <button className="btn primary" onClick={() => { setEditing(true); setDraft({ ...data.record }); }}>Edit</button>
            </>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <div className="detail-grid">
          {mainCols.map((col) => (
            <Field key={col} label={col}>{renderValue(col, true)}</Field>
          ))}
        </div>
      </div>

      {metaCols.length > 0 && (
        <div className="panel meta-panel">
          <div className="meta-title">Record info</div>
          <div className="detail-grid">
            {metaCols.map((col) => (
              <Field key={col} label={col} muted>{renderValue(col, false)}</Field>
            ))}
          </div>
        </div>
      )}

      {data.incoming.length > 0 && (
        <>
          <h2 className="section-title">Related records</h2>
          {data.incoming.map((grp) => (
            <div key={grp.table} className="related-group panel" style={{ padding: 16 }}>
              <div className="related-head">
                <span className="label">{grp.label}</span>
                <Link className="chip-link" to={`/records/${grp.table}`}>{grp.count} total →</Link>
              </div>
              <table>
                <thead>
                  <tr>{grp.listColumns.map((c) => <th key={c} style={{ cursor: 'default' }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {grp.rows.map((row) => (
                    <tr key={row[grp.primaryKey]}>
                      {grp.listColumns.map((c) => (
                        <td key={c}>
                          {c === grp.primaryKey
                            ? <Link className="chip-link" to={`/records/${grp.table}/${encodeURIComponent(row[c])}`}>{row[c]}</Link>
                            : <Cell column={c} value={row[c]} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function FkValue({ fk, value, linking, onStartLink, onCancelLink, onPick }) {
  if (linking) {
    return <LinkPicker table={fk.table} onCancel={onCancelLink} onPick={(tid, label) => onPick(tid, label)} />;
  }
  if (fk.unmapped || value == null) {
    return (
      <span>
        <span className="unmapped">Unmapped</span>
        <button className="btn small no-print" style={{ marginLeft: 8 }} onClick={onStartLink}>Link…</button>
      </span>
    );
  }
  return (
    <span>
      <Link className="chip-link" to={`/records/${fk.table}/${encodeURIComponent(value)}`}>{fk.display || value}</Link>
      <button className="btn small no-print" style={{ marginLeft: 8 }} onClick={onStartLink}>Change…</button>
    </span>
  );
}

function Field({ label, children, muted }) {
  return (<><div className={`k${muted ? ' meta' : ''}`}>{label}</div><div className="v">{children}</div></>);
}
