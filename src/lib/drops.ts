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

/**
 * Twitch sometimes returns plain arrays and sometimes connection objects ({ edges } / { nodes }),
 * depending on the operation version. Both shapes are accepted here.
 */
function extractCampaigns(payload: any): any[] | null {
  const raw = payload?.data?.currentUser?.dropCampaigns;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.edges)) {
    return raw.edges.map((edge: any) => edge?.node).filter(Boolean);
  }
  if (raw && Array.isArray(raw.nodes)) return raw.nodes;
  return null;
}

/** Compact description of an unexpected GraphQL response — used in error messages. */
function describePayload(payload: any): string {
  if (!payload || typeof payload !== "object") return `payload=${typeof payload}`;
  const graphqlError = firstGraphQLError(payload);
  if (graphqlError) return `errors: ${graphqlError.slice(0, 90)}`;

  const data = payload.data;
  if (!data) return `no data (keys: ${Object.keys(payload).join(",") || "none"})`;
  if (!("currentUser" in data)) return `data keys: ${Object.keys(data).join(",")}`;

  const currentUser = data.currentUser;
  if (currentUser === null) return "currentUser=null";

  const campaigns = currentUser?.dropCampaigns;
  if (campaigns === null) return "dropCampaigns=null";
  if (Array.isArray(campaigns)) return `dropCampaigns[${campaigns.length}]`;
  if (typeof campaigns === "object") return `dropCampaigns{${Object.keys(campaigns).join(",")}}`;
  return `dropCampaigns=${typeof campaigns}`;
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

const DASHBOARD_VARIABLES = { fetchRewardCampaigns: false };

/** Minimal selection set — used first, because Twitch is picky about unknown fields. */
const DASHBOARD_PROBE_QUERY = `query ViewerDropsDashboard {
  currentUser {
    id
    dropCampaigns {
      id
    }
  }
}`;

const DASHBOARD_MINIMAL_QUERY = `query ViewerDropsDashboard {
  currentUser {
    id
    dropCampaigns {
      id
      name
      startAt
      endAt
      status
      timeBasedDrops {
        id
        name
        startAt
        endAt
        requiredMinutesWatched
        benefitEdges { benefit { id name imageAssetURL } }
        self { dropInstanceID isClaimed currentMinutesWatched }
      }
    }
  }
}`;

/** Twitch clients that ship a Drops UI and therefore know the dropCampaigns field. */
const DROPS_CLIENT_IDS = ["kd1unb4b3q4t58fwlpcbzcbnm76a8fp"];

function dashboardClientIds(): string[] {
  return Array.from(new Set([gqlClientId(), ...DROPS_CLIENT_IDS, WEB_GQL_CLIENT_ID]));
}

type DashboardAttempt = { campaigns: any[] | null; notes: string[]; unauthorized: boolean };

function dashboardBodies(): unknown[] {
  return [DASHBOARD_PROBE_QUERY, DASHBOARD_MINIMAL_QUERY, DASHBOARD_RAW_QUERY].map((query) => ({
    operationName: "ViewerDropsDashboard",
    query,
    variables: DASHBOARD_VARIABLES,
  }));
}

async function tryDashboard(accessToken: string, clientId: string): Promise<DashboardAttempt> {
  const notes: string[] = [];
  let unauthorized = false;

  for (const body of dashboardBodies()) {
    let payload: any;
    try {
      payload = await gqlRequest(body, accessToken, clientId);
    } catch (error) {
      if (error instanceof TwitchError) {
        if (error.status === 401) unauthorized = true;
        notes.push(`http-${error.status}`);
      } else {
        notes.push(error instanceof Error ? error.message : String(error));
      }
      continue;
    }

    const campaigns = extractCampaigns(payload);
    if (campaigns) {
      return { campaigns, notes, unauthorized };
    }

    notes.push(`${describePayload(payload)} raw=${JSON.stringify(payload).slice(0, 240)}`);
  }

  return { campaigns: null, notes, unauthorized };
}

export async function fetchCampaigns(accessToken: string, userId: string): Promise<Campaign[]> {
  const notes: string[] = [];
  let allUnauthorized = true;

  for (const clientId of dashboardClientIds()) {
    const attempt = await tryDashboard(accessToken, clientId);
    if (attempt.campaigns) {
      return attempt.campaigns
        .map((campaign) => normalizeCampaign(campaign, userId))
        .filter((campaign: Campaign | null): campaign is Campaign => campaign !== null);
    }
    if (!attempt.unauthorized) allUnauthorized = false;
    notes.push(`${clientId.slice(0, 6)}: ${attempt.notes.join(" / ") || "empty response"}`);
  }

  if (allUnauthorized) {
    throw new TwitchError("Токен Twitch больше не действует — войдите заново.", 401);
  }

  throw new TwitchError(
    `Twitch не отдал список кампаний: ${notes.join(" | ") || "неизвестная ошибка"}`,
    502,
  );
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
