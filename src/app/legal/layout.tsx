import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell showTabBar={false}>
      <div className="app-scroll">
        <div
          style={{
            padding:
              "max(12px, env(safe-area-inset-top, 0px)) 20px calc(32px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center text-[14px] font-bold no-underline"
            style={{ color: "var(--secondary)" }}
          >
            ← 設定にもどる
          </Link>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
