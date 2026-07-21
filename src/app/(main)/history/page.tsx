import { listRecordsAction } from "@/actions/records";
import { HistoryApp } from "@/components/app/history-app";
import type { RecordDTO } from "@/lib/domain/record";

export default async function HistoryPage() {
  const res = await listRecordsAction();
  const initialRecords: RecordDTO[] = res.ok ? res.data.records : [];

  return (
    <HistoryApp
      initialRecords={initialRecords}
      initialError={res.ok ? null : res.error}
    />
  );
}
