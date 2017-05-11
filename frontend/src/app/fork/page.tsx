import { ForkWizard } from "@/components/fork/ForkWizard";

export default function ForkPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]">
          ← Home
        </a>
      </p>
      <ForkWizard />
    </div>
  );
}
