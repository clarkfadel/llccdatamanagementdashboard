import { useState } from 'react';
import LinkPicker from './LinkPicker.jsx';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// the right input for the kind of field (link, date, yes/no, number, text).
// onChange gets the new value, and for links also the label of the picked record
export default function FieldInput({ field, value, onChange, linkLabel }) {
  const v = value ?? '';
  const linked = v !== '' && v !== '-1';
  const [picking, setPicking] = useState(false);
  const [wantLink, setWantLink] = useState(linked);

  if (field.kind === 'link') {
    if (picking) {
      return (
        <LinkPicker table={field.target} onCancel={() => setPicking(false)}
          onPick={(id, label) => { setPicking(false); onChange(id, label); }} />
      );
    }
    // staff choose first if they want to link it, the search only shows after "Link to a record"
    return (
      <div className="link-field">
        <select className="cell-input link-choice" value={wantLink ? 'yes' : 'no'}
          onChange={(e) => {
            const yes = e.target.value === 'yes';
            setWantLink(yes);
            if (yes) setPicking(true); else onChange('', null);
          }}>
          <option value="no">No link</option>
          <option value="yes">Link to a record</option>
        </select>
        {wantLink && linked && <span>{linkLabel || `#${v}`}</span>}
        {wantLink && (
          <button type="button" className="btn small" onClick={() => setPicking(true)}>{linked ? 'Change…' : 'Choose…'}</button>
        )}
      </div>
    );
  }

  if (field.kind === 'yesno') {
    return (
      <select className="cell-input" value={v} required={field.required} onChange={(e) => onChange(e.target.value)}>
        <option value="">-</option>
        <option value="True">Yes</option>
        <option value="False">No</option>
      </select>
    );
  }

  // old records sometimes have dates in other formats, keep those as text so nothing is lost
  if (field.kind === 'date' && (v === '' || ISO_DATE.test(v))) {
    return <input className="cell-input" type="date" value={v} required={field.required} onChange={(e) => onChange(e.target.value)} />;
  }

  if (field.kind === 'number') {
    return <input className="cell-input" type="number" step="any" min="0" value={v} required={field.required} onChange={(e) => onChange(e.target.value)} />;
  }

  return <input className="cell-input" value={v} required={field.required} onChange={(e) => onChange(e.target.value)} />;
}
