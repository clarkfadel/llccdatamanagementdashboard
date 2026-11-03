import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecords, createRecord } from '../api.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';
import FieldInput from '../components/FieldInput.jsx';
import { fieldLabel } from '../labels.js';

export default function RecordNew() {
  const { table } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [values, setValues] = useState({});
  const [linkLabels, setLinkLabels] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues({}); setLinkLabels({}); setError(null); setMeta(null);
    getRecords(table, { pageSize: 1 }).then(setMeta).catch((e) => setError(e.message));
  }, [table]);

  // system fields (timestamps, encoded by) are filled in automatically
  const fields = (meta?.fields || []).filter((f) => f.kind !== 'auto');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      // empty links are saved as -1 like the rest of the db, so they show up in "Link records"
      const data = { ...values };
      for (const f of fields) if (f.kind === 'link' && !data[f.name]) data[f.name] = '-1';
      const { id } = await createRecord(table, data);
      toast.success('Record created');
      navigate(`/records/${table}/${id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  function setField(name, value, label) {
    setValues((v) => ({ ...v, [name]: value }));
    if (label !== undefined) setLinkLabels((l) => ({ ...l, [name]: label }));
  }

  if (error && !meta) return <ErrorState message={error} />;
  if (!meta) return <Loading />;

  return (
    <>
      <Link to={`/records/${table}`} className="back-link">← {meta.label}</Link>
      <h1 className="page-title">New record: {meta.label}</h1>
      <p className="page-sub">
        The ID is given automatically. Fields with <span className="req">*</span> are required,
        the rest can be left blank and filled in later.
      </p>

      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          {fields.map((f) => {
            // a div for links, so clicking the label doesn't press the Choose button
            const Wrap = f.kind === 'link' ? 'div' : 'label';
            return (
              <Wrap key={f.name} className="field">
                <span>{fieldLabel(f.name)}{f.required && <span className="req"> *</span>}</span>
                <FieldInput field={f} value={values[f.name]} linkLabel={linkLabels[f.name]}
                  onChange={(value, label) => setField(f.name, value, label)} />
              </Wrap>
            );
          })}
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
