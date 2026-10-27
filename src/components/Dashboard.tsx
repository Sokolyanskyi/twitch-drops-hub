"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignsResponse, Drop, PublicUser } from "@/lib/types";
import { cn, pluralRu, timeAgo } from "@/lib/format";
import CampaignCard from "./CampaignCard";
import {
  BellIcon,
  CheckIcon,
  GiftIcon,
  LogoutIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
  StarIcon,
} from "./Icons";

const FAV_KEY = "dropshub:favorites:v1";
const SEEN_KEY = "dropshub:seen:v1";

type Tab = "all" | "favorites" | "received";
type StatusFilter = "active" | "upcoming" | "expired" | "all";
type Toast = { id: number; text: string; kind: "ok" | "err" };

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Активные",
  upcoming: "Скоро",
  expired: "Завершённые",
  all: "Все",
};

const SORT_RANK: Record<Campaign["status"], number> = {
  ACTIVE: 0,
  UPCOMING: 1,
  EXPIRED: 2,
};

const STATUS_TO_CAMPAIGN_STATUS: Record<Exclude<StatusFilter, "all">, Campaign["status"]> = {
  active: "ACTIVE",
  upcoming: "UPCOMING",
  expired: "EXPIRED",
};

function readList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function sortCampaigns(list: Campaign[]): Campaign[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return SORT_RANK[a.status] - SORT_RANK[b.status];
    if (a.status === "EXPIRED") return Date.parse(b.endsAt) - Date.parse(a.endsAt);
    return Date.parse(a.endsAt) - Date.parse(b.endsAt);
  });
}

function matchesQuery(campaign: Campaign, query: string): boolean {
  if (!query) return true;
  const haystack = [
    campaign.name,
    campaign.game?.name ?? "",
    ...campaign.drops.flatMap((drop) => [drop.name, ...drop.benefits.map((benefit) => benefit.name)]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function Dashboard({ user }: { user: PublicUser }) {
  const router = useRouter();

  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");

  const [favorites, setFavorites] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [claimingDropId, setClaimingDropId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifyAllowed, setNotifyAllowed] = useState(false);

  const notified = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    setFavorites(readList(FAV_KEY));
    setSeen(readList(SEEN_KEY));
    setHydrated(true);
    if (typeof Notification !== "undefined") setNotifyAllowed(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-5000)));
  }, [seen, hydrated]);

  const pushToast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch("/api/drops", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const json = (await res.json()) as CampaignsResponse & { message?: string; error?: string };
        if (!res.ok) throw new Error(json.message ?? "Не удалось загрузить кампании");
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить кампании");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 90_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const campaigns = data?.campaigns ?? [];

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const seenSet = useMemo(() => new Set(seen), [seen]);

  /** New (not seen yet) drops inside favourite campaigns. */
  const newDrops = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const campaign of campaigns) {
      if (!favoriteSet.has(campaign.id)) continue;
      const ids = new Set<string>();
      for (const drop of campaign.drops) {
        if (!drop.isClaimed && !seenSet.has(drop.id)) ids.add(drop.id);
      }
      if (ids.size > 0) map.set(campaign.id, ids);
    }
    return map;
  }, [campaigns, favoriteSet, seenSet]);

  const newCount = useMemo(
    () => Array.from(newDrops.values()).reduce((sum, ids) => sum + ids.size, 0),
    [newDrops],
  );

  const markSeen = useCallback((ids: Iterable<string>) => {
    const list = Array.from(ids);
    if (list.length === 0) return;
    setSeen((prev) => Array.from(new Set([...prev, ...list])));
  }, []);

  useEffect(() => {
    if (firstLoad.current || !data) return;

    const permission = typeof Notification !== "undefined" ? Notification.permission : "denied";
    if (permission !== "granted") return;

    const fresh: string[] = [];
    newDrops.forEach((ids) => {
      ids.forEach((id) => {
        if (!notified.current.has(id)) fresh.push(id);
        notified.current.add(id);
      });
    });

    if (fresh.length > 0) {
      try {
        new Notification("Новые дропсы в избранном", {
          body: `${fresh.length} ${pluralRu(fresh.length, ["новая награда", "новые награды", "новых наград"])} ждёт вас в Drops Hub`,
          icon: user.avatarUrl || undefined,
        });
      } catch {
        /* notifications may be blocked by the browser policy */
      }
    }
  }, [data, newDrops, user.avatarUrl]);

  useEffect(() => {
    if (data) firstLoad.current = false;
  }, [data]);

  // Mark drops as seen automatically after 30 seconds on the "Favorites" tab.
  useEffect(() => {
    if (tab !== "favorites" || newCount === 0) return;
    const timer = setTimeout(() => {
      const ids: string[] = [];
      newDrops.forEach((set) => set.forEach((id) => ids.push(id)));
      markSeen(ids);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [tab, newCount, newDrops, markSeen]);

  const toggleFavorite = useCallback((campaignId: string) => {
    setFavorites((prev) =>
      prev.includes(campaignId) ? prev.filter((id) => id !== campaignId) : [...prev, campaignId],
    );
  }, []);

  const claim = useCallback(
    async (campaign: Campaign, drop: Drop) => {
      if (!drop.claimId) return;
      setClaimingDropId(drop.id);
      try {
        const res = await fetch("/api/drops/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId: drop.claimId }),
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (!res.ok) throw new Error(json.message ?? "Не удалось забрать дропс");

        pushToast(json.message ?? "Готово", json.ok ? "ok" : "err");

        if (json.ok) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  campaigns: prev.campaigns.map((item) =>
                    item.id === campaign.id
                      ? {
                          ...item,
                          drops: item.drops.map((entry) =>
                            entry.id === drop.id
                              ? {
                                  ...entry,
                                  isClaimed: true,
                                  canClaim: false,
                                  watchedMinutes: entry.requiredMinutes,
                                }
                              : entry,
                          ),
                        }
                      : item,
                  ),
                }
              : prev,
          );
          markSeen([drop.id]);
        }
      } catch (err) {
        pushToast(err instanceof Error ? err.message : "Ошибка при получении дропса", "err");
      } finally {
        setClaimingDropId(null);
      }
    },
    [markSeen, pushToast, router],
  );

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      pushToast("Браузер не поддерживает уведомления", "err");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifyAllowed(permission === "granted");
    pushToast(
      permission === "granted" ? "Уведомления включены" : "Уведомления отключены в браузере",
      permission === "granted" ? "ok" : "err",
    );
  };

  const logout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  const normalizedQuery = query.trim().toLowerCase();

  const visibleCampaigns = useMemo(() => {
    const effectiveStatus: StatusFilter = tab === "received" ? "all" : statusFilter;
    let list = campaigns;

    if (tab === "favorites") list = list.filter((campaign) => favoriteSet.has(campaign.id));
    if (tab === "received") list = list.filter((campaign) => campaign.drops.some((drop) => drop.isClaimed));
    if (effectiveStatus !== "all") {
      const wanted = STATUS_TO_CAMPAIGN_STATUS[effectiveStatus];
      list = list.filter((campaign) => campaign.status === wanted);
    }
    if (normalizedQuery) list = list.filter((campaign) => matchesQuery(campaign, normalizedQuery));

    return sortCampaigns(list);
  }, [campaigns, tab, statusFilter, normalizedQuery, favoriteSet]);

  const counts = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
    const claimed = campaigns.reduce(
      (sum, campaign) => sum + campaign.drops.filter((drop) => drop.isClaimed).length,
      0,
    );
    const claimable = campaigns.reduce(
      (sum, campaign) => sum + campaign.drops.filter((drop) => drop.canClaim).length,
      0,
    );
    return { active, claimed, claimable, total: campaigns.length };
  }, [campaigns]);

  const statusCounts = useMemo(() => {
    const base =
      tab === "favorites"
        ? campaigns.filter((campaign) => favoriteSet.has(campaign.id))
        : tab === "received"
          ? campaigns.filter((campaign) => campaign.drops.some((drop) => drop.isClaimed))
          : campaigns;
    return {
      active: base.filter((campaign) => campaign.status === "ACTIVE").length,
      upcoming: base.filter((campaign) => campaign.status === "UPCOMING").length,
      expired: base.filter((campaign) => campaign.status === "EXPIRED").length,
      all: base.length,
    };
  }, [campaigns, favoriteSet, tab]);

  const tabs: Array<{ id: Tab; label: string; badge?: number; icon: React.ReactNode }> = [
    {
      id: "all",
      label: "Все кампании",
      icon: <GiftIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
    },
    {
      id: "favorites",
      label: "Избранное",
      badge: newCount || favorites.length,
      icon: <StarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
    },
    {
      id: "received",
      label: "Полученные",
      badge: counts.claimed || undefined,
      icon: <CheckIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
    },
  ];

  const emptyText =
    tab === "favorites"
      ? favorites.length === 0
        ? "Пока пусто. Нажмите на звёздочку в карточке кампании — и она появится здесь."
        : "В избранном нет кампаний с выбранным статусом."
      : tab === "received"
        ? "Здесь появятся дропсы, которые вы заберёте. Пока ничего не получено."
        : normalizedQuery
          ? "Ничего не нашлось. Попробуйте другой запрос."
          : "Кампаний с таким статусом сейчас нет.";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
              <GiftIcon className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">Drops Hub</p>
              <p className="hidden text-[11px] text-muted sm:block">
                {data ? `${counts.total} ${pluralRu(counts.total, ["кампания", "кампании", "кампаний"])}` : "Twitch Drops"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              title="Обновить"
              className="rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              <RefreshIcon className={cn("h-4.5 w-4.5", refreshing && "animate-spin")} />
            </button>

            <div className="hidden items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 sm:flex">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent-2">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="max-w-[9rem] truncate text-xs text-[#dcdce4]">{user.displayName}</span>
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              title="Выйти"
              className="rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-white"
            >
              <LogoutIcon className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <p className="text-[10px] uppercase leading-tight tracking-wide text-muted sm:text-[11px]">
              Активных кампаний
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{counts.active}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <p className="text-[10px] uppercase leading-tight tracking-wide text-muted sm:text-[11px]">
              В избранном
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-xl font-semibold tabular-nums sm:text-2xl">
              {favorites.length}
              {newCount > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white sm:px-2 sm:text-[11px]">
                  +{newCount}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <p className="text-[10px] uppercase leading-tight tracking-wide text-muted sm:text-[11px]">
              Получено дропсов
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-xl font-semibold tabular-nums sm:text-2xl">
              {counts.claimed}
              {counts.claimable > 0 && (
                <span className="hidden items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok sm:inline-flex">
                  <SparkIcon className="h-3 w-3" />
                  {counts.claimable} к получению
                </span>
              )}
            </p>
          </div>
        </section>

        <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 no-scrollbar">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition sm:gap-2 sm:px-3 sm:text-xs",
                tab === item.id ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white",
              )}
            >
              {item.icon}
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    item.id === "favorites" && newCount > 0
                      ? "bg-accent text-white"
                      : "bg-white/10 text-[#dcdce4]",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                disabled={tab === "received"}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition disabled:opacity-40",
                  statusFilter === status
                    ? "border-accent/40 bg-accent/15 text-white"
                    : "border-line text-muted hover:border-white/20 hover:text-white",
                )}
              >
                {STATUS_LABELS[status]}
                <span className="ml-1 text-[10px] opacity-70">{statusCounts[status]}</span>
              </button>
            ))}
          </div>

          <div className="relative sm:ml-auto sm:w-64">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Игра или награда…"
              className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-muted focus:border-accent/50"
            />
          </div>
        </div>

        {tab === "favorites" && newCount > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/[0.09] p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent-2">
                <BellIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {newCount} {pluralRu(newCount, ["новая награда", "новые награды", "новых наград"])} в избранном
                </p>
                <p className="text-[11px] text-muted">
                  Отмечены значком new. Помечаются просмотренными через 30 секунд на этой вкладке.
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              {!notifyAllowed && (
                <button
                  type="button"
                  onClick={() => void enableNotifications()}
                  className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-[#dcdce4] transition hover:border-accent/40 hover:text-white"
                >
                  Включить уведомления
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const ids: string[] = [];
                  newDrops.forEach((set) => set.forEach((id) => ids.push(id)));
                  markSeen(ids);
                }}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/15"
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center">
            <p className="text-xs text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] text-white transition hover:bg-white/15 sm:ml-auto"
            >
              Повторить
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-muted">
              <GiftIcon className="h-6 w-6" />
            </span>
            <p className="max-w-sm text-sm text-muted">{emptyText}</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCampaigns.map((campaign) => {
              const view =
                tab === "received"
                  ? { ...campaign, drops: campaign.drops.filter((drop) => drop.isClaimed) }
                  : campaign;
              return (
                <CampaignCard
                  key={campaign.id}
                  campaign={view}
                  favorite={favoriteSet.has(campaign.id)}
                  newDropIds={newDrops.get(campaign.id) ?? new Set<string>()}
                  claimingDropId={claimingDropId}
                  totalDrops={campaign.drops.length}
                  claimedDrops={campaign.drops.filter((drop) => drop.isClaimed).length}
                  onToggleFavorite={toggleFavorite}
                  onClaim={(target, drop) => void claim(target, drop)}
                />
              );
            })}
          </div>
        )}

        <footer className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[11px] text-muted">
          <p>
            Обновлено {data ? timeAgo(data.fetchedAt) : "—"}. Список обновляется автоматически каждые
            90 секунд.
          </p>
          <p>
            Drops Hub не накручивает время просмотра: прогресс начисляет Twitch, а приложение
            показывает кампании и помогает забрать готовые награды.
          </p>
        </footer>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-xs shadow-lg backdrop-blur animate-fade-up",
              toast.kind === "ok"
                ? "border-ok/30 bg-ok/15 text-ok"
                : "border-red-500/30 bg-red-500/15 text-red-200",
            )}
          >
            {toast.kind === "ok" ? <CheckIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
