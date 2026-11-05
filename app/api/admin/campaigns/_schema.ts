import { z } from "zod";
import { PLATFORMS } from "@/components/portal/ui";

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "ended"] as const;

const date = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

// Every field is optional here so PATCH can send just what changed; POST checks the required ones.
export const campaignFields = z.object({
  name: z.string().trim().min(1, "Give the campaign a name").max(120, "Keep the name under 120 characters"),
  client: z
    .string()
    .trim()
    .max(120, "Keep the client name under 120 characters")
    .transform((v) => v || null)
    .nullable(),
  rateRupees: z
    .number({ error: "Enter the rate in rupees" })
    .min(0, "The rate can't be negative")
    .max(10_000_000, "That rate looks too high"),
  allowedPlatforms: z.array(z.enum(PLATFORMS)).min(1, "Pick at least one platform"),
  maxAccountsPerClipper: z
    .number({ error: "Enter a number" })
    .int("Use a whole number")
    .min(1, "At least 1 account")
    .max(100, "100 accounts at most"),
  status: z.enum(CAMPAIGN_STATUSES),
  startsOn: date,
  endsOn: date,
});

export const createCampaignSchema = campaignFields
  .extend({ client: campaignFields.shape.client.optional(), startsOn: date.optional(), endsOn: date.optional() })
  .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, { message: "The end date can't be before the start date", path: ["endsOn"] });

export const updateCampaignSchema = campaignFields.partial();

export const endsBeforeStart = (startsOn: string | null, endsOn: string | null) => !!startsOn && !!endsOn && endsOn < startsOn;
