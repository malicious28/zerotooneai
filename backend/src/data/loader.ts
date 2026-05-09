import fs from 'fs'
import path from 'path'
import { AudienceSignal, SignalType } from '../types'

// ── CSV parser (no external deps) ────────────────────────────────────────────

function parseCsv(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, 'utf-8')
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]!)
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

// ── Reach estimates by category (assumptions since no data provided) ──────────

const LOCATION_REACH: Record<string, number> = {
  Restaurants: 32, Food: 28, Retail: 25, Shopping: 22, Grocery: 30, Gym: 12,
  Health: 15, Entertainment: 18, Education: 20, Finance: 10, Travel: 14,
  Hotel: 8, Airport: 6, Sports: 16, Beauty: 14, Pharmacy: 18, Gas: 20,
  Default: 10,
}

const TRANSACTION_REACH: Record<string, number> = {
  'Arts & Entertainment': 22, 'Automotive & Cars': 15, 'Family & Parenting': 24,
  'Health & Fitness': 20, 'Food & Drink': 30, 'Hobbies & Interests': 18,
  'Home & Garden': 16, 'News': 28, 'Personal Finance': 14, 'Pets': 12,
  'Sports': 22, 'Style & Fashion': 19, 'Technology & Computing': 21,
  'Travel': 15, 'Real Estate': 8, 'Shopping & Retail': 26, 'Society': 10,
  'Business': 12, 'Careers & Jobs': 10, 'Education': 18,
}

const CG_REACH: Record<string, number> = {
  credit_card_user: 28, credit_card_premium: 8, invest_active: 6,
  invest_stocks: 9, hh_with_kids: 35, home_ownership: 45,
  buy_health_beauty: 22, buy_books: 12, buy_jewelry: 8, buy_cosmetics: 18,
  occupation_type_woman: 38, occupation_business_owner: 7,
  donor_charitable: 11, credit_card_travel: 7,
  Default: 8,
}

function locationReach(top: string): number {
  const key = Object.keys(LOCATION_REACH).find(k => top.includes(k))
  return key ? LOCATION_REACH[key]! : LOCATION_REACH['Default']!
}

// ── Loaders ───────────────────────────────────────────────────────────────────

const SHEETS = path.join(__dirname, 'sheets')

function loadLocationSignals(): AudienceSignal[] {
  const rows = parseCsv(path.join(SHEETS, 'location_taxonomy.csv'))
  const seen = new Set<string>()
  const signals: AudienceSignal[] = []

  for (const row of rows) {
    const top = row['top_category'] ?? ''
    const sub = row['sub_category'] ?? ''
    if (!top) continue

    const label = sub && sub !== top ? sub : top
    const id = `loc_${slug(label)}`
    if (seen.has(id)) continue
    seen.add(id)

    const topHuman = humanize(top)
    const subHuman = sub ? humanize(sub) : ''
    const name = subHuman && subHuman !== topHuman ? subHuman : topHuman
    const taxonomyPath = subHuman && subHuman !== topHuman
      ? `Location > ${topHuman} > ${subHuman}`
      : `Location > ${topHuman}`

    signals.push({
      id,
      type: 'location',
      name,
      description: `Users who visit ${name.toLowerCase()} locations`,
      reach_pct: locationReach(top),
      taxonomy_id: id.toUpperCase(),
      taxonomy_path: taxonomyPath,
    })
  }

  return signals
}

function loadTransactionSignals(): AudienceSignal[] {
  const rows = parseCsv(path.join(SHEETS, 'transaction_taxonomy.csv'))
  const seen = new Set<string>()
  const signals: AudienceSignal[] = []

  for (const row of rows) {
    const l1 = row['Level 1'] ?? ''
    const l2 = row['Level 2'] ?? ''
    const l3 = row['Level 3'] ?? ''
    const l4 = row['Level 4'] ?? ''
    if (!l1) continue

    const parts = [l1, l2, l3, l4].filter(Boolean)
    const label = parts[parts.length - 1]!
    const id = `txn_${slug(parts.join('_'))}`
    if (seen.has(id)) continue
    seen.add(id)

    const baseReach = TRANSACTION_REACH[l1] ?? 12
    const depthPenalty = parts.length > 2 ? 0.5 : parts.length > 1 ? 0.75 : 1
    const reach_pct = Math.round(baseReach * depthPenalty * 10) / 10

    signals.push({
      id,
      type: parts.length <= 2 ? 'interest' : 'behavior',
      name: label,
      description: `${l1}${l2 ? ` > ${l2}` : ''}${l3 ? ` > ${l3}` : ''} — consumers with this interest or purchase pattern`,
      reach_pct,
      taxonomy_id: id.toUpperCase(),
      taxonomy_path: parts.join(' > '),
    })
  }

  return signals
}

function loadCgSignals(): AudienceSignal[] {
  const rows = parseCsv(path.join(SHEETS, 'cg_data_dictionary.csv'))
  const signals: AudienceSignal[] = []
  const seen = new Set<string>()

  // Core demographic ranges we expand manually
  const ageGroups: AudienceSignal[] = [
    { id: 'cg_age_18_24', type: 'demographic', name: 'Age 18-24 (Gen Z)', description: 'Consumers aged 18 to 24', reach_pct: 16, taxonomy_id: 'CG-AGE-18-24', taxonomy_path: 'Consumer Graph > Age > 18-24' },
    { id: 'cg_age_25_34', type: 'demographic', name: 'Age 25-34 (Millennials)', description: 'Consumers aged 25 to 34', reach_pct: 20, taxonomy_id: 'CG-AGE-25-34', taxonomy_path: 'Consumer Graph > Age > 25-34' },
    { id: 'cg_age_35_44', type: 'demographic', name: 'Age 35-44', description: 'Consumers aged 35 to 44', reach_pct: 18, taxonomy_id: 'CG-AGE-35-44', taxonomy_path: 'Consumer Graph > Age > 35-44' },
    { id: 'cg_age_45_54', type: 'demographic', name: 'Age 45-54', description: 'Consumers aged 45 to 54', reach_pct: 15, taxonomy_id: 'CG-AGE-45-54', taxonomy_path: 'Consumer Graph > Age > 45-54' },
    { id: 'cg_age_55_plus', type: 'demographic', name: 'Age 55+', description: 'Consumers aged 55 and above', reach_pct: 14, taxonomy_id: 'CG-AGE-55+', taxonomy_path: 'Consumer Graph > Age > 55+' },
  ]

  const genderSignals: AudienceSignal[] = [
    { id: 'cg_gender_male', type: 'demographic', name: 'Male', description: 'Male consumers', reach_pct: 52, taxonomy_id: 'CG-GENDER-M', taxonomy_path: 'Consumer Graph > Gender > Male' },
    { id: 'cg_gender_female', type: 'demographic', name: 'Female', description: 'Female consumers', reach_pct: 48, taxonomy_id: 'CG-GENDER-F', taxonomy_path: 'Consumer Graph > Gender > Female' },
  ]

  const educationSignals: AudienceSignal[] = [
    { id: 'cg_edu_college', type: 'demographic', name: 'College Graduate', description: 'Consumers with a bachelor degree or higher', reach_pct: 32, taxonomy_id: 'CG-EDU-COLLEGE', taxonomy_path: 'Consumer Graph > Education > College Graduate' },
    { id: 'cg_edu_postgrad', type: 'demographic', name: 'Post Graduate', description: 'Consumers with a post-graduate degree', reach_pct: 14, taxonomy_id: 'CG-EDU-POSTGRAD', taxonomy_path: 'Consumer Graph > Education > Post Graduate' },
  ]

  signals.push(...ageGroups, ...genderSignals, ...educationSignals)
  ageGroups.forEach(s => seen.add(s.id))
  genderSignals.forEach(s => seen.add(s.id))
  educationSignals.forEach(s => seen.add(s.id))

  // Convert BOOL fields from cg_data_dictionary into signals
  for (const row of rows) {
    const desc = row['Field Description'] ?? ''
    const fieldName = row['Field Name'] ?? ''
    const fieldType = row['Field Type'] ?? ''
    if (!fieldName || !desc || fieldType !== 'BOOL') continue

    const id = `cg_${slug(fieldName)}`
    if (seen.has(id)) continue
    seen.add(id)

    const signalType: SignalType = fieldName.startsWith('invest') || fieldName.startsWith('credit')
      ? 'transaction'
      : fieldName.startsWith('buy_') || fieldName.startsWith('donor')
      ? 'behavior'
      : 'demographic'

    const reach_pct = CG_REACH[fieldName] ?? CG_REACH['Default']!

    signals.push({
      id,
      type: signalType,
      name: desc,
      description: `Consumer graph signal: ${desc.toLowerCase()}`,
      reach_pct,
      taxonomy_id: `CG-${fieldName.toUpperCase()}`,
      taxonomy_path: `Consumer Graph > ${signalType.charAt(0).toUpperCase() + signalType.slice(1)} > ${desc}`,
    })
  }

  return signals
}

// ── Main export ───────────────────────────────────────────────────────────────

let _allSignals: AudienceSignal[] | null = null

export function getAllSignals(): AudienceSignal[] {
  if (_allSignals) return _allSignals
  _allSignals = [
    ...loadLocationSignals(),
    ...loadTransactionSignals(),
    ...loadCgSignals(),
  ]
  console.log(`[taxonomy] Loaded ${_allSignals.length} signals from real taxonomy data`)
  return _allSignals
}

// Keyword search across all signals — returns top N matches
export function searchSignals(query: string, topN = 30): AudienceSignal[] {
  const all = getAllSignals()
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  if (terms.length === 0) return all.slice(0, topN)

  const scored = all.map(s => {
    const haystack = `${s.name} ${s.description} ${s.taxonomy_path}`.toLowerCase()
    const score = terms.reduce((acc, t) => {
      if (s.name.toLowerCase().includes(t)) return acc + 3
      if (s.taxonomy_path.toLowerCase().includes(t)) return acc + 2
      if (haystack.includes(t)) return acc + 1
      return acc
    }, 0)
    return { signal: s, score }
  })

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(x => x.signal)
}

// Find a signal by exact ID (searches all signals)
export function findSignalById(id: string): AudienceSignal | undefined {
  return getAllSignals().find(s => s.id === id)
}
