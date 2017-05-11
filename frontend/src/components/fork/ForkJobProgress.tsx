import { JobProgress } from "@/components/shared/JobProgress";

interface ForkJobProgressProps {
  jobId: string;
  onDone?: Parameters<typeof JobProgress>[0]["onDone"];
}

export function ForkJobProgress({ jobId, onDone }: ForkJobProgressProps) {
  return <JobProgress jobId={jobId} title="Fork job" onDone={onDone} />;
}
