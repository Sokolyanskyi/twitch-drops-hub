export type Benefit = {
  id: string;
  name: string;
  imageUrl: string;
  type: string;
};

export type Drop = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  requiredMinutes: number;
  watchedMinutes: number;
  isClaimed: boolean;
  claimId: string | null;
  canClaim: boolean;
  benefits: Benefit[];
};

export type CampaignStatus = "ACTIVE" | "UPCOMING" | "EXPIRED";

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
  imageUrl: string | null;
  boxArtUrl: string | null;
  detailsUrl: string | null;
  accountLinkUrl: string | null;
  game: { id: string; name: string; slug: string | null } | null;
  /** Game account is linked to Twitch — otherwise drops will not progress. */
  linked: boolean;
  drops: Drop[];
};

export type PublicUser = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

export type CampaignsResponse = {
  user: PublicUser;
  campaigns: Campaign[];
  fetchedAt: string;
};
