import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto min-h-dvh max-w-[640px] px-5 py-8"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <Link
        href="/settings"
        className="text-[14px] font-bold no-underline"
        style={{ color: "var(--secondary)" }}
      >
        ← 設定にもどる
      </Link>
      {children}
    </div>
  );
}
