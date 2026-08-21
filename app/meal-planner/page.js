'use client'

import { useState } from 'react'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { searchFood, generatePlan, OLIVE_OIL, ACTIVITY_LEVELS, GOALS, computeCalorieTarget } from '@/lib/mealPlanner'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  border: '1px solid var(--border2)', borderRadius: 6,
  fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit',
}
const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }

function FoodPicker({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  async function doSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const r = await searchFood(query)
      setResults(r)
      setOpen(true)
    } catch (err) {
      setError(err.message)
    }
    setSearching(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={labelStyle}>{label}</div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 6, padding: '7px 10px' }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>P{value.protein} L{value.fat} G{value.carbs}/100g</div>
          <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), doSearch())}
              placeholder={placeholder || 'Rechercher un aliment…'}
              style={inputStyle}
            />
            <button onClick={doSearch} disabled={searching || !query.trim()}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {searching ? '…' : '🔍'}
            </button>
          </div>
          {open && results.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.15)', maxHeight: 220, overflowY: 'auto' }}>
              {results.map(r => (
                <button key={r.id} onClick={() => { onChange(r); setOpen(false); setQuery('') }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', padding: '8px 10px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>P{r.protein} · L{r.fat} · G{r.carbs} /100g</div>
                </button>
              ))}
            </div>
          )}
          {open && results.length === 0 && !searching && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Aucun résultat, essaie un autre terme.</div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{error}</div>
          )}
        </>
      )}
    </div>
  )
}

function PoolPicker({ label, items, onChange, max = 3 }) {
  return (
    <div>
      <div style={labelStyle}>{label} ({items.filter(Boolean).length}/{max})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <FoodPicker key={i} label={`Choix ${i + 1}`} value={item} onChange={v => {
            const next = [...items]; next[i] = v; onChange(next)
          }} />
        ))}
      </div>
    </div>
  )
}

export default function MealPlannerPage() {
  const [step, setStep] = useState(1)

  const [profile, setProfile] = useState({
    weight: '', height: '', calories: 2200, pctProtein: 30, pctFat: 30, pctCarbs: 40,
    sex: 'H', age: '', activityKey: 'modere', goalKey: 'maintenir',
  })
  const [calorieResult, setCalorieResult] = useState(null)

  function calculateCalories() {
    if (!profile.weight || !profile.height || !profile.age) return
    const result = computeCalorieTarget({
      sex: profile.sex, weight: profile.weight, height: profile.height, age: profile.age,
      activityKey: profile.activityKey, goalKey: profile.goalKey,
    })
    setCalorieResult(result)
    setProfile(p => ({ ...p, calories: result.target }))
  }

  const [structure, setStructure] = useState({
    mealsEnabled: { petitDej: true, dejeuner: true, diner: true },
    snacksPerDay: 1,
    weeks: 4,
    fixedPortion: 150,
  })

  const [pools, setPools] = useState({
    proteins: [null, null, null],
    fats: [OLIVE_OIL, null, null],
    vegetables: [null, null, null],
    carbs: [null, null, null],
    breakfastProtein: null,
  })
  const [showBreakfastProtein, setShowBreakfastProtein] = useState(false)

  const [plan, setPlan] = useState(null)

  const pctTotal = Number(profile.pctProtein) + Number(profile.pctFat) + Number(profile.pctCarbs)

  function generate() {
    setPlan(generatePlan(profile, structure, pools))
    setStep(4)
  }

  const steps = [
    { n: 1, label: 'Profil' },
    { n: 2, label: 'Structure' },
    { n: 3, label: 'Aliments' },
    { n: 4, label: 'Plan' },
  ]

  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, fontWeight: 700, marginBottom: 10 }}>🍽 Générateur de plan repas</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map(s => (
              <button key={s.n} onClick={() => (s.n < step || (s.n === 4 && plan)) && setStep(s.n)}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', cursor: s.n <= step ? 'pointer' : 'default',
                  background: s.n === step ? 'var(--green)' : s.n < step ? 'var(--green-light)' : 'var(--bg2)',
                  color: s.n === step ? '#fff' : s.n < step ? 'var(--green)' : 'var(--text3)',
                  fontSize: 12, fontWeight: 700,
                }}>
                {s.n}. {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {step === 1 && (
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Poids (kg)</div>
                  <input type="number" value={profile.weight} onChange={e => setProfile(p => ({ ...p, weight: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Taille (cm)</div>
                  <input type="number" value={profile.height} onChange={e => setProfile(p => ({ ...p, height: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>🔢 Calculateur de besoin calorique</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Sexe</div>
                    <select value={profile.sex} onChange={e => setProfile(p => ({ ...p, sex: e.target.value }))} style={inputStyle}>
                      <option value="H">Homme</option>
                      <option value="F">Femme</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Âge</div>
                    <input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Niveau d&apos;activité</div>
                  <select value={profile.activityKey} onChange={e => setProfile(p => ({ ...p, activityKey: e.target.value }))} style={inputStyle}>
                    {ACTIVITY_LEVELS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Objectif</div>
                  <select value={profile.goalKey} onChange={e => setProfile(p => ({ ...p, goalKey: e.target.value }))} style={inputStyle}>
                    {GOALS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                  </select>
                </div>
                <button onClick={calculateCalories} disabled={!profile.weight || !profile.height || !profile.age}
                  style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !profile.weight || !profile.height || !profile.age ? 0.5 : 1 }}>
                  Calculer les calories cibles
                </button>
                {calorieResult && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Métabolisme de base : {calorieResult.bmr} kcal · Maintenance : {calorieResult.tdee} kcal → Cible appliquée ci-dessous : {calorieResult.target} kcal
                  </div>
                )}
              </div>

              <div>
                <div style={labelStyle}>Calories cibles / jour</div>
                <input type="number" value={profile.calories} onChange={e => setProfile(p => ({ ...p, calories: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Répartition macros (%)</span>
                  <span style={{ color: pctTotal === 100 ? 'var(--green)' : '#DC2626' }}>{pctTotal}% {pctTotal !== 100 && '— doit faire 100%'}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Protéines</div>
                    <input type="number" value={profile.pctProtein} onChange={e => setProfile(p => ({ ...p, pctProtein: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Lipides</div>
                    <input type="number" value={profile.pctFat} onChange={e => setProfile(p => ({ ...p, pctFat: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Glucides</div>
                    <input type="number" value={profile.pctCarbs} onChange={e => setProfile(p => ({ ...p, pctCarbs: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)} disabled={pctTotal !== 100 || !profile.calories}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: pctTotal !== 100 || !profile.calories ? 0.5 : 1 }}>
                Suivant →
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={labelStyle}>Repas principaux actifs</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[['petitDej', 'Petit déj'], ['dejeuner', 'Déjeuner'], ['diner', 'Dîner']].map(([k, l]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={structure.mealsEnabled[k]}
                        onChange={e => setStructure(s => ({ ...s, mealsEnabled: { ...s.mealsEnabled, [k]: e.target.checked } }))}
                        style={{ accentColor: 'var(--green)' }} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Collations / jour</div>
                  <input type="number" min={0} value={structure.snacksPerDay} onChange={e => setStructure(s => ({ ...s, snacksPerDay: Math.max(0, Number(e.target.value)) }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Durée du plan (semaines)</div>
                  <input type="number" min={1} value={structure.weeks} onChange={e => setStructure(s => ({ ...s, weeks: Math.max(1, Number(e.target.value)) }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Tous les repas (petit déj, déjeuner, dîner, collations) piochent au hasard chaque jour dans les mêmes pools de 3 aliments par rôle, définis à l&apos;étape suivante.
              </div>
              <div>
                <div style={labelStyle}>Portion fixe légume (g)</div>
                <input type="number" value={structure.fixedPortion} onChange={e => setStructure(s => ({ ...s, fixedPortion: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>← Retour</button>
                <button onClick={() => setStep(3)} style={{ flex: 1, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Suivant →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>

              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Un seul pool d&apos;aliments, utilisé pour tous les repas : chaque jour, un aliment est tiré au sort par rôle (protéine, lipide, légume, glucide).
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🍗 Protéines</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <PoolPicker label="Protéines" items={pools.proteins} onChange={v => setPools(p => ({ ...p, proteins: v }))} />

                  {!showBreakfastProtein ? (
                    <button onClick={() => setShowBreakfastProtein(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      + Ajouter une protéine dédiée au petit déj
                    </button>
                  ) : (
                    <div>
                      <FoodPicker label="Protéine dédiée petit déj (4e choix)" value={pools.breakfastProtein} onChange={v => setPools(p => ({ ...p, breakfastProtein: v }))} />
                      <button onClick={() => { setPools(p => ({ ...p, breakfastProtein: null })); setShowBreakfastProtein(false) }}
                        style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                        Retirer — revenir au tirage parmi les 3 protéines
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🫒 Lipides (huile d&apos;olive par défaut)</div>
                <PoolPicker label="Lipides" items={pools.fats} onChange={v => setPools(p => ({ ...p, fats: v }))} />
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🥦 Légumes</div>
                <PoolPicker label="Légumes" items={pools.vegetables} onChange={v => setPools(p => ({ ...p, vegetables: v }))} />
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🍞 Glucides</div>
                <PoolPicker label="Glucides" items={pools.carbs} onChange={v => setPools(p => ({ ...p, carbs: v }))} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>← Retour</button>
                <button onClick={generate} style={{ flex: 1, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🍽 Générer le plan</button>
              </div>
            </div>
          )}

          {step === 4 && plan && (
            <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--rl)', padding: 14, fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
                Cible par repas : {Math.round(plan.target.protein)}g protéines · {Math.round(plan.target.fat)}g lipides · {Math.round(plan.target.carbs)}g glucides ({plan.totalSlots} repas/jour)
              </div>

              {plan.days.map(day => (
                <div key={day.day} style={{ border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg2)', padding: '8px 14px', fontSize: 12, fontWeight: 800 }}>
                    Semaine {day.week} — Jour {day.dayOfWeek} (jour {day.day})
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {day.meals.map((m, i) => (
                      <div key={i} style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ color: 'var(--text2)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {m.protein.food && <span>{m.protein.food.name} — {m.protein.qty}g</span>}
                          {m.fat.food && <span>{m.fat.food.name} — {m.fat.qty}g</span>}
                          {m.carb.food && <span>{m.carb.food.name} — {m.carb.qty}g</span>}
                          {m.fruitOrVeg?.food && <span>{m.fruitOrVeg.food.name} ({m.fruitOrVeg.label}) — {m.fruitOrVeg.qty}g</span>}
                        </div>
                        {m.warnings.length > 0 && (
                          <div style={{ marginTop: 3, color: '#DC2626', fontSize: 11 }}>⚠ {m.warnings.join(' · ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={() => setStep(3)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)', alignSelf: 'flex-start' }}>← Modifier les aliments</button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
