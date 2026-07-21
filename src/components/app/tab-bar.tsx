"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/history", label: "履歴", icon: "menu_book" },
  { href: "/map", label: "地図", icon: "map" },
  { href: "/settings", label: "設定", icon: "settings" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar" aria-label="メイン">
      {tabs.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/"
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`tab-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: 24,
                fontVariationSettings: active
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
              aria-hidden
            >
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
