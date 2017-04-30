import { CheckAccountForm } from "@/components/check/CheckAccountForm";

export default function CheckPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]">
          ← Home
        </a>
      </p>
      <CheckAccountForm />
    </div>
  );
}
