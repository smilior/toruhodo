import type { ReactNode } from "react";
import { TabBar } from "./tab-bar";

export function AppShell({
  children,
  showTabBar = true,
}: {
  children: ReactNode;
  showTabBar?: boolean;
}) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="app-screen">
          {children}
          {showTabBar ? <TabBar /> : null}
        </div>
      </div>
    </div>
  );
}
