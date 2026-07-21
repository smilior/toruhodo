import { AppShell } from "@/components/app/app-shell";
import { ResultApp } from "@/components/app/result-app";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  return (
    <AppShell>
      <ResultApp id={id} />
    </AppShell>
  );
}
