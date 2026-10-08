import { useState } from 'react';
import { PROJECT, TEAM, GUIDE } from '../developedBy.js';
import { Icon } from '../components/common/Icons.jsx';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Photo with a graceful fallback to an initials avatar when the file is missing. */
function Avatar({ name, photo, size = 140 }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--accent-soft)' };
  if (photo && !failed) return <img src={photo} alt={`Photograph of ${name}`} style={style} onError={() => setFailed(true)} />;
  return (
    <div aria-label={`${name} (no photograph)`} role="img" style={{ ...style, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: size * 0.34, fontWeight: 800 }}>
      {initials(name)}
    </div>
  );
}

export default function DevelopedByPage() {
  return (
    <main className="page" aria-labelledby="tab-about" style={{ maxWidth: 960 }}>
      <section style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 8 }} aria-hidden="true">
          <Icon name="lock" size={36} />
        </div>
        <h1 style={{ margin: '4px 0 6px', fontSize: 30 }}>{PROJECT.title}</h1>
        <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 16 }}>{PROJECT.subtitle}</p>
        <p style={{ margin: '6px 0 0', color: 'var(--fg-muted)' }}>{PROJECT.course} · {PROJECT.year}</p>
      </section>

      <section aria-labelledby="developed-by-heading" style={{ marginBottom: 32 }}>
        <h2 id="developed-by-heading" style={{ fontSize: 20, margin: '0 0 14px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Developed by</h2>
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 280px))', justifyContent: 'center' }}>
          {TEAM.map((m) => (
            <div className="card" key={m.name} style={{ alignItems: 'center', textAlign: 'center', padding: 22 }}>
              <Avatar name={m.name} photo={m.photo} />
              <h3 style={{ fontSize: 18, marginTop: 6 }}>{m.name}</h3>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--fg)' }}>Reg. No. {m.register}</p>
              {m.role && <span className="chip chip-active">{m.role}</span>}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="guided-by-heading">
        <h2 id="guided-by-heading" style={{ fontSize: 20, margin: '0 0 14px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Guided by</h2>
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 18, padding: 20, maxWidth: 560, margin: '0 auto' }}>
          <Avatar name={GUIDE.name} photo={GUIDE.photo} size={96} />
          <div>
            <h3 style={{ fontSize: 20, margin: 0 }}>{GUIDE.name}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 15 }}>{GUIDE.title}</p>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--fg-muted)' }}>
          This project was made under the guidance of <strong style={{ color: 'var(--fg)' }}>{GUIDE.name}</strong>, {GUIDE.title}, as part of the {PROJECT.course} course.
        </p>
      </section>
    </main>
  );
}
