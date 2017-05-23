import { MirrorWizard } from "@/components/mirror/MirrorWizard";

export default function MirrorPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]">
          ← Home
        </a>
      </p>
      <MirrorWizard />
    </div>
  );
}
