export const CAMPAIGN_STATUSES = ["active", "draft", "paused", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const statusTone = { active: "lime", draft: "cyan", paused: "amber", ended: "grey" } as const;
