import { AppShell } from "@/components/app/app-shell";
import { ScanApp } from "@/components/app/scan-app";

export default function ScanPage() {
  return (
    <AppShell showTabBar={false}>
      <ScanApp />
    </AppShell>
  );
}
