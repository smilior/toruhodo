import { listRecordsAction } from "@/actions/records";
import { MapApp } from "@/components/app/map-app";
import type { RecordDTO } from "@/lib/domain/record";

export default async function MapPage() {
  const res = await listRecordsAction();
  const initialRecords: RecordDTO[] = res.ok ? res.data.records : [];

  return (
    <MapApp
      initialRecords={initialRecords}
      initialError={res.ok ? null : res.error}
    />
  );
}
