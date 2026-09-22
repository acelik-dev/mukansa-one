import { z } from 'zod'
import { DEFAULT_HOUSEHOLD, type Household } from '../../mobile/src/lib/calc.ts'
import {
  PHONE_PATTERN,
  SERVICE_CATEGORIES,
  SERVICE_CONTACT_NAME_MAX,
  SERVICE_DESCRIPTION_MAX,
  SERVICE_STATUSES,
} from '../../mobile/src/lib/service.ts'

export const householdSchema = z.object({
  people: z.number().int().min(1).max(20),
  uses: z.array(z.enum(['drinking', 'tea', 'cooking', 'pet'])).min(1).max(4),
  presence: z.enum(['home', 'mixed', 'away']),
  source: z.enum(['damacana', 'pet', 'tap', 'mixed']),
  damacanaPerMonth: z.number().int().min(0).max(200).optional(),
  damacanaPriceTL: z.number().min(0).max(5000).optional(),
  region: z.string().trim().max(80).optional(),
}) satisfies z.ZodType<Household>

export const notifSchema = z.object({
  weeklySummary: z.boolean(),
  filterAlerts: z.boolean(),
  milestones: z.boolean(),
  marketing: z.boolean(),
})
export type NotifPrefs = z.infer<typeof notifSchema>

export const DEFAULT_NOTIF: NotifPrefs = {
  weeklySummary: true,
  filterAlerts: true,
  milestones: true,
  marketing: false,
}

export { DEFAULT_HOUSEHOLD }

export const activateBody = z.object({
  code: z.string().min(1).max(40),
  platform: z.enum(['ios', 'android', 'web']).optional(),
})

export const profileBody = z
  .object({ household: householdSchema.optional(), notif: notifSchema.optional() })
  .refine((b) => b.household || b.notif, 'household veya notif gerekli')

export const onboardingBody = z.object({
  household: householdSchema,
  notif: notifSchema,
})

export const filterReplaceBody = z.object({
  /** Offline kuyruktan gelen değişimler için gerçek zaman (epoch ms) */
  replacedAt: z.number().int().positive().optional(),
})

export const pushTokenBody = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/),
  platform: z.enum(['ios', 'android']).optional(),
})

const categoryTuple = SERVICE_CATEGORIES as [string, ...string[]]
const statusTuple = SERVICE_STATUSES as [string, ...string[]]

export const serviceRequestBody = z.object({
  category: z.enum(categoryTuple),
  description: z.string().trim().min(1).max(SERVICE_DESCRIPTION_MAX),
  contactName: z.string().trim().max(SERVICE_CONTACT_NAME_MAX).optional(),
  contactPhone: z.string().trim().regex(PHONE_PATTERN, 'Geçerli bir telefon numarası girin'),
})

export const serviceRequestActionBody = z
  .object({
    status: z.enum(statusTuple).optional(),
    adminNote: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.status !== undefined || b.adminNote !== undefined, 'status veya adminNote gerekli')
