import { z } from "zod";
import { ROLES } from "./roles";

export const AUDIENCE_SIZES = ["<10K", "10K-100K", "100K-1M", "1M+"] as const;
export const CLIPPING_EXPERIENCE = ["New", "<6 months", "6+ months"] as const;

/** Trimmed optional string; empty → undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Optional enum that also accepts "" (an unselected <select>). */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined));

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email").max(254, "Email is too long"));

const name = z.string().trim().min(1, "Please enter your name").max(80, "Keep it under 80 characters");

// Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6–9. Spaces and dashes allowed.
const whatsapp = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s-]/g, "") : undefined))
  .refine((v) => v === undefined || /^(\+?91|0)?[6-9]\d{9}$/.test(v), "Enter a valid Indian mobile number");

const releaseDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date");

export const waitlistSchema = z.object({
  role: z.enum(ROLES, "Pick one to continue"),
  name,
  email,
  whatsapp,
  handle: optionalText(200),
  audience_size: optionalEnum(AUDIENCE_SIZES),
  release_date: releaseDate,
  clipping_experience: optionalEnum(CLIPPING_EXPERIENCE),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

/** Extra fields the API accepts on top of the form data. */
export const waitlistRequestSchema = waitlistSchema.extend({
  source: optionalText(120),
  website: z.string().optional(), // honeypot
  elapsedMs: z.number().int().nonnegative(),
});

export const contactSchema = z.object({
  name,
  email,
  message: z.string().trim().min(1, "Please write a message").max(500, "Keep it under 500 characters"),
});

export const contactRequestSchema = contactSchema.extend({
  website: z.string().optional(), // honeypot
});

/** Maps a ZodError to { field: firstMessage }. */
export function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
