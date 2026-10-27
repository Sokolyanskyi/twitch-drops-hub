import type { Campaign, CampaignsResponse, Drop, PublicUser } from "./types";

/**
 * Demo data for previewing the interface locally without a Twitch account.
 * Enabled only with DROPS_MOCK=1 — never used in production.
 */

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function iso(offsetMs: number): string {
  return new Date(now + offsetMs).toISOString();
}

function drop(
  id: string,
  name: string,
  required: number,
  watched: number,
  claimed: boolean,
  imageId: string,
  startsAt: number,
  endsAt: number,
): Drop {
  return {
    id,
    name,
    startsAt: iso(startsAt),
    endsAt: iso(endsAt),
    requiredMinutes: required,
    watchedMinutes: claimed ? required : watched,
    isClaimed: claimed,
    claimId: `mock#${id}`,
    canClaim: !claimed && watched >= required && required > 0,
    benefits: [
      {
        id: `${id}-b`,
        name,
        imageUrl: `https://static-cdn.jtvnw.net/ttv-boxart/${imageId}-144x192.jpg`,
        type: "DROPS_BENEFIT",
      },
    ],
  };
}

const campaigns: Campaign[] = [
  {
    id: "c-apex",
    name: "Apex Legends: Раскол",
    status: "ACTIVE",
    startsAt: iso(-3 * DAY),
    endsAt: iso(5 * DAY + 4 * 60 * 60 * 1000),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/511224-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/511224-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: null,
    game: { id: "511224", name: "Apex Legends", slug: "apex-legends" },
    linked: true,
    drops: [
      drop("d1", "Значок «Раскол»", 60, 60, false, "511224", -3 * DAY, 5 * DAY),
      drop("d2", "Эмблема «Разлом»", 120, 45, false, "511224", -3 * DAY, 5 * DAY),
      drop("d3", "Скин «Пустота»", 240, 240, true, "511224", -3 * DAY, 5 * DAY),
    ],
  },
  {
    id: "c-wow",
    name: "World of Warcraft: The War Within",
    status: "ACTIVE",
    startsAt: iso(-1 * DAY),
    endsAt: iso(2 * DAY),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: "https://account.battle.net/connections",
    game: { id: "32982", name: "World of Warcraft", slug: "world-of-warcraft" },
    linked: false,
    drops: [
      drop("w1", "Скакун «Грозовой»", 180, 180, false, "32982_IGDB", -1 * DAY, 2 * DAY),
      drop("w2", "Питомец «Искра»", 300, 120, false, "32982_IGDB", -1 * DAY, 2 * DAY),
    ],
  },
  {
    id: "c-rivals",
    name: "Marvel Rivals: Сезон 2",
    status: "UPCOMING",
    startsAt: iso(3 * DAY),
    endsAt: iso(17 * DAY),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/21779-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/21779-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: null,
    game: { id: "21779", name: "Marvel Rivals", slug: "marvel-rivals" },
    linked: true,
    drops: [drop("m1", "Спрей «Команда»", 90, 0, false, "21779", 3 * DAY, 17 * DAY)],
  },
  {
    id: "c-diablo",
    name: "Diablo IV: Сезон крови",
    status: "ACTIVE",
    startsAt: iso(-6 * DAY),
    endsAt: iso(9 * DAY),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/491487-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/491487-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: null,
    game: { id: "491487", name: "Diablo IV", slug: "diablo-iv" },
    linked: true,
    drops: [
      drop("di1", "Трофей «Кровавый»", 60, 60, false, "491487", -6 * DAY, 9 * DAY),
      drop("di2", "Моунт «Пепел»", 150, 150, false, "491487", -6 * DAY, 9 * DAY),
      drop("di3", "Облик «Тьма»", 300, 300, true, "491487", -6 * DAY, 9 * DAY),
      drop("di4", "Титул «Страж»", 480, 320, false, "491487", -6 * DAY, 9 * DAY),
    ],
  },
  {
    id: "c-genshin",
    name: "Genshin Impact: Праздник ветра",
    status: "EXPIRED",
    startsAt: iso(-20 * DAY),
    endsAt: iso(-2 * DAY),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: null,
    game: { id: "509658", name: "Genshin Impact", slug: "genshin-impact" },
    linked: true,
    drops: [
      drop("g1", "Крылья «Ветер»", 120, 120, true, "509658", -20 * DAY, -2 * DAY),
      drop("g2", "Мора ×100000", 240, 240, true, "509658", -20 * DAY, -2 * DAY),
    ],
  },
  {
    id: "c-hsr",
    name: "Honkai: Star Rail — Легенды",
    status: "ACTIVE",
    startsAt: iso(-2 * DAY),
    endsAt: iso(11 * DAY),
    imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/33214-144x192.jpg",
    boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/33214-144x192.jpg",
    detailsUrl: "https://www.twitch.tv/drops/campaigns",
    accountLinkUrl: null,
    game: { id: "33214", name: "Honkai: Star Rail", slug: "honkai-star-rail" },
    linked: true,
    drops: [drop("h1", "Аватар «Звезда»", 90, 15, false, "33214", -2 * DAY, 11 * DAY)],
  },
];

export const mockUser: PublicUser = {
  id: "mock-user",
  login: "mock_streamer",
  displayName: "Mock Streamer",
  avatarUrl: "https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg",
};

export function mockPayload(): CampaignsResponse {
  return {
    user: mockUser,
    campaigns,
    fetchedAt: new Date().toISOString(),
  };
}
