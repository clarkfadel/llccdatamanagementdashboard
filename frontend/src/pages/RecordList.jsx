import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getRecords, downloadExport, bulkUpdate } from '../api.js';
import { Cell } from '../format.jsx';
import { Loading } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';
import { fieldLabel } from '../labels.js';

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
  // filters live in the url (?f_Active=True) so the dashboard can link to a filtered list
  const [params, setParams] = useSearchParams();
  const filterKey = params.toString();

  useEffect(() => {
    setSearch(''); setPage(1); setSort(null); setDir('asc'); setSelected(new Set());
  }, [table]);

  const filters = Object.fromEntries([...new URLSearchParams(filterKey)].filter(([k]) => k.startsWith('f_')));

  const load = useCallback(() => {
    setError(null);
    getRecords(table, { page, search, sort, dir, filters }).then(setData).catch((e) => setError(e.message));
  }, [table, page, search, sort, dir, filterKey]);

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  }
  function clearFilters() { setParams({}, { replace: true }); setPage(1); }

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
    if (!confirm(`Set ${fieldLabel(bulkCol)} to "${bulkVal}" on ${selected.size} record(s)?`)) return;
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
          <p className="page-sub">
            {data?.description && <>{data.description} · </>}
            {data ? `${data.total.toLocaleString()} record${data.total === 1 ? '' : 's'}` : ' '}
          </p>
        </div>
        <Link className="btn primary" to={`/records/${table}/new`}>+ New</Link>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <button className="btn" onClick={saveCurrentSearch} disabled={!search}>Save search</button>
        <button className="btn" onClick={() => downloadExport(table, search, filters)}>Export CSV</button>
      </div>

      {data?.filters?.length > 0 && (
        <FilterBar list={data.filters} values={filters} onChange={setFilter} onClear={clearFilters} />
      )}

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
            {data.columns.filter((c) => c !== data.primaryKey).map((c) => <option key={c} value={c}>{fieldLabel(c)}</option>)}
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
                      {fieldLabel(c, data.primaryKey)}{sort === c ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
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

// filter controls above the table. the filters are set per table in backend entities.js
function FilterBar({ list, values, onChange, onClear }) {
  return (
    <div className="filter-bar">
      {list.map((f) => {
        const key = `f_${f.column}`;
        const label = f.label || fieldLabel(f.column);
        if (f.type === 'range') {
          return (
            <div key={key} className="filter">
              <span>{label}</span>
              <div className="filter-range">
                <input className="cell-input" type="date" value={values[`${key}_from`] || ''}
                  onChange={(e) => onChange(`${key}_from`, e.target.value)} />
                <span className="muted">to</span>
                <input className="cell-input" type="date" value={values[`${key}_to`] || ''}
                  onChange={(e) => onChange(`${key}_to`, e.target.value)} />
              </div>
            </div>
          );
        }
        if (f.type === 'select') {
          return (
            <div key={key} className="filter">
              <span>{label}</span>
              <select className="cell-input" value={values[key] || ''} onChange={(e) => onChange(key, e.target.value)}>
                <option value="">All</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        }
        // yes/no columns are saved as True/False, the linked / has filters use yes/no
        const [yes, no] = f.type === 'yesno' ? ['True', 'False'] : ['yes', 'no'];
        return (
          <div key={key} className="filter">
            <span>{label}</span>
            <select className="cell-input" value={values[key] || ''} onChange={(e) => onChange(key, e.target.value)}>
              <option value="">All</option>
              <option value={yes}>Yes</option>
              <option value={no}>No</option>
            </select>
          </div>
        );
      })}
      {Object.keys(values).length > 0 && (
        <button className="btn small filter-clear" onClick={onClear}>Clear filters</button>
      )}
    </div>
  );
}
