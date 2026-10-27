"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ExternalIcon, GiftIcon, RefreshIcon, SparkIcon } from "./Icons";

type Device = {
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
};

type Phase = "starting" | "waiting" | "expired" | "error" | "success";

const FEATURES = [
  "Все активные, будущие и завершённые кампании в одном списке",
  "Избранное с отметкой о новых наградах",
  "Полученные дропсы — в отдельной вкладке",
  "Сбор заработанных наград в один клик",
];

export default function LoginPanel() {
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    setDevice(null);
    try {
      const res = await fetch("/api/auth/device/start", { method: "POST" });
      const data = (await res.json()) as Device & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Не удалось получить код");
      setDevice(data);
      setPhase("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать вход");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    if (phase !== "waiting" || !device) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const res = await fetch("/api/auth/device/poll", { method: "POST" });
        const data = (await res.json()) as { status?: string; error?: string };

        if (cancelled) return;

        if (data.status === "ok") {
          setPhase("success");
          router.replace("/");
          router.refresh();
          return;
        }

        if (data.status === "expired" || data.status === "denied" || res.status === 410) {
          setPhase("expired");
          return;
        }
      } catch {
        // the network hiccuped — simply try again
      }

      if (!cancelled) {
        timer = setTimeout(tick, Math.max(2, device.interval || 5) * 1000);
      }
    };

    timer = setTimeout(tick, Math.max(2, device.interval || 5) * 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, device, router]);

  const copyCode = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 15% -10%, rgba(145,70,255,0.30), transparent 60%), radial-gradient(700px 420px at 100% 0%, rgba(0,209,143,0.14), transparent 55%), #0b0b0d",
        }}
      />

      <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="animate-fade-up">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
              <GiftIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">Drops Hub</p>
              <p className="text-xs text-muted">Twitch Drops без лишней беготни</p>
            </div>
          </div>

          <h1 className="mt-8 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Все дропсы Twitch —{" "}
            <span className="bg-gradient-to-r from-accent-2 via-accent to-[#00d18f] bg-clip-text text-transparent">
              под контролем
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            Приложение собирает кампании Drops в удобный каталог: отмечайте любимые игры,
            получайте сигнал о новых наградах и забирайте уже заработанные дропсы в один клик —
            с любого устройства.
          </p>

          <ul className="mt-7 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-[#dcdce4]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="animate-fade-up rounded-3xl border border-line bg-surface/80 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Вход через Twitch</h2>
              <p className="mt-1 text-xs text-muted">
                Пароль не нужен — Twitch выдаст приложению отдельный токен.
              </p>
            </div>
            <SparkIcon className="h-6 w-6 shrink-0 text-accent-2" />
          </div>

          {phase === "starting" && (
            <div className="mt-7 space-y-3">
              <div className="skeleton h-24 rounded-2xl" />
              <div className="skeleton h-11 rounded-xl" />
            </div>
          )}

          {phase === "waiting" && device && (
            <div className="mt-7">
              <ol className="space-y-2 text-sm text-[#dcdce4]">
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-muted">
                    1
                  </span>
                  Откройте{" "}
                  <a
                    href={device.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent-2 underline-offset-2 hover:underline"
                  >
                    twitch.tv/activate
                    <ExternalIcon className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-muted">
                    2
                  </span>
                  Введите код ниже
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-muted">
                    3
                  </span>
                  Подтвердите доступ — страница обновится сама
                </li>
              </ol>

              <div className="mt-6 rounded-2xl border border-line bg-ink/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Ваш код</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-3xl font-semibold tracking-[0.28em] text-white">
                    {device.userCode}
                  </span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-white"
                  >
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Код действует около 30 минут. Можно ввести его на телефоне — вход засчитается здесь.
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Ожидаем подтверждение на Twitch…
              </div>

              <a
                href={device.verificationUri}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7d32e8]"
              >
                Открыть страницу активации
                <ExternalIcon className="h-4 w-4" />
              </a>
            </div>
          )}

          {phase === "success" && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok">
              <CheckIcon className="h-5 w-5" />
              Готово! Загружаем ваши кампании…
            </div>
          )}

          {(phase === "expired" || phase === "error") && (
            <div className="mt-7">
              <div className="rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
                {phase === "expired"
                  ? "Код истёк или вход отменён. Давайте попробуем ещё раз."
                  : (error ?? "Не удалось начать вход.")}
              </div>
              <button
                type="button"
                onClick={() => void start()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7d32e8]"
              >
                <RefreshIcon className="h-4 w-4" />
                Попробовать снова
              </button>
            </div>
          )}

          <div className="mt-7 space-y-2 border-t border-line pt-5 text-[11px] leading-relaxed text-muted">
            <p>
              Приложение не запрашивает и не хранит пароль. Twitch выдаёт токен, который лежит
              в зашифрованной httpOnly-cookie вашего браузера.
            </p>
            <p>
              Время просмотра не накручивается: прогресс Drops начисляется Twitch только за реальный
              просмотр трансляций, а приложение помогает не пропустить кампании и забрать готовые награды.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
