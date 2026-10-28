import { useEffect, useState } from 'react';

// toast notifications
let listeners = [];
let items = [];
let seq = 0;
const emit = () => listeners.forEach((l) => l([...items]));

export const toast = {
  show(message, type = 'info', ms = 3200) {
    const t = { id: ++seq, message, type };
    items = [...items, t];
    emit();
    setTimeout(() => toast.dismiss(t.id), ms);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error', 5000); },
  info(m) { this.show(m, 'info'); },
  dismiss(id) { items = items.filter((t) => t.id !== id); emit(); },
};

export function ToastHost() {
  const [list, setList] = useState([]);
  useEffect(() => {
    listeners.push(setList);
    return () => { listeners = listeners.filter((l) => l !== setList); };
  }, []);
  return (
    <div className="toast-host">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => toast.dismiss(t.id)}>
          {t.type === 'success' && <span className="toast-icon">✓</span>}
          {t.type === 'error' && <span className="toast-icon">!</span>}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
