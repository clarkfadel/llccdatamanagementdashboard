import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getQuality } from '../api.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { fieldLabel, relationLabel } from '../labels.js';

const ICONS = { Clients: Icon.clients, Lots: Icon.lots, Deceased: Icon.deceased, Transactions: Icon.transactions };

export default function DataQuality() {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getQuality().then((d) => setCards(d.cards)).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!cards) return <Loading />;

  const totalToResolve = cards.reduce((s, c) => s + c.unmappedRows, 0);

  return (
    <>
      <h1 className="page-title">Data quality</h1>
      <p className="page-sub">
        {totalToResolve.toLocaleString()} records still need a linked owner. Resolve them below.
      </p>

      <div className="dq-grid">
        {cards.map((c) => {
          const I = ICONS[c.table] || Icon.lots;
          const links = c.perColumn.filter((p) => p.unmapped > 0);
          const missing = c.missing.filter((m) => m.missing > 0);
          const clean = links.length === 0 && missing.length === 0;
          return (
            <section key={c.table} className="panel dq-card">
              <div className="dq-head">
                <span className="dq-icon"><I /></span>
                <div className="dq-head-text">
                  <div className="dq-title">{c.label}</div>
                  <div className="dq-sub">{c.total.toLocaleString()} records</div>
                </div>
                <span className={`dq-status ${c.unmappedRows > 0 ? 'warn' : 'ok'}`}>
                  {c.unmappedRows > 0 ? `${c.unmappedRows.toLocaleString()} to resolve` : 'All linked'}
                </span>
              </div>

              {links.length > 0 && (
                <div className="dq-section">
                  <div className="dq-section-title">Unmapped links</div>
                  {links.map((p) => (
                    <div key={p.column} className="dq-link-row">
                      <span className="dq-link-icon"><Icon.link width={16} height={16} /></span>
                      <span className="dq-link-main">
                        <span className="dq-link-name">{relationLabel(p.column)}</span>
                        <span className="dq-link-desc">
                          <strong>{p.unmapped.toLocaleString()}</strong> records have no {relationLabel(p.column).toLowerCase()} yet
                        </span>
                      </span>
                      <Link className="btn small primary" to={`/quality/${c.table}?column=${p.column}`}>Resolve</Link>
                    </div>
                  ))}
                </div>
              )}

              {missing.length > 0 && (
                <div className="dq-section">
                  <div className="dq-section-title">Missing information</div>
                  <div className="dq-chips">
                    {missing.map((m) => (
                      <span key={m.column} className="dq-chip">
                        {fieldLabel(m.column)}
                        <span className="dq-chip-count">{m.missing.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {clean && (
                <div className="dq-clean"><span className="dq-clean-icon">✓</span> No unmapped links or missing fields.</div>
              )}

              <div className="dq-foot">
                <Link className="dq-foot-link" to={`/duplicates/${c.table}`}>
                  <Icon.copy width={15} height={15} /> Find duplicates
                </Link>
                <Link className="dq-foot-link" to={`/records/${c.table}`}>
                  Browse all <Icon.arrow width={15} height={15} />
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
