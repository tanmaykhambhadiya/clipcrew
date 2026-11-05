// Plain (non-client) module so the server page can build the share text.
export const LOGIN_URL = "https://clipcrew.ignitralabs.com/login";

export function inviteMessage(c: { name: string; platforms: string[]; rateLabel: string; maxAccounts: number }) {
  return [
    `New ClipCrew campaign: ${c.name}`,
    `Platforms allowed: ${c.platforms.join(", ")}`,
    `Pay: ${c.rateLabel} per 1M views`,
    `Accounts per clipper: up to ${c.maxAccounts}`,
    "",
    `Log in: ${LOGIN_URL}`,
  ].join("\n");
}
