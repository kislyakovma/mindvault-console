import { z } from 'zod'

export const Uuid = z.string().uuid()
export const Email = z.string().email()
export const DateTime = z.string().datetime({ offset: true }).or(z.string().datetime())
export const NullableString = z.string().nullable()

// Auth
export const SignupRequestSchema = z.object({
  email: Email,
  password: z.string().min(8),
  marketingOptIn: z.boolean().optional().default(false),
})
export type SignupRequest = z.infer<typeof SignupRequestSchema>

export const LoginRequestSchema = z.object({
  email: Email,
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const UserSchema = z.object({
  id: Uuid,
  email: Email,
  role: z.enum(['USER', 'ADMIN']),
  createdAt: DateTime,
})
export type User = z.infer<typeof UserSchema>

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: UserSchema,
})
export type AuthResponse = z.infer<typeof AuthResponseSchema>

// Brief
export const BriefProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
})

export const BriefUpsertRequestSchema = z.object({
  role: z.string().min(1),
  projects: z.array(BriefProjectSchema).min(1).max(5),
  goals: z.string().min(1).max(800),
  language: z.enum(['ru', 'en']).default('ru'),
  telegramUsername: z.string().nullable().optional(),
})
export type BriefUpsertRequest = z.infer<typeof BriefUpsertRequestSchema>

export const BriefResponseSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED']),
  data: z.record(z.any()),
  updatedAt: DateTime.optional(),
})
export type BriefResponse = z.infer<typeof BriefResponseSchema>

// Provisioning
export const ProvisioningStatusResponseSchema = z.object({
  status: z.enum(['DRAFT', 'PAYMENT_REQUIRED', 'QUEUED', 'PROVISIONING', 'READY', 'FAILED', 'SUSPENDED']),
  step: z.enum(['NONE', 'CREATE_SERVER', 'WAIT_SSH', 'APPLY_TERRAFORM', 'HEALTHCHECK', 'FINALIZE']),
  logsShort: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  updatedAt: DateTime.nullable().optional(),
})
export type ProvisioningStatusResponse = z.infer<typeof ProvisioningStatusResponseSchema>

// Billing
export const SubscriptionResponseSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELED']),
  provider: z.string().nullable().optional(),
  currentPeriodEnd: DateTime.nullable().optional(),
})
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>

export const CheckoutRequestSchema = z.object({
  method: z.enum(['card', 'sbp']),
  planCode: z.string().nullable().optional(),
  returnUrl: z.string().url().nullable().optional(),
})
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>

// Support
export const CreateTicketRequestSchema = z.object({
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(5000),
})
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>

export const TicketResponseSchema = z.object({
  id: Uuid,
  subject: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']),
  createdAt: DateTime,
})
export type TicketResponse = z.infer<typeof TicketResponseSchema>
