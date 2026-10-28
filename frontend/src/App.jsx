import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getEntities, getToken, clearToken, getUser } from './api.js';
import GlobalSearch from './components/GlobalSearch.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RecordList from './pages/RecordList.jsx';
import RecordDetail from './pages/RecordDetail.jsx';
import RecordNew from './pages/RecordNew.jsx';
import DataQuality from './pages/DataQuality.jsx';
import Worklist from './pages/Worklist.jsx';
import Duplicates from './pages/Duplicates.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  const location = useLocation();
  if (location.pathname === '/login') return <Login />;
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Shell />;
}

function Shell() {
  const [groups, setGroups] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getEntities().then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  function logout() { clearToken(); navigate('/login', { replace: true }); }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">LLCC Data<small>Records dashboard</small></div>
        <nav className="nav-scroll">
          <NavLink to="/" end className="nav-link">Dashboard</NavLink>

          <div className="nav-section">Tools</div>
          <NavLink to="/quality" className="nav-link">Data quality</NavLink>
          <NavLink to="/audit" className="nav-link">Recent changes</NavLink>

          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-section">{g.group}</div>
              {g.entities.map((e) => (
                <NavLink key={e.table} to={`/records/${e.table}`} className="nav-link">{e.label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-row">
            <span className="user-avatar">{(getUser() || '?').charAt(0).toUpperCase()}</span>
            <span className="user-name">{getUser() || 'Signed in'}</span>
          </div>
          <button className="nav-logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <GlobalSearch />
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/records/:table" element={<RecordList />} />
            <Route path="/records/:table/new" element={<RecordNew />} />
            <Route path="/records/:table/:id" element={<RecordDetail />} />
            <Route path="/quality" element={<DataQuality />} />
            <Route path="/quality/:table" element={<Worklist />} />
            <Route path="/duplicates/:table" element={<Duplicates />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
