"use client";

import type { Campaign, Drop } from "@/lib/types";
import { cn, formatDate, formatMinutes, timeLeftLabel } from "@/lib/format";
import { CheckIcon, ClockIcon, ExternalIcon, StarIcon } from "./Icons";

type Props = {
  campaign: Campaign;
  favorite: boolean;
  newDropIds: Set<string>;
  claimingDropId: string | null;
  totalDrops?: number;
  claimedDrops?: number;
  onToggleFavorite: (campaignId: string) => void;
  onClaim: (campaign: Campaign, drop: Drop) => void;
};

function Progress({ value, done }: { value: number; done: boolean }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          done ? "bg-ok" : "bg-gradient-to-r from-accent to-accent-2",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("animate-spin", className)} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatusChip({ campaign }: { campaign: Campaign }) {
  if (campaign.status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/12 px-2 py-0.5 text-[11px] font-medium text-ok ring-1 ring-ok/25">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        Активна
      </span>
    );
  }
  if (campaign.status === "UPCOMING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-2 ring-1 ring-accent/25">
        <ClockIcon className="h-3 w-3" />
        Скоро
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-white/10">
      Завершена
    </span>
  );
}

function DropRow({
  drop,
  isNew,
  claiming,
  onClaim,
}: {
  drop: Drop;
  isNew: boolean;
  claiming: boolean;
  onClaim: () => void;
}) {
  const total = Math.max(1, drop.requiredMinutes);
  const percent = drop.isClaimed ? 100 : Math.min(100, (drop.watchedMinutes / total) * 100);
  const title = drop.benefits.map((benefit) => benefit.name).join(" · ") || drop.name;
  const image = drop.benefits.find((benefit) => benefit.imageUrl)?.imageUrl;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border p-2.5 transition",
        drop.isClaimed
          ? "border-ok/25 bg-ok/[0.07]"
          : "border-white/[0.06] bg-white/[0.015] hover:border-white/12",
      )}
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[10px] text-muted">?</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-medium text-[#e9e9ee]" title={title}>
            {title}
          </p>
          {isNew && (
            <span className="shrink-0 rounded bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
              new
            </span>
          )}
          {drop.isClaimed && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-ok">
              <CheckIcon className="h-3 w-3" />
              Получено
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={percent} done={drop.isClaimed || percent >= 100} />
          <span className="shrink-0 text-[10px] tabular-nums text-muted">
            {formatMinutes(drop.watchedMinutes)} / {formatMinutes(drop.requiredMinutes)}
          </span>
        </div>
      </div>

      {drop.canClaim && (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#7d32e8] disabled:cursor-wait disabled:opacity-70"
        >
          {claiming ? <Spinner className="h-3.5 w-3.5" /> : "Забрать"}
        </button>
      )}
    </div>
  );
}

export default function CampaignCard({
  campaign,
  favorite,
  newDropIds,
  claimingDropId,
  totalDrops,
  claimedDrops,
  onToggleFavorite,
  onClaim,
}: Props) {
  const totalDropCount = totalDrops ?? campaign.drops.length;
  const claimedDropCount =
    claimedDrops ?? campaign.drops.filter((drop) => drop.isClaimed).length;
  const cover = campaign.imageUrl ?? campaign.boxArtUrl ?? null;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition duration-200",
        favorite
          ? "border-accent/35 shadow-[0_0_0_1px_rgba(145,70,255,0.15)]"
          : "border-line hover:border-white/15",
      )}
    >
      <header className="relative isolate px-4 pt-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full scale-105 object-cover opacity-[0.18] blur-[2px] transition duration-500 group-hover:opacity-25"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-surface/60 via-surface/90 to-surface" />

        <div className="flex items-start gap-3">
          <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
            {campaign.boxArtUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={campaign.boxArtUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted">
              {campaign.game?.name ?? "Twitch"}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
              {campaign.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(campaign.id)}
            aria-pressed={favorite}
            aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
            title={favorite ? "Убрать из избранного" : "В избранное"}
            className={cn(
              "shrink-0 rounded-lg p-1.5 transition",
              favorite
                ? "bg-accent/15 text-accent-2 hover:bg-accent/25"
                : "text-muted hover:bg-white/5 hover:text-white",
            )}
          >
            <StarIcon className="h-5 w-5" filled={favorite} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 pb-3">
          <StatusChip campaign={campaign} />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted ring-1 ring-white/10">
            <ClockIcon className="h-3 w-3" />
            {campaign.status === "ACTIVE"
              ? `осталось ${timeLeftLabel(campaign.endsAt)}`
              : campaign.status === "UPCOMING"
                ? `старт ${formatDate(campaign.startsAt)}`
                : `до ${formatDate(campaign.endsAt)}`}
          </span>
          {totalDropCount > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1",
                claimedDropCount === totalDropCount
                  ? "bg-ok/10 text-ok ring-ok/20"
                  : "bg-white/5 text-muted ring-white/10",
              )}
            >
              {claimedDropCount}/{totalDropCount} получено
            </span>
          )}
        </div>
      </header>

      {!campaign.linked && campaign.status !== "EXPIRED" && (
        <div className="mx-3 mb-2 rounded-lg border border-warn/25 bg-warn/[0.08] px-2.5 py-2 text-[11px] leading-relaxed text-warn">
          Аккаунт игры не привязан к Twitch — дропсы не начнут начисляться.{" "}
          {campaign.accountLinkUrl && (
            <a
              href={campaign.accountLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2"
            >
              Привязать
              <ExternalIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <div className="max-h-[21rem] flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {campaign.drops.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted">В кампании пока нет наград</p>
        )}
        {campaign.drops.map((drop) => (
          <DropRow
            key={drop.id}
            drop={drop}
            isNew={newDropIds.has(drop.id)}
            claiming={claimingDropId === drop.id}
            onClaim={() => onClaim(campaign, drop)}
          />
        ))}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-muted">
        <span className="truncate">
          {campaign.drops.length > 0
            ? `${formatMinutes(Math.max(...campaign.drops.map((drop) => drop.requiredMinutes)))} на всё`
            : "—"}
        </span>
        {campaign.detailsUrl && (
          <a
            href={campaign.detailsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition hover:text-white"
          >
            На Twitch
            <ExternalIcon className="h-3 w-3" />
          </a>
        )}
      </footer>
    </article>
  );
}
