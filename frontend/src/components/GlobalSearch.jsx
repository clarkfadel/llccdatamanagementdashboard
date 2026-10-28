import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { search } from '../api.js';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setGroups([]); return; }
    const t = setTimeout(() => {
      search(q).then((d) => { setGroups(d.groups); setOpen(true); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(table, id) {
    setOpen(false); setQ('');
    navigate(`/records/${table}/${encodeURIComponent(id)}`);
  }

  const empty = q.trim() && groups.length === 0;

  return (
    <div className="global-search" ref={boxRef}>
      <input
        className="search"
        placeholder="Search people, lots, transactions…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => groups.length && setOpen(true)}
      />
      {open && (groups.length > 0 || empty) && (
        <div className="search-dropdown">
          {empty && <div className="search-empty">No matches for “{q}”.</div>}
          {groups.map((g) => (
            <div key={g.table} className="search-group">
              <div className="search-group-label">{g.label}</div>
              {g.items.map((it) => (
                <div key={it.id} className="search-item" onMouseDown={() => go(g.table, it.id)}>
                  {it.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
