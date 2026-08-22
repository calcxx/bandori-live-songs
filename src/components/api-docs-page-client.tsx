"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { navPillLabel } from "@/components/nav-pill";
import { PublicFooter } from "@/components/public-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { getApiDocsCopy } from "@/lib/api-docs-copy";
import { getCopy, type Locale } from "@/lib/i18n";

const endpoints = [
  ["/api/v1/bands", "bands"],
  ["/api/v1/songs?q=MyGO&category=original", "songs"],
  ["/api/v1/events?band=mygo&from=2025-01-01", "events"],
  ["/api/v1/events/{eventernoteEventId}", "eventDetail"],
  ["/api/v1/songs/{id}/events", "songEvents"],
] as const;

export function ApiDocsPageClient({
  locale,
  isAdminAuthenticated,
}: {
  locale: Locale;
  isAdminAuthenticated: boolean;
}) {
  const [activeLocale, setActiveLocale] = useState(locale);
  const siteCopy = getCopy(activeLocale);
  const copy = getApiDocsCopy(activeLocale);

  useEffect(() => {
    document.title = `${copy.title} · BanG Dream! Events to Songs`;
  }, [copy.title]);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border-soft bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <Link
            href="/"
            className="min-w-0 truncate font-heading text-lg font-semibold tracking-[-0.04em] hover:text-accent"
          >
            <span className="sm:hidden">{siteCopy.navTitleMobile}</span>
            <span className="hidden sm:inline">{siteCopy.navTitleDesktop}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdminAuthenticated ? (
              <Link href="/admin" className={navPillLabel}>
                {siteCopy.adminNav}
              </Link>
            ) : null}
            <LocaleToggle
              locale={activeLocale}
              onLocaleChange={setActiveLocale}
            />
            <ThemeToggle copy={siteCopy} />
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-4 py-8 sm:px-8">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">
            {copy.description}
          </p>
        </header>

        <section className="rounded-[1.15rem] border border-border-soft bg-panel p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.04em]">
            {copy.quickStart}
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-border-soft bg-background/70 p-4 text-sm leading-6 text-foreground">
            <code>
              curl &apos;https://your-domain.example/api/v1/events?limit=10&apos;
            </code>
          </pre>
          <h3 className="mt-6 font-heading text-lg font-semibold">
            {copy.response}
          </h3>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border-soft bg-background/70 p-4 text-sm leading-6 text-foreground">
            <code>{`{
  "data": [...],
  "pagination": {
    "limit": 10,
    "nextCursor": "..."
  }
}`}</code>
          </pre>
        </section>

        <section className="overflow-hidden rounded-[1.15rem] border border-border-soft bg-panel">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(9rem,0.8fr)] border-b border-border-soft px-5 py-3 text-sm font-medium text-ink-soft sm:grid sm:px-6">
            <span>{copy.endpoints}</span>
            <span>{copy.endpointDescription}</span>
          </div>
          {endpoints.map(([path, key]) => (
            <div
              key={path}
              className="flex flex-col gap-1.5 border-b border-border-soft px-5 py-4 last:border-0 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.8fr)] sm:gap-4 sm:px-6"
            >
              <code className="min-w-0 break-all text-sm text-accent">
                {path}
              </code>
              <span className="text-sm text-ink-soft">{copy[key]}</span>
            </div>
          ))}
        </section>

        <section className="rounded-[1.15rem] border border-border-soft bg-panel p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.04em]">
            {copy.notes}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">
            {copy.notesBody}
          </p>
          <a
            href="/api/openapi.json"
            className="mt-5 inline-flex text-sm font-medium text-accent hover:underline"
          >
            {copy.openapi} →
          </a>
        </section>
      </main>

      <PublicFooter copy={siteCopy} />
    </>
  );
}
