import { useState, useEffect, useRef } from 'react';
import { lookup } from '../api.js';

// search-and-pick a record from `table`; calls onPick(id, label)
export default function LinkPicker({ table, onPick, onCancel, placeholder }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      lookup(table, q).then((d) => setItems(d.items)).catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [table, q]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onCancel?.(); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onCancel]);

  return (
    <div className="link-picker" ref={ref}>
      <input
        className="search"
        autoFocus
        placeholder={placeholder || `Find ${table}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="link-picker-list">
        {items.length === 0 && <div className="search-empty">No matches.</div>}
        {items.map((it) => (
          <div key={it.id} className="search-item" onMouseDown={() => onPick(it.id, it.label)}>
            {it.label} <span className="muted">#{it.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
