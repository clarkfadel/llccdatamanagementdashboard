import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, getQuality, getAudit, getDuplicates, getUser } from '../api.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

const ICONS = { Clients: Icon.clients, Lots: Icon.lots, Deceased: Icon.deceased, Transactions: Icon.transactions };
const ACTION_LABEL = { update: 'Updated', create: 'Created', link: 'Linked', bulk: 'Bulk updated', merge: 'Merged', delete: 'Deleted' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
function today() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const [cards, setCards] = useState(null);
  const [quality, setQuality] = useState([]);
  const [activity, setActivity] = useState([]);
  const [dupCount, setDupCount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard().then((d) => setCards(d.cards)).catch((e) => setError(e.message));
    getQuality().then((d) => setQuality(d.cards)).catch(() => {});
    getAudit(6).then((d) => setActivity(d.changes)).catch(() => {});
    getDuplicates('Clients').then((d) => setDupCount(d.groups.reduce((s, g) => s + g.count, 0))).catch(() => {});
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!cards) return <Loading />;

  const qByTable = Object.fromEntries(quality.map((q) => [q.table, q]));
  const totalUnmapped = quality.reduce((s, q) => s + q.unmappedRows, 0);
  const missingContact = quality.reduce((s, q) => {
    const m = (q.missing || []).find((x) => x.column === 'ContactNo');
    return s + (m ? m.missing : 0);
  }, 0);
  const user = getUser();

  const attention = [
    { icon: Icon.link, title: 'Records need a linked owner', sub: 'Match unmapped records to a Client or Lot',
      count: totalUnmapped, to: '/quality', show: true },
    { icon: Icon.clients, title: 'Clients missing contact info', sub: 'No phone number on file',
      count: missingContact, to: '/records/Clients', show: missingContact > 0 },
    { icon: Icon.copy, title: 'Possible duplicate clients', sub: 'Same name on more than one record',
      count: dupCount, to: '/duplicates/Clients', show: dupCount === null || dupCount > 0 },
  ].filter((a) => a.show);

  return (
    <div className="dash">
      <header className="dash-hero">
        <div>
          <div className="dash-greeting">{greeting()}{user ? `, ${user}` : ''}</div>
          <div className="dash-date">{today()}</div>
        </div>
        <Link to="/quality" className="btn primary dash-cta">
          Review data quality <Icon.arrow width={16} height={16} />
        </Link>
      </header>

      {/* KPI cards */}
      <div className="kpi-grid">
        {cards.map((c) => {
          const q = qByTable[c.table];
          const I = ICONS[c.table] || Icon.lots;
          return (
            <Link key={c.table} to={`/records/${c.table}`} className="kpi">
              <div className="kpi-top">
                <span className="kpi-label">{c.label}</span>
                <span className="kpi-icon"><I /></span>
              </div>
              <div className="kpi-num">{c.count.toLocaleString()}</div>
              {q && (
                <div className="kpi-foot">
                  {q.unmappedRows > 0
                    ? <><span className="kpi-foot-dot" /> {q.unmappedRows.toLocaleString()} to resolve</>
                    : <span className="kpi-foot-ok">All linked</span>}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <div className="dash-cols">
        {/* Needs attention */}
        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">Needs attention</h2>
            <span className="muted">Cleanup tasks</span>
          </div>

          <div className="attention-list">
            {attention.map((a) => {
              const I = a.icon;
              return (
                <Link to={a.to} key={a.title} className="attn-row">
                  <span className="attn-icon"><I /></span>
                  <span className="attn-text">
                    <span className="attn-title">{a.title}</span>
                    <span className="attn-sub">{a.sub}</span>
                  </span>
                  <span className="attn-count">{a.count === null ? '—' : a.count.toLocaleString()}</span>
                  <Icon.arrow width={16} height={16} className="attn-arrow" />
                </Link>
              );
            })}
            {attention.length === 0 && (
              <div className="attn-empty">
                <span className="attn-empty-icon">✓</span> Everything looks clean.
              </div>
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">Recent activity</h2>
            <Link to="/audit" className="chip-link">View all</Link>
          </div>
          <div className="activity-list">
            {activity.length === 0 && <div className="activity-empty muted">No changes yet.</div>}
            {activity.map((a) => (
              <div key={a.id} className="activity-row">
                <span className={`activity-dot ${a.undone ? 'undone' : a.action}`} />
                <div className="activity-body">
                  <div className="activity-text">
                    <span className="activity-verb">{ACTION_LABEL[a.action] || a.action}</span>{' '}
                    {a.row_pk
                      ? <Link className="chip-link" to={`/records/${a.table_name}/${a.row_pk}`}>{a.table_name} #{a.row_pk}</Link>
                      : <span className="activity-target">{a.label || a.table_name}</span>}
                    {a.undone && <span className="activity-undone-tag">undone</span>}
                  </div>
                  <div className="activity-meta">{a.performed_by} · {ago(a.performed_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <section className="quick-actions">
        <QuickAction to="/quality" icon={Icon.link} title="Resolve unmapped" desc="Link records to their owners" />
        <QuickAction to="/duplicates/Clients" icon={Icon.copy} title="Find duplicates" desc="Merge repeated records" />
        <QuickAction to="/audit" icon={Icon.history} title="Recent changes" desc="History & undo" />
      </section>
    </div>
  );
}

function QuickAction({ to, icon: I, title, desc }) {
  return (
    <Link to={to} className="quick-tile">
      <span className="quick-icon"><I /></span>
      <span className="quick-text">
        <span className="quick-title">{title}</span>
        <span className="quick-desc">{desc}</span>
      </span>
    </Link>
  );
}
