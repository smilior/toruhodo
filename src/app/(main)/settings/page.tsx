import { Suspense } from "react";
import { getSettingsAction } from "@/actions/records";
import { SettingsApp } from "@/components/app/settings-app";
import { DEFAULT_SETTINGS, type SettingsDTO } from "@/lib/domain/record";

export default async function SettingsPage() {
  const res = await getSettingsAction();
  const initialSettings: SettingsDTO = res.ok
    ? res.data.settings
    : { ...DEFAULT_SETTINGS };

  return (
    <Suspense fallback={null}>
      <SettingsApp initialSettings={initialSettings} />
    </Suspense>
  );
}
