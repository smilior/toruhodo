import { listRecordsAction } from "@/actions/records";
import { HomeApp } from "@/components/app/home-app";
import type { RecordDTO } from "@/lib/domain/record";

export default async function HomePage() {
  const res = await listRecordsAction();
  const initialRecords: RecordDTO[] = res.ok ? res.data.records : [];

  return <HomeApp initialRecords={initialRecords} />;
}
