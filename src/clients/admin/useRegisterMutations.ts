import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from '../pocketbase'
import { withErrorLogging } from '../withErrorLogging'
import {
  ContactChannelSchema,
  HolderSchema,
  NumberStatusSchema,
  PermanentNumberSchema,
  invalidateRegister,
} from './useRegisterQueries'

/**
 * Write side of the register. Holders and numbers are ordinary records — the record hooks in
 * permanent-numbers.pb.js keep the name hashes and the contact rule (address on the e-mail
 * channel) — so the SDK writes them directly. Materialising goes through the superuser route,
 * which is the one place that touches sellerDetails/sellerNumbers.
 */

// An alias as the form sends it: names (the hook computes the hashes) or, taken over from a
// market row, the hash pair alone.
export const AliasInputSchema = z.object({
  firstName: z.string().trim().default(''),
  lastName: z.string().trim().default(''),
  firstNameHash: z.string().default(''),
  lastNameHash: z.string().default(''),
})
export type AliasInput = z.infer<typeof AliasInputSchema>

export const HolderInputSchema = z.object({
  holderFirstName: z.string().trim().min(1, 'Vorname fehlt'),
  holderLastName: z.string().trim().min(1, 'Nachname fehlt'),
  holderEmail: z.string().trim().toLowerCase(),
  holderPhone: z.string().trim(),
  holderContactChannel: ContactChannelSchema,
  isStaff: z.boolean(),
  holderNote: z.string().trim(),
  holderAliases: AliasInputSchema.array().default([]),
})
export type HolderInput = z.infer<typeof HolderInputSchema>

const NumberInputSchema = z.object({
  sellerNumberVariation: z.string().min(1, 'Variation fehlt'),
  permanentNumberNumber: z.number().int().positive(),
  holder: z.string().min(1),
  status: NumberStatusSchema,
  heldSince: z.string(),
})

/** "YYYY-MM-DD" from the date input → the date PocketBase stores; '' stays ''. */
const toDbDate = (day: string) => (day ? `${day} 00:00:00.000Z` : '')

export const useUpdateHolderMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function updateHolderMutation(input: {
      id: string
      data: HolderInput
    }) {
      return HolderSchema.parse(
        await pb
          .collection('permanentNumberHolders')
          .update(input.id, HolderInputSchema.parse(input.data))
      )
    }),
    onSuccess: () => void invalidateRegister(),
  })

export const useCreateHolderMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function createHolderMutation(data: HolderInput) {
      return HolderSchema.parse(
        await pb
          .collection('permanentNumberHolders')
          .create(HolderInputSchema.parse(data))
      )
    }),
    onSuccess: () => void invalidateRegister(),
  })

export const useUpdateNumberMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function updateNumberMutation(input: {
      id: string
      data: Partial<{ holder: string; status: z.infer<typeof NumberStatusSchema>; heldSince: string }>
    }) {
      const data: Record<string, unknown> = { ...input.data }
      if (input.data.heldSince !== undefined) data.heldSince = toDbDate(input.data.heldSince)
      if (input.data.status === 'freigegeben') data.releasedAt = new Date().toISOString()
      return PermanentNumberSchema.parse(
        await pb.collection('permanentNumbers').update(input.id, data, { expand: 'holder' })
      )
    }),
    onSuccess: () => void invalidateRegister(),
  })

/** "Dieselbe Person": a market row sold under another spelling becomes an alias of the holder,
 *  and every market row of the number with that hash pair counts as the holder's from now on.
 *  The stored review flag catches up with the next push; the page recomputes it on read. */
export const useAcceptAliasMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function acceptAliasMutation(input: {
      holderId: string
      currentAliases: AliasInput[]
      firstNameHash: string
      lastNameHash: string
      permanentNumberId: string
    }) {
      const already = input.currentAliases.some(
        (a) => a.firstNameHash === input.firstNameHash && a.lastNameHash === input.lastNameHash
      )
      if (!already) {
        await pb.collection('permanentNumberHolders').update(input.holderId, {
          holderAliases: [
            ...input.currentAliases,
            { firstName: '', lastName: '', firstNameHash: input.firstNameHash, lastNameHash: input.lastNameHash },
          ],
        })
      }
      const rows = await pb.collection('permanentNumberMarkets').getFullList({
        filter: pb.filter(
          'permanentNumber = {:id} && firstNameHash = {:f} && lastNameHash = {:l}',
          { id: input.permanentNumberId, f: input.firstNameHash, l: input.lastNameHash }
        ),
        fields: 'id',
      })
      for (const row of rows) {
        await pb.collection('permanentNumberMarkets').update(row.id, { holderMatch: 'holder', holder: input.holderId })
      }
      return rows.length
    }),
    onSuccess: () => void invalidateRegister(),
  })

/** A new number: an existing holder by id, or a new person created in the same go. */
export const useCreateNumberMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function createNumberMutation(input: {
      sellerNumberVariation: string
      permanentNumberNumber: number
      heldSince: string
      status?: z.infer<typeof NumberStatusSchema>
      holderId?: string
      newHolder?: HolderInput
    }) {
      let holderId = input.holderId ?? ''
      if (!holderId) {
        if (!input.newHolder) throw new Error('Halter fehlt')
        const holder = HolderSchema.parse(
          await pb
            .collection('permanentNumberHolders')
            .create(HolderInputSchema.parse(input.newHolder))
        )
        holderId = holder.id
      }
      const data = NumberInputSchema.parse({
        sellerNumberVariation: input.sellerNumberVariation,
        permanentNumberNumber: input.permanentNumberNumber,
        holder: holderId,
        status: input.status ?? 'aktiv',
        heldSince: input.heldSince,
      })
      return PermanentNumberSchema.parse(
        await pb
          .collection('permanentNumbers')
          .create({ ...data, heldSince: toDbDate(data.heldSince) }, { expand: 'holder' })
      )
    }),
    onSuccess: () => void invalidateRegister(),
  })

export const MaterialiseResultSchema = z.object({
  number: z.number(),
  variationName: z.string().nullable().optional(),
  result: z.enum(['created', 'already', 'updated', 'conflict', 'notInPool', 'skipped', 'stale']),
  reason: z.string().optional(),
  warning: z.string().optional(),
  contactChannel: z.string().optional(),
  changedFields: z.string().array().optional(),
  registeredName: z.string().optional(),
  holderId: z.string().nullable().optional(),
})
export type MaterialiseResult = z.infer<typeof MaterialiseResultSchema>

export const MaterialiseResponseSchema = z.object({
  dryRun: z.boolean(),
  event: z.object({ id: z.string(), eventName: z.string(), eventDate: z.string() }),
  registerRows: z.number(),
  counts: z.object({
    created: z.number().optional(),
    already: z.number().optional(),
    updated: z.number().optional(),
    conflict: z.number().optional(),
    notInPool: z.number().optional(),
    skipped: z.number().optional(),
    stale: z.number().optional(),
    deadHoldsReplaced: z.number().optional(),
  }),
  results: MaterialiseResultSchema.array(),
})
export type MaterialiseResponse = z.infer<typeof MaterialiseResponseSchema>

export const useMaterialiseMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function materialiseMutation(input: {
      eventId: string
      dryRun: boolean
    }) {
      return MaterialiseResponseSchema.parse(
        await pb.send<unknown>('/api/seller-number/permanent-numbers/materialise', {
          method: 'POST',
          body: { eventId: input.eventId, source: 'register', dryRun: input.dryRun },
        })
      )
    }),
  })

// ---------------------------------------------------------------------------
// An event's registrations
// ---------------------------------------------------------------------------

export const SellerDetailsInputSchema = z.object({
  sellerFirstName: z.string().trim().min(1, 'Vorname fehlt'),
  sellerLastName: z.string().trim().min(1, 'Nachname fehlt'),
  sellerEmail: z.string().trim().toLowerCase(),
  sellerPhone: z.string().trim(),
  isStaff: z.boolean(),
})
export type SellerDetailsInput = z.infer<typeof SellerDetailsInputSchema>

export const useUpdateSellerDetailsMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function updateSellerDetailsMutation(input: {
      id: string
      data: SellerDetailsInput
    }) {
      await pb
        .collection('sellerDetails')
        .update(input.id, SellerDetailsInputSchema.parse(input.data))
    }),
    onSuccess: () => void invalidateRegister(),
  })

/** Free a number in the event: the reservation row goes, the details row with it. A number
 *  the register materialised comes back with the next "Materialisieren" unless its register
 *  row is paused or released first. */
export const useReleaseSellerNumberMutation = () =>
  useMutation({
    mutationFn: withErrorLogging(async function releaseSellerNumberMutation(input: {
      sellerNumberId: string
      sellerDetailsId: string
    }) {
      await pb.collection('sellerNumbers').delete(input.sellerNumberId)
      if (input.sellerDetailsId) {
        await pb.collection('sellerDetails').delete(input.sellerDetailsId)
      }
    }),
    onSuccess: () => void invalidateRegister(),
  })
