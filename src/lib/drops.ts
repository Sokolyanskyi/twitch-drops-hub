import { gqlRequest, TwitchError } from "./twitch";
import { gqlClientId, WEB_GQL_CLIENT_ID } from "./config";
import type { Benefit, Campaign, CampaignStatus, Drop } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * gql.twitch.tv is picky about the "client id + token" pair. If the primary client id
 * does not fit, the request is retried with the public client id of the Twitch website.
 */
async function gqlAny<T = any>(body: unknown, accessToken: string): Promise<T> {
  const primary = gqlClientId();
  try {
    return await gqlRequest<T>(body, accessToken, primary);
  } catch (error) {
    if (
      error instanceof TwitchError &&
      (error.status === 401 || error.status === 403) &&
      primary !== WEB_GQL_CLIENT_ID
    ) {
      return await gqlRequest<T>(body, accessToken, WEB_GQL_CLIENT_ID);
    }
    throw error;
  }
}

/**
 * Twitch does not document a public Drops campaigns API, so the same GraphQL API that
 * twitch.tv uses is queried. Every request is sent in two flavours: first as a persisted
 * query (the fast path used by the website), then as plain query text — in case the
 * hashes on the Twitch side have been rotated.
 */
const DASHBOARD_HASHES = [
  "c16bb890cc8ce7647a96ee69cd313d423a378a3dedadf630a1017cde18975feb",
  "e8b98b52bbd7ccd37d0b671ad0d47be5238caa5bea637d2a65776175b4a23a64",
];

const CLAIM_HASHES = [
  "a455deea71bdc9015b78eb49f4acfbce8baa7ccbedd28e549bb025bd0f751930",
];

const DASHBOARD_RAW_QUERY = `query ViewerDropsDashboard {
  currentUser {
    id
    dropCampaigns {
      id
      name
      status
      startAt
      endAt
      imageURL
      detailsURL
      accountLinkURL
      game { id name slug boxArtURL }
      self { isAccountConnected }
      timeBasedDrops {
        id
        name
        startAt
        endAt
        requiredMinutesWatched
        benefitEdges { benefit { id name distributionType imageAssetURL } }
        self { dropInstanceID isClaimed currentMinutesWatched }
      }
    }
  }
}`;

const CLAIM_RAW_MUTATION = `mutation DropsPage_ClaimDropRewards($input: DropsPageClaimDropRewardsInput!) {
  claimDropRewards(input: $input) {
    status
    dropInstanceID
  }
}`;

function firstGraphQLError(payload: any): string | null {
  const errors = payload?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return String(errors[0]?.message ?? "ошибка GraphQL");
  }
  return null;
}

function hasCampaigns(payload: any): boolean {
  return Array.isArray(payload?.data?.currentUser?.dropCampaigns);
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
      name: String(benefit.name ?? "Награда"),
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
    name: String(raw.name ?? "Дропс"),
    startsAt: String(raw.startAt ?? ""),
    endsAt: String(raw.endAt ?? ""),
    requiredMinutes,
    watchedMinutes,
    isClaimed,
    claimId,
    canClaim: !isClaimed && watchedMinutes >= requiredMinutes && requiredMinutes > 0,
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
    name: String(raw.name ?? game?.name ?? "Кампания"),
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

export async function fetchCampaigns(accessToken: string, userId: string): Promise<Campaign[]> {
  const failures: string[] = [];
  let campaigns: any[] | null = null;

  for (const sha256Hash of DASHBOARD_HASHES) {
    try {
      const payload = await gqlAny(
        {
          operationName: "ViewerDropsDashboard",
          variables: { fetchRewardCampaigns: false },
          extensions: { persistedQuery: { version: 1, sha256Hash } },
        },
        accessToken,
      );
      if (hasCampaigns(payload)) {
        campaigns = (payload as any).data.currentUser.dropCampaigns;
        break;
      }
      failures.push(firstGraphQLError(payload) ?? "persisted query не найден");
    } catch (error) {
      if (error instanceof TwitchError && error.status === 401) throw error;
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!campaigns) {
    const payload = await gqlAny(
      {
        operationName: "ViewerDropsDashboard",
        query: DASHBOARD_RAW_QUERY,
        variables: { fetchRewardCampaigns: false },
      },
      accessToken,
    );
    if (!hasCampaigns(payload)) {
      throw new TwitchError(
        `Twitch не отдал список кампаний: ${firstGraphQLError(payload) ?? failures[0] ?? "неизвестная ошибка"}`,
        502,
      );
    }
    campaigns = (payload as any).data.currentUser.dropCampaigns;
  }

  const rawCampaigns: any[] = campaigns ?? [];

  return rawCampaigns
    .map((campaign) => normalizeCampaign(campaign, userId))
    .filter((campaign: Campaign | null): campaign is Campaign => campaign !== null);
}

export type ClaimResult = { ok: boolean; status: string; message?: string };

export async function claimDrop(accessToken: string, dropInstanceId: string): Promise<ClaimResult> {
  const variables = { input: { dropInstanceID: dropInstanceId } };

  for (const sha256Hash of CLAIM_HASHES) {
    try {
      const payload: any = await gqlAny(
        {
          operationName: "DropsPage_ClaimDropRewards",
          variables,
          extensions: { persistedQuery: { version: 1, sha256Hash } },
        },
        accessToken,
      );
      const result = payload?.data?.claimDropRewards;
      if (result?.status) {
        return {
          ok: result.status === "SUCCESS",
          status: String(result.status),
        };
      }
    } catch {
      // try the next request flavour
    }
  }

  const payload: any = await gqlAny(
    {
      operationName: "DropsPage_ClaimDropRewards",
      query: CLAIM_RAW_MUTATION,
      variables,
    },
    accessToken,
  );

  const result = payload?.data?.claimDropRewards;
  if (!result?.status) {
    throw new TwitchError(
      `Не удалось забрать дропс: ${firstGraphQLError(payload) ?? "Twitch не вернул результат"}`,
      502,
    );
  }

  return { ok: result.status === "SUCCESS", status: String(result.status) };
}
