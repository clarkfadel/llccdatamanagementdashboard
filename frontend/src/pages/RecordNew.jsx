import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecords, createRecord } from '../api.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

// columns we don't ask the user to fill in by hand
const AUTO = new Set(['TimeStamp', 'Timestamp', 'Created_At', 'Updated_At', 'UserId']);

export default function RecordNew() {
  const { table } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRecords(table, { pageSize: 1 }).then(setMeta).catch((e) => setError(e.message));
  }, [table]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { id } = await createRecord(table, values);
      toast.success('Record created');
      navigate(`/records/${table}/${id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (error && !meta) return <ErrorState message={error} />;
  if (!meta) return <Loading />;

  const fields = meta.columns.filter((c) => c !== meta.primaryKey && !AUTO.has(c));

  return (
    <>
      <Link to={`/records/${table}`} className="back-link">← {meta.label}</Link>
      <h1 className="page-title">New {meta.label.replace(/s$/, '')}</h1>
      <p className="page-sub">The ID is assigned automatically. Leave fields blank if unknown.</p>

      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          {fields.map((c) => (
            <label key={c} className="field">
              <span>{c}</span>
              <input
                value={values[c] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => navigate(`/records/${table}`)}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Create record'}</button>
        </div>
      </form>
    </>
  );
}
