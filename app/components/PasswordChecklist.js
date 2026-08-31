'use client'

import { passwordRuleChecks } from '@/lib/passwordPolicy'

export default function PasswordChecklist({ password }) {
  if (!password) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {passwordRuleChecks(password).map(c => (
        <div key={c.key} style={{ fontSize: 12, color: c.ok ? 'var(--green)' : 'var(--text3)' }}>
          {c.ok ? '✓' : '·'} {c.label}
        </div>
      ))}
    </div>
  )
}
