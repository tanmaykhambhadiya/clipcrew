// Pure helpers for social account handles — safe in client and server code (no imports).

export type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "x" | "other";

const HOST_PLATFORM: Record<string, Platform> = {
  "instagram.com": "instagram",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "tiktok.com": "tiktok",
  "x.com": "x",
  "twitter.com": "x",
  "facebook.com": "facebook",
  "fb.com": "facebook",
};

// Path segments that are never a username on these sites.
const RESERVED = new Set([
  "p", "reel", "reels", "tv", "explore", "stories", "watch", "shorts", "results", "feed", "playlist",
  "video", "status", "i", "home", "intent", "share", "hashtag", "groups", "pages", "events", "login", "accounts",
]);

const USERNAME_RE = /^[a-z0-9._-]{1,60}$/;

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s) || /^(www\.|m\.|mobile\.)?[a-z0-9-]+\.(com|be)\//i.test(s) || /^(www\.)?(instagram|youtube|tiktok|x|twitter|facebook)\.com$/i.test(s);
}

/** Guesses the platform from a pasted profile URL (null for a plain handle or an unknown site). */
export function platformFromInput(raw: string): Platform | null {
  const s = raw.trim();
  if (!looksLikeUrl(s)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|web\.)/, "");
    return HOST_PLATFORM[host] ?? null;
  } catch {
    return null;
  }
}

/**
 * Turns "@Handle", "handle" or a profile URL into a lowercase username.
 * Returns { username } or { error } with a friendly message.
 */
export function normaliseHandle(raw: string, platform: Platform): { username: string } | { error: string } {
  const s = raw.trim();
  if (!s) return { error: "Enter your username or profile link." };

  let candidate = s;
  if (looksLikeUrl(s)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return { error: "That link doesn't look right. Paste the profile link or just the username." };
    }
    const urlPlatform = platformFromInput(s);
    if (!urlPlatform) return { error: "We only recognise Instagram, YouTube, TikTok, X and Facebook links. For other sites, type the username." };
    if (urlPlatform !== platform) return { error: "That link is for a different platform than the one you picked." };

    const segs = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    if (platform === "facebook" && segs[0] === "profile.php") {
      candidate = url.searchParams.get("id") ?? "";
    } else if (platform === "youtube") {
      const at = segs.find((p) => p.startsWith("@"));
      if (at) candidate = at;
      else if ((segs[0] === "c" || segs[0] === "user" || segs[0] === "channel") && segs[1]) candidate = segs[1];
      else candidate = "";
    } else if (platform === "tiktok") {
      candidate = segs.find((p) => p.startsWith("@")) ?? "";
    } else if (platform === "instagram" && segs[0] === "stories" && segs[1]) {
      candidate = segs[1];
    } else {
      candidate = segs[0] && !RESERVED.has(segs[0].toLowerCase()) ? segs[0] : "";
    }
    if (!candidate) return { error: "We couldn't find a username in that link. Paste your profile link (not a post) or just the username." };
  }

  const username = candidate.trim().replace(/^@+/, "").replace(/[/?#].*$/, "").toLowerCase();
  if (!username) return { error: "Enter your username." };
  if (!USERNAME_RE.test(username)) return { error: "Usernames can only use letters, numbers, dots, dashes and underscores." };
  return { username };
}

/** Link to the public profile, for staff to check the bio. null when we can't build one. */
export function profileUrl(platform: string, username: string): string | null {
  const u = encodeURIComponent(username);
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${u}/`;
    case "youtube":
      return /^uc[a-z0-9_-]{20,}$/.test(username) ? `https://www.youtube.com/channel/${u}` : `https://www.youtube.com/@${u}`;
    case "tiktok":
      return `https://www.tiktok.com/@${u}`;
    case "x":
      return `https://x.com/${u}`;
    case "facebook":
      return /^\d+$/.test(username) ? `https://www.facebook.com/profile.php?id=${u}` : `https://www.facebook.com/${u}`;
    default:
      return null;
  }
}

export const MAX_ACCOUNTS_PER_CLIPPER = 50;
