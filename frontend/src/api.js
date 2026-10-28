const TOKEN_KEY = 'llcc_token';
const USER_KEY = 'llcc_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
export const getUser = () => localStorage.getItem(USER_KEY);

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // token expired so go back to login. skip this for /login itself so the
  // wrong password message still shows
  if (res.status === 401 && path !== '/login') {
    clearToken();
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// auth
export async function login(username, password) {
  const d = await req('/login', { method: 'POST', body: { username, password } });
  setToken(d.token);
  if (d.user?.name) localStorage.setItem(USER_KEY, d.user.name);
  return d.user;
}

// browse
export const getDashboard = () => req('/dashboard');
export const getEntities = () => req('/entities');
export const getRecord = (t, id) => req(`/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`);
export function getRecords(table, { page = 1, pageSize = 25, search = '', sort, dir } = {}) {
  const q = new URLSearchParams({ page, pageSize });
  if (search) q.set('search', search);
  if (sort) q.set('sort', sort);
  if (dir) q.set('dir', dir);
  return req(`/records/${encodeURIComponent(table)}?${q}`);
}

// features
export const search = (q) => req(`/search?q=${encodeURIComponent(q)}`);
export const lookup = (table, q) => req(`/lookup/${encodeURIComponent(table)}?q=${encodeURIComponent(q || '')}`);
export const getQuality = () => req('/quality');
export const getUnmapped = (table, { column, page = 1 } = {}) => {
  const q = new URLSearchParams({ page });
  if (column) q.set('column', column);
  return req(`/quality/unmapped/${encodeURIComponent(table)}?${q}`);
};
export const getDuplicates = (table) => req(`/duplicates/${encodeURIComponent(table)}`);
export const exportUrl = (table, search = '') =>
  `/api/records/${encodeURIComponent(table)}/export${search ? `?search=${encodeURIComponent(search)}` : ''}`;

// writes
export const updateRecord = (t, id, changes) =>
  req(`/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: { changes } });
export const createRecord = (t, data) =>
  req(`/records/${encodeURIComponent(t)}`, { method: 'POST', body: { data } });
export const linkRecord = (t, id, column, value) =>
  req(`/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}/link`, { method: 'POST', body: { column, value } });
export const bulkUpdate = (t, ids, changes) =>
  req(`/records/${encodeURIComponent(t)}/bulk`, { method: 'POST', body: { ids, changes } });
export const mergeRecords = (t, sourceId, targetId) =>
  req(`/records/${encodeURIComponent(t)}/merge`, { method: 'POST', body: { sourceId, targetId } });

// audit
export const getAudit = (limit = 50) => req(`/audit?limit=${limit}`);
export const undoChange = (id) => req(`/audit/${id}/undo`, { method: 'POST' });

// export download needs the auth header, so fetch as a blob
export async function downloadExport(table, searchTerm = '') {
  const res = await fetch(exportUrl(table, searchTerm), {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${table}.csv`; a.click();
  URL.revokeObjectURL(url);
}
