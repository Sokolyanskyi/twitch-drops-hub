import type { Benefit, Campaign, CampaignStatus, Drop } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Pure helpers that turn a raw `ViewerDropsDashboard` GraphQL payload into the
 * campaign model used by the UI. Runs in the browser: the payload comes from the
 * Drops Hub extension, which captures it from the user's own twitch.tv tab.
 */

export function firstGraphQLError(payload: any): string | null {
  const errors = payload?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return String(errors[0]?.message ?? "GraphQL error");
  }
  return null;
}

/**
 * Twitch may return a plain array or a connection object ({ edges } / { nodes })
 * depending on the operation version. Both shapes are accepted.
 */
export function extractCampaigns(payload: any): any[] | null {
  const raw = payload?.data?.currentUser?.dropCampaigns;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.edges)) {
    return raw.edges.map((edge: any) => edge?.node).filter(Boolean);
  }
  if (raw && Array.isArray(raw.nodes)) return raw.nodes;
  return null;
}

function computeStatus(apiStatus: string, startsAt: number, endsAt: number): CampaignStatus {
  const now = Date.now();
  if (apiStatus === "EXPIRED" || endsAt <= now) return "EXPIRED";
  if (startsAt > now) return "UPCOMING";
  return "ACTIVE";
}

function toBenefits(raw: any): Benefit[] {
  const edges: any[] = Array.isArray(raw?.benefitEdges)
    ? raw.benefitEdges
    : raw?.benefit
      ? [{ benefit: raw.benefit }]
      : [];

  return edges
    .map((edge) => edge?.benefit)
    .filter(Boolean)
    .map((benefit: any) => ({
      id: String(benefit.id ?? ""),
      name: String(benefit.name ?? "Reward"),
      imageUrl: String(benefit.imageAssetURL ?? ""),
      type: String(benefit.distributionType ?? ""),
    }));
}

function normalizeDrop(raw: any, campaignId: string, userId: string): Drop | null {
  if (!raw?.id) return null;

  const requiredMinutes = Number(raw.requiredMinutesWatched ?? 0) || 0;
  const watchedMinutes = Number(raw?.self?.currentMinutesWatched ?? 0) || 0;
  const isClaimed = Boolean(raw?.self?.isClaimed);
  const claimId =
    raw?.self?.dropInstanceID != null && raw.self.dropInstanceID !== ""
      ? String(raw.self.dropInstanceID)
      : `${userId}#${campaignId}#${raw.id}`;

  return {
    id: String(raw.id),
    name: String(raw.name ?? "Drop"),
    startsAt: String(raw.startAt ?? ""),
    endsAt: String(raw.endAt ?? ""),
    requiredMinutes,
    watchedMinutes,
    isClaimed,
    claimId,
    canClaim: !isClaimed && requiredMinutes > 0 && watchedMinutes >= requiredMinutes,
    benefits: toBenefits(raw),
  };
}

function normalizeCampaign(raw: any, userId: string): Campaign | null {
  if (!raw?.id) return null;

  const startsAt = raw.startAt ? Date.parse(String(raw.startAt)) : 0;
  const endsAt = raw.endAt ? Date.parse(String(raw.endAt)) : 0;

  const drops = (Array.isArray(raw.timeBasedDrops) ? raw.timeBasedDrops : [])
    .map((drop: any) => normalizeDrop(drop, String(raw.id), userId))
    .filter((drop: Drop | null): drop is Drop => drop !== null)
    .sort((a: Drop, b: Drop) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const game = raw.game
    ? {
        id: String(raw.game.id ?? ""),
        name: String(raw.game.name ?? raw.game.displayName ?? ""),
        slug: raw.game.slug ? String(raw.game.slug) : null,
      }
    : null;

  return {
    id: String(raw.id),
    name: String(raw.name ?? game?.name ?? "Campaign"),
    status: computeStatus(String(raw.status ?? ""), startsAt, endsAt),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    imageUrl: raw.imageURL ? String(raw.imageURL) : null,
    boxArtUrl: raw?.game?.boxArtURL ? String(raw.game.boxArtURL) : null,
    detailsUrl: raw.detailsURL ? String(raw.detailsURL) : null,
    accountLinkUrl: raw.accountLinkURL ? String(raw.accountLinkURL) : null,
    game,
    linked: Boolean(raw?.self?.isAccountConnected),
    drops,
  };
}

export type NormalizedSnapshot = {
  userId: string;
  campaigns: Campaign[];
};

/** Normalizes a captured `ViewerDropsDashboard` payload. */
export function normalizeSnapshot(payload: any): NormalizedSnapshot {
  const userId = String(payload?.data?.currentUser?.id ?? "");
  const rawCampaigns = extractCampaigns(payload) ?? [];
  const campaigns = rawCampaigns
    .map((campaign) => normalizeCampaign(campaign, userId))
    .filter((campaign: Campaign | null): campaign is Campaign => campaign !== null);

  return { userId, campaigns };
}
