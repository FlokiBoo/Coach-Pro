// Système de badges cardio par mouvement chronométré (Rameur, Course...), par âge et sexe.
// Seuils fournis par le coach ("CARDIO — TABLES COMPLÈTES PAR ÂGE"), transcrits tels quels puis
// parsés — plus sûr que de retaper 450 valeurs à la main dans un objet JS.

import { TIER_ORDER, TIER_STYLES } from './badges'

export { TIER_STYLES }

const AGE_ROWS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]

// "mm:ss" ou "mm:ss.d" → secondes
function parseTimeToSeconds(str) {
  const parts = str.trim().split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
  return parseFloat(str)
}

// Une ligne : "AGE: B_H/B_F | A_H/A_F | O_H/O_F | R_H/R_F | E_H/E_F"
// (on ne coupe qu'au 1er ":" — les valeurs mm:ss en contiennent d'autres)
function parseCardioTable(raw) {
  const rows = {}
  raw.trim().split('\n').forEach(line => {
    const colonIdx = line.indexOf(':')
    const age = parseInt(line.slice(0, colonIdx).trim(), 10)
    const rest = line.slice(colonIdx + 1)
    rows[age] = rest.trim().split('|').map(pair => {
      const [h, f] = pair.trim().split('/')
      return { H: parseTimeToSeconds(h), F: parseTimeToSeconds(f) }
    })
  })
  return rows
}

const ROW_500_RAW = `
20: 1:53.9/2:25.8 | 1:44.8/2:12.0 | 1:36.1/1:58.9 | 1:28.2/1:47.1 | 1:21.2/1:36.9
25: 1:51.9/2:25.2 | 1:43.0/2:11.4 | 1:34.5/1:58.4 | 1:26.6/1:46.7 | 1:19.8/1:36.5
30: 1:50.4/2:27.7 | 1:41.6/2:13.7 | 1:33.2/2:00.4 | 1:25.4/1:48.5 | 1:18.7/1:38.2
35: 1:51.2/2:28.6 | 1:42.4/2:14.5 | 1:33.9/2:01.2 | 1:26.1/1:49.2 | 1:19.2/1:38.8
40: 1:55.4/2:26.2 | 1:46.2/2:12.3 | 1:37.4/1:59.2 | 1:29.3/1:47.4 | 1:22.2/1:37.2
45: 1:55.4/2:28.0 | 1:46.2/2:14.0 | 1:37.4/2:00.7 | 1:29.3/1:48.7 | 1:22.2/1:38.4
50: 1:55.4/2:36.3 | 1:46.2/2:21.4 | 1:37.4/2:07.4 | 1:29.3/1:54.8 | 1:22.2/1:43.9
55: 1:57.5/2:41.2 | 1:48.1/2:25.9 | 1:39.2/2:11.4 | 1:30.9/1:58.4 | 1:23.7/1:47.2
60: 2:07.9/2:49.1 | 1:57.7/2:33.0 | 1:48.0/2:17.9 | 1:39.0/2:04.2 | 1:31.1/1:52.4
65: 2:12.8/2:59.6 | 2:02.2/2:42.6 | 1:52.1/2:26.5 | 1:42.8/2:11.9 | 1:34.6/1:59.4
70: 2:17.6/3:10.2 | 2:06.7/2:52.1 | 1:56.2/2:35.0 | 1:46.5/2:19.7 | 1:38.1/2:06.4
75: 2:24.3/3:19.5 | 2:12.9/3:00.6 | 2:01.8/2:42.7 | 1:51.7/2:26.5 | 1:42.9/2:12.6
80: 2:31.1/3:28.8 | 2:19.1/3:09.0 | 2:07.5/2:50.3 | 1:56.9/2:33.4 | 1:47.7/2:18.8
85: 2:45.7/4:04.6 | 2:32.6/3:41.3 | 2:19.9/3:19.4 | 2:08.3/2:59.6 | 1:58.1/2:42.6
90: 3:00.4/4:40.3 | 2:46.1/4:13.7 | 2:32.3/3:48.5 | 2:19.6/3:25.9 | 2:08.6/3:06.3
`

const ROW_2000_RAW = `
20: 8:17.6/10:16.3 | 7:45.4/9:22.9 | 7:13.9/8:32.0 | 6:44.5/7:45.6 | 6:18.3/7:05.3
25: 8:10.6/10:08.2 | 7:38.8/9:15.5 | 7:07.8/8:25.3 | 6:38.8/7:39.5 | 6:13.0/6:59.7
30: 8:06.9/10:14.2 | 7:35.4/9:21.0 | 7:04.6/8:30.2 | 6:35.9/7:44.0 | 6:10.2/7:03.9
35: 8:13.6/10:31.4 | 7:41.6/9:36.7 | 7:10.4/8:44.5 | 6:41.3/7:57.1 | 6:15.3/7:15.8
40: 8:23.7/10:51.4 | 7:51.1/9:55.0 | 7:19.2/9:01.2 | 6:49.5/8:12.2 | 6:23.0/7:29.6
45: 8:33.8/10:58.5 | 8:00.5/10:01.5 | 7:28.0/9:07.1 | 6:57.7/8:17.6 | 6:30.7/7:34.5
50: 8:43.9/11:05.6 | 8:10.0/10:08.0 | 7:36.8/9:13.0 | 7:05.9/8:22.9 | 6:38.3/7:39.4
55: 8:59.6/11:26.4 | 8:24.7/10:27.0 | 7:50.6/9:30.2 | 7:18.7/8:38.6 | 6:50.3/7:53.7
60: 9:11.4/11:50.2 | 8:35.7/10:48.7 | 8:00.8/9:50.0 | 7:28.2/8:56.6 | 6:59.2/8:10.2
65: 9:29.9/12:14.9 | 8:53.0/11:11.3 | 8:17.0/10:10.5 | 7:43.3/9:15.3 | 7:13.3/8:27.2
70: 9:56.8/12:47.3 | 9:18.2/11:40.9 | 8:40.4/10:37.4 | 8:05.2/9:39.7 | 7:33.8/8:49.6
75: 10:15.9/13:10.8 | 9:36.1/12:02.3 | 8:57.1/10:56.9 | 8:20.7/9:57.5 | 7:48.3/9:05.8
80: 10:46.8/14:01.8 | 10:05.0/12:48.9 | 9:24.0/11:39.4 | 8:45.8/10:36.1 | 8:11.8/9:41.0
85: 11:26.8/15:16.6 | 10:42.4/13:57.2 | 9:58.9/12:41.4 | 9:18.3/11:32.5 | 8:42.2/10:32.6
90: 12:36.6/17:48.7 | 11:47.6/16:16.2 | 10:59.7/14:47.8 | 10:15.1/13:27.5 | 9:35.3/12:17.6
`

const RUN_5K_RAW = `
20: 31:29/35:27 | 26:19/30:08 | 22:31/26:07 | 19:44/23:04 | 17:40/20:47
25: 31:29/35:27 | 26:19/30:08 | 22:31/26:07 | 19:44/23:04 | 17:40/20:47
30: 31:29/35:27 | 26:19/30:08 | 22:32/26:07 | 19:44/23:04 | 17:40/20:47
35: 31:59/35:40 | 26:45/30:20 | 22:53/26:17 | 20:03/23:13 | 17:57/20:56
40: 33:09/36:25 | 27:43/30:58 | 23:43/26:49 | 20:46/23:42 | 18:36/21:22
45: 34:25/37:43 | 28:47/32:04 | 24:38/27:47 | 21:34/24:33 | 19:19/22:07
50: 35:47/39:39 | 29:55/33:43 | 25:36/29:13 | 22:26/25:49 | 20:05/23:16
55: 37:16/41:56 | 31:10/35:40 | 26:40/30:54 | 23:21/27:18 | 20:55/24:36
60: 38:53/44:29 | 32:31/37:50 | 27:49/32:47 | 24:22/28:58 | 21:49/26:06
65: 40:38/47:23 | 33:59/40:18 | 29:05/34:54 | 25:28/30:51 | 22:48/27:48
70: 42:43/50:40 | 35:43/43:05 | 30:34/37:20 | 26:46/32:59 | 23:58/29:43
75: 45:55/54:27 | 38:23/46:18 | 32:51/40:07 | 28:46/35:27 | 25:46/31:56
80: 50:49/58:57 | 42:30/50:07 | 36:22/43:25 | 31:51/38:22 | 28:31/34:35
85: 58:28/66:22 | 48:53/56:26 | 41:50/48:54 | 36:38/43:12 | 32:48/38:56
90: 71:08/79:59 | 59:29/68:01 | 50:54/58:55 | 44:35/52:04 | 39:55/46:55
`

export const CARDIO_BADGE_MOVEMENTS = [
  { name: '500m Row', table: parseCardioTable(ROW_500_RAW) },
  { name: '2000m Row', table: parseCardioTable(ROW_2000_RAW) },
  { name: '5Km Run', table: parseCardioTable(RUN_5K_RAW) },
]

// Interpole les 5 seuils (bronze→émeraude) à un âge donné, par interpolation linéaire entre les
// deux lignes de la table encadrant cet âge. En dehors de [20, 90], on reprend le bord le plus proche.
function thresholdsAtAge(table, age) {
  const a = Math.max(AGE_ROWS[0], Math.min(AGE_ROWS[AGE_ROWS.length - 1], age))
  let lowAge = AGE_ROWS[0], highAge = AGE_ROWS[AGE_ROWS.length - 1]
  for (let i = 0; i < AGE_ROWS.length - 1; i++) {
    if (a >= AGE_ROWS[i] && a <= AGE_ROWS[i + 1]) { lowAge = AGE_ROWS[i]; highAge = AGE_ROWS[i + 1]; break }
  }
  const lowRow = table[lowAge], highRow = table[highAge]
  const t = highAge === lowAge ? 0 : (a - lowAge) / (highAge - lowAge)
  const thresholds = {}
  TIER_ORDER.forEach((key, i) => {
    thresholds[key] = {
      H: lowRow[i].H + t * (highRow[i].H - lowRow[i].H),
      F: lowRow[i].F + t * (highRow[i].F - lowRow[i].F),
    }
  })
  return thresholds
}

// seconds: meilleur temps de l'athlète (plus bas = meilleur). age: âge (années, peut être décimal).
export function computeCardioBadge(seconds, age, table, sex) {
  const s = sex === 'F' ? 'F' : 'H'
  const thresholds = thresholdsAtAge(table, age)
  const points = TIER_ORDER.map(key => ({ key, seconds: thresholds[key][s] }))

  // Plus le temps est bas, plus le palier est difficile : on descend la liste tant que le temps
  // de l'athlète reste sous le seuil (contrairement à la force, où on cherche le pct le plus haut atteint).
  let currentIdx = -1
  for (let i = 0; i < points.length; i++) {
    if (seconds <= points[i].seconds) currentIdx = i
  }
  const current = currentIdx >= 0 ? points[currentIdx] : null
  const next = currentIdx + 1 < points.length ? points[currentIdx + 1] : null
  const upperBound = current ? current.seconds : points[0].seconds * 1.3
  const progress = next
    ? Math.max(0, Math.min(100, ((upperBound - seconds) / (upperBound - next.seconds)) * 100))
    : 100

  return { current, next, progress }
}
