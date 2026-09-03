// day_of_week sur program_sessions : 0 = Lundi … 6 = Dimanche, null = non assigné.
export const WEEK_DAYS = [
  { key: 0, label: 'Lundi', short: 'Lun' },
  { key: 1, label: 'Mardi', short: 'Mar' },
  { key: 2, label: 'Mercredi', short: 'Mer' },
  { key: 3, label: 'Jeudi', short: 'Jeu' },
  { key: 4, label: 'Vendredi', short: 'Ven' },
  { key: 5, label: 'Samedi', short: 'Sam' },
  { key: 6, label: 'Dimanche', short: 'Dim' },
]

// Date.getDay() : 0 = Dimanche … 6 = Samedi → convertit vers notre convention (0 = Lundi).
export function jsDayToWeekDay(jsDay) {
  return (jsDay + 6) % 7
}
