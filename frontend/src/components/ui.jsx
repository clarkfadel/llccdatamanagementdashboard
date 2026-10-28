// loading, empty, error components

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state">
      <span className="spinner" /> {label}
    </div>
  );
}

export function EmptyState({ icon = '◍', title, hint }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  );
}

export function ErrorState({ message }) {
  return <EmptyState icon="⚠" title="Couldn’t load this" hint={message} />;
}
