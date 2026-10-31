import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecords, downloadExport, bulkUpdate } from '../api.js';
import { Cell } from '../format.jsx';
import { Loading } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

const SAVED_KEY = 'llcc_saved_searches';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || {}; } catch { return {}; } };

export default function RecordList() {
  const { table } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [dir, setDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [saved, setSaved] = useState(loadSaved());
  const [bulkCol, setBulkCol] = useState('');
  const [bulkVal, setBulkVal] = useState('');

  useEffect(() => {
    setSearch(''); setPage(1); setSort(null); setDir('asc'); setSelected(new Set());
  }, [table]);

  const load = useCallback(() => {
    setError(null);
    getRecords(table, { page, search, sort, dir }).then(setData).catch((e) => setError(e.message));
  }, [table, page, search, sort, dir]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function toggleSort(col) {
    if (sort === col) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setDir('asc'); }
    setPage(1);
  }

  function toggleRow(id, e) {
    e.stopPropagation();
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // saved searches are scoped per table: { [table]: { [name]: searchTerm } }
  function persist(next) { setSaved(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next)); }
  function saveCurrentSearch() {
    const name = prompt('Name this search:', search);
    if (!name) return;
    persist({ ...saved, [table]: { ...(saved[table] || {}), [name]: search } });
  }
  function removeSaved(name) {
    const forTable = { ...(saved[table] || {}) }; delete forTable[name];
    persist({ ...saved, [table]: forTable });
  }

  async function applyBulk() {
    if (!bulkCol || !selected.size) return;
    if (!confirm(`Set ${bulkCol} = "${bulkVal}" on ${selected.size} record(s)?`)) return;
    try {
      const r = await bulkUpdate(table, [...selected], { [bulkCol]: bulkVal });
      toast.success(`Updated ${r.updated} record${r.updated > 1 ? 's' : ''}`);
      setSelected(new Set()); setBulkCol(''); setBulkVal(''); load();
    } catch (e) { toast.error(e.message); }
  }

  const cols = data?.listColumns || [];
  const savedForTable = Object.entries(saved[table] || {});

  return (
    <>
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{data?.label || table}</h1>
          <p className="page-sub">{data ? `${data.total.toLocaleString()} record${data.total === 1 ? '' : 's'}` : ' '}</p>
        </div>
        <Link className="btn primary" to={`/records/${table}/new`}>+ New</Link>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <button className="btn" onClick={saveCurrentSearch} disabled={!search}>Save search</button>
        <button className="btn" onClick={() => downloadExport(table, search)}>Export CSV</button>
      </div>

      {savedForTable.length > 0 && (
        <div className="saved-row">
          {savedForTable.map(([name, term]) => (
            <span key={name} className="saved-chip">
              <button className="chip-link" onClick={() => { setSearch(term); setPage(1); }}>{name}</button>
              <button className="chip-x" onClick={() => removeSaved(name)}>×</button>
            </span>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} selected</strong>
          <span>set</span>
          <select className="search" style={{ flex: '0 0 160px' }} value={bulkCol} onChange={(e) => setBulkCol(e.target.value)}>
            <option value="">column…</option>
            {data.columns.filter((c) => c !== data.primaryKey).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="search" style={{ flex: '0 0 160px' }} placeholder="value" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} />
          <button className="btn primary" onClick={applyBulk} disabled={!bulkCol}>Apply</button>
          <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="panel">
        {error && <div className="state">Couldn’t load data: {error}</div>}
        {!data && !error && <Loading />}
        {data && (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'default', width: 36 }}></th>
                  {cols.map((c) => (
                    <th key={c} onClick={() => toggleSort(c)}>
                      {c}{sort === c ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const id = row[data.primaryKey];
                  return (
                    <tr key={id} onClick={() => navigate(`/records/${table}/${encodeURIComponent(id)}`)}>
                      <td onClick={(e) => toggleRow(id, e)}>
                        <input type="checkbox" checked={selected.has(id)} readOnly />
                      </td>
                      {cols.map((c) => <td key={c}><Cell column={c} value={row[c]} /></td>)}
                    </tr>
                  );
                })}
                {data.rows.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="state">No matching records.</td></tr>
                )}
              </tbody>
            </table>
            <div className="pagination">
              <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button className="btn" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
