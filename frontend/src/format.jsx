const BOOLEAN_COLUMNS = new Set(['Status', 'Active', 'Funeral', 'withReserved', 'WithContruction']);

export function isUnmappedColumn(col) {
  return /Id$/.test(col) && col !== 'GLCode' && col !== 'SLCode';
}

export function Cell({ column, value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="nullval">—</span>;
  }
  if (value === '-1' && isUnmappedColumn(column)) {
    return <span className="unmapped">Unmapped</span>;
  }
  if (BOOLEAN_COLUMNS.has(column) && (value === 'True' || value === 'False')) {
    return <span className={`badge ${value === 'True' ? 'on' : 'off'}`}>{value === 'True' ? 'Yes' : 'No'}</span>;
  }
  return <>{String(value)}</>;
}

// plain-text version for table cells / titles where JSX isn't wanted
export function display(column, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === '-1' && isUnmappedColumn(column)) return 'Unmapped';
  return String(value);
}
