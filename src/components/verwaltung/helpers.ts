import type { Holder } from '@/clients/admin/useRegisterQueries'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'

/** What the register should warn about for a holder — mirrors holderWarning() in
 *  permanent-numbers-core.js: a WhatsApp holder gets no confirmation mail, one without a
 *  number has to be reached through the team. */
export const holderWarning = (holder: Pick<Holder, 'holderContactChannel' | 'holderPhone'>) =>
  holder.holderContactChannel !== 'whatsapp'
    ? null
    : holder.holderPhone.trim()
      ? ({ level: 'warn', text: 'WhatsApp — Bestätigung manuell' } as const)
      : ({ level: 'error', text: 'WhatsApp ohne Nummer — über das Team' } as const)

export const emptyHolderInput = (): HolderInput => ({
  holderFirstName: '',
  holderLastName: '',
  holderEmail: '',
  holderPhone: '',
  holderContactChannel: 'email',
  isStaff: false,
  holderNote: '',
})

export const holderToInput = (holder: Holder): HolderInput => ({
  holderFirstName: holder.holderFirstName,
  holderLastName: holder.holderLastName,
  holderEmail: holder.holderEmail,
  holderPhone: holder.holderPhone,
  holderContactChannel: holder.holderContactChannel,
  isStaff: holder.isStaff,
  holderNote: holder.holderNote,
})

export const formatDay = (dbDate: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dbDate)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

export const toDayInput = (dbDate: string) => dbDate.slice(0, 10)

/** [1,2,3,5,8,9,10] → "1–3, 5, 8–10" */
export function describeRange(numbers: number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b)
  const parts: string[] = []
  let start: number | null = null
  let prev: number | null = null
  for (const n of sorted) {
    if (start === null || prev === null) {
      start = n
    } else if (n !== prev + 1) {
      parts.push(start === prev ? String(start) : `${String(start)}–${String(prev)}`)
      start = n
    }
    prev = n
  }
  if (start !== null && prev !== null) parts.push(start === prev ? String(start) : `${String(start)}–${String(prev)}`)
  return parts.join(', ')
}

/** The numbers between the smallest and the largest that are in none of the pools — left out
 *  on purpose (clothing sizes read wrong on a label, the donation number belongs to nobody),
 *  but puzzling in a list unless said so. */
export function gapsBetween(numbers: number[]): number[] {
  if (numbers.length === 0) return []
  const have = new Set(numbers)
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const gaps: number[] = []
  for (let n = min; n <= max; n++) if (!have.has(n)) gaps.push(n)
  return gaps
}
