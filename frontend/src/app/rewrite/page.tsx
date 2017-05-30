import { RewriteWizard } from "@/components/rewrite/RewriteWizard";

export default function RewritePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">Feature 4</p>
        <h1 className="text-2xl font-bold">Fix contributions</h1>
      </div>
      <RewriteWizard />
    </div>
  );
}
