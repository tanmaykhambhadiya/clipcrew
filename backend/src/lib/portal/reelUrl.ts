// Validates a reel/post link for a given platform and builds a normalised key, so the same reel
// can't be submitted twice even when the link is written differently (www., share params, p/ vs reel/).

export type UrlCheck = { ok: true; url: string; key: string } | { ok: false; error: string };

const bad = (error: string): UrlCheck => ({ ok: false, error });

const LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook", x: "X", other: "" };

export function checkReelUrl(raw: string, platform: string): UrlCheck {
  const input = raw.trim();
  if (!input) return bad("Paste the link to your reel.");
  if (input.length > 500) return bad("That link is too long (500 characters at most).");
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return bad("That doesn't look like a link. Paste the full address starting with https://");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return bad("Only web links (https://…) are accepted.");
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  const wrong = () => bad(`That doesn't look like a ${LABEL[platform] ?? platform} link for this account.`);

  switch (platform) {
    case "instagram": {
      if (host !== "instagram.com" && host !== "instagr.am") return wrong();
      const m = /^\/(?:[A-Za-z0-9._]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(path);
      return m ? { ok: true, url: input, key: `instagram.com/${m[1]}` } : bad("Paste the link to the reel itself (instagram.com/reel/…), not a profile.");
    }
    case "youtube": {
      if (host === "youtu.be") {
        const id = path.split("/")[1];
        return id ? { ok: true, url: input, key: `youtube.com/${id}` } : wrong();
      }
      if (host !== "youtube.com") return wrong();
      const short = /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]+)/.exec(path);
      if (short) return { ok: true, url: input, key: `youtube.com/${short[1]}` };
      const v = path === "/watch" ? u.searchParams.get("v") : null;
      return v ? { ok: true, url: input, key: `youtube.com/${v}` } : bad("Paste the link to the video or Short itself, not a channel.");
    }
    case "tiktok": {
      if (!host.endsWith("tiktok.com")) return wrong();
      const m = /\/video\/(\d+)/.exec(path);
      if (m) return { ok: true, url: input, key: `tiktok.com/${m[1]}` };
      // short links (vm.tiktok.com/XXXX, tiktok.com/t/XXXX)
      return path.length > 2 && !/^\/@[^/]+$/.test(path) ? { ok: true, url: input, key: `${host}${path}` } : bad("Paste the link to the video itself, not a profile.");
    }
    case "facebook": {
      if (host !== "facebook.com" && host !== "fb.watch" && host !== "fb.com") return wrong();
      return path.length > 1 ? { ok: true, url: input, key: `${host}${path}${u.searchParams.get("v") ? `?v=${u.searchParams.get("v")}` : ""}` } : bad("Paste the link to the reel or video itself.");
    }
    case "x": {
      if (host !== "x.com" && host !== "twitter.com") return wrong();
      const m = /\/status\/(\d+)/.exec(path);
      return m ? { ok: true, url: input, key: `x.com/${m[1]}` } : bad("Paste the link to the post itself (…/status/…).");
    }
    default:
      return path.length > 1 || u.search ? { ok: true, url: input, key: `${host}${path}${u.search}` } : bad("Paste the link to the post itself.");
  }
}

/** Same key as checkReelUrl, but works out the platform from the link itself. null = not a usable link. */
export function reelKey(raw: string): string | null {
  let host = "";
  try {
    host = new URL(raw.trim()).hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, "");
  } catch {
    return null;
  }
  const platform =
    host === "instagram.com" || host === "instagr.am" ? "instagram"
    : host === "youtube.com" || host === "youtu.be" ? "youtube"
    : host.endsWith("tiktok.com") ? "tiktok"
    : host === "facebook.com" || host === "fb.watch" || host === "fb.com" ? "facebook"
    : host === "x.com" || host === "twitter.com" ? "x"
    : "other";
  const r = checkReelUrl(raw, platform);
  return r.ok ? r.key : null;
}
