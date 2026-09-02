'use client'

// Champs partagés entre TimerModal (chrono autonome) et TimerConfigEditor (config d'un timer
// lié à un exercice/circuit dans le constructeur de programme).

export function HMSField({ label, seconds, onChange, min = 0 }) {
  const total = Math.max(min, seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  const set = (nh, nm, ns) => onChange(Math.max(min, nh * 3600 + nm * 60 + ns))

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { unit: 'h', value: h, onChange: v => set(v, m, s) },
          { unit: 'min', value: m, onChange: v => set(h, v, s) },
          { unit: 'sec', value: s, onChange: v => set(h, m, v) },
        ].map(u => (
          <div key={u.unit} style={{ flex: 1 }}>
            <input type="number" min={0} value={u.value} onChange={e => u.onChange(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
            <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{u.unit}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NumberField({ label, value, onChange, step = 1, min = 0 }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>−</button>
        <input type="number" value={value} onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
          style={{ flex: 1, boxSizing: 'border-box', padding: '10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={() => onChange(value + step)} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  )
}
