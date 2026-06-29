"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { navPillLabel } from "@/components/nav-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { cnCopy } from "@/lib/i18n/cn";
import { navigateToDemoHome } from "@/lib/navigate-demo-home";

function handleHomeClick(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  navigateToDemoHome();
}

export function AdminNav() {
  const localeCopy = cnCopy;

  return (
    <nav className="sticky top-0 z-50 border-b border-border-soft bg-background/85 backdrop-blur-xl">
      <div className="@container/nav-bar mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="min-w-0 truncate font-heading text-lg font-semibold tracking-[-0.04em] hover:text-accent"
        >
          <span className="sm:hidden">{localeCopy.navTitleMobile}</span>
          <span className="hidden sm:inline">{localeCopy.navTitleDesktop}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/admin" className={navPillLabel}>
            <span className="sm:hidden">管理</span>
            <span className="hidden sm:inline">管理首页</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
