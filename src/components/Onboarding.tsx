"use client";

import { useState } from "react";
import { CheckIcon, ExternalIcon, GiftIcon, RefreshIcon, SparkIcon } from "./Icons";

const STEPS = [
  {
    title: "Скачайте расширение",
    body: (
      <>
        Архив{" "}
        <a href="/drops-hub-extension.zip" className="text-accent-2 underline underline-offset-2">
          drops-hub-extension.zip
        </a>{" "}
        и распакуйте в любую папку. Исходники лежат в{" "}
        <a
          href="https://github.com/Sokolyanskyi/twitch-drops-hub/tree/main/extension"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent-2 underline underline-offset-2"
        >
          репозитории
          <ExternalIcon className="h-3 w-3" />
        </a>
        .
      </>
    ),
  },
  {
    title: "Загрузите его в браузер",
    body: (
      <>
        Откройте <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">chrome://extensions</code>,
        включите «Режим разработчика» и нажмите «Загрузить распакованное» — выберите папку{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">extension</code>.
      </>
    ),
  },
  {
    title: "Откройте страницу дропсов на Twitch",
    body: (
      <>
        Зайдите на{" "}
        <a
          href="https://www.twitch.tv/drops/campaigns"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent-2 underline underline-offset-2"
        >
          twitch.tv/drops/campaigns
          <ExternalIcon className="h-3 w-3" />
        </a>{" "}
        — расширение сохранит снимок кампаний. Вернитесь сюда и нажмите «Проверить снова».
      </>
    ),
  },
];

export default function Onboarding({ onRetry }: { onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
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
            "radial-gradient(900px 520px at 15% -10%, rgba(145,70,255,0.28), transparent 60%), radial-gradient(700px 420px at 100% 0%, rgba(0,209,143,0.12), transparent 55%), #0b0b0d",
        }}
      />

      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
            <GiftIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">Drops Hub</p>
            <p className="text-xs text-muted">Данные из вашей сессии Twitch</p>
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Подключите расширение —{" "}
          <span className="bg-gradient-to-r from-accent-2 via-accent to-[#00d18f] bg-clip-text text-transparent">
            и кампании появятся
          </span>
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Drops Hub не просит пароль и не обращается к Twitch от вашего имени. Расширение работает в
          вашей же вкладке twitch.tv, забирает уже загруженные страницей данные о дропсах и передаёт
          их сюда. Токены никуда не уходят — всё остаётся в браузере.
        </p>

        <div className="mt-7 space-y-3 rounded-3xl border border-line bg-surface/80 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur sm:p-6">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent-2 ring-1 ring-accent/25">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{step.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{step.body}</p>
                {index === 1 && (
                  <button
                    type="button"
                    onClick={() => void copyUrl()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-accent/40 hover:text-white"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="h-3 w-3" /> Скопировано
                      </>
                    ) : (
                      "Скопировать chrome://extensions"
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          <details className="rounded-2xl border border-line bg-ink/40 p-3">
            <summary className="cursor-pointer select-none text-xs font-medium text-[#dcdce4]">
              Zen или Firefox — другой способ
            </summary>
            <ol className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
              <li>
                <span className="text-[#dcdce4]">1.</span> Скачайте{" "}
                <a
                  href="/drops-hub-extension-firefox.zip"
                  className="text-accent-2 underline underline-offset-2"
                >
                  drops-hub-extension-firefox.zip
                </a>{" "}
                и распакуйте.
              </li>
              <li>
                <span className="text-[#dcdce4]">2.</span> Откройте{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
                  about:debugging#/runtime/this-firefox
                </code>
                , нажмите «Загрузить временное дополнение» и выберите{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">manifest.json</code>{" "}
                из распакованной папки.
              </li>
              <li>
                <span className="text-[#dcdce4]">3.</span> Откройте twitch.tv/drops/campaigns и
                вернитесь сюда.
              </li>
            </ol>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Временное дополнение пропадает после перезапуска браузера — загрузите его снова или
              подпишите архив на addons.mozilla.org («Sign for self-distribution»), чтобы установить
              навсегда.
            </p>
          </details>

          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7d32e8]"
            >
              <RefreshIcon className="h-4 w-4" />
              Проверить снова
            </button>
            <a
              href="/drops-hub-extension.zip"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium text-[#dcdce4] transition hover:border-accent/40 hover:text-white"
            >
              Скачать расширение
            </a>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <SparkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-2" />
          <p>
            Подходит Chrome, Edge, Zen и Firefox. Данные хранятся только в вашем браузере; избранное
            и отметки о новых наградах — тоже. Если расширение уже установлено, но данные не
            появились, обновите страницу Twitch с дропсами и вернитесь сюда.
          </p>
        </div>
      </div>
    </main>
  );
}
