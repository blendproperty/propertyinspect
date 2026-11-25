"use client";

import { useActionState, useState } from "react";

type State = { error?: string; ok?: string; inviteLink?: string } | undefined;

/** Wraps a server action form and shows its error / success message (and an invite link to copy). */
export function StatefulForm({
  action,
  children,
  className,
  submitLabel,
  resetOnSuccess,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(async (s: State, fd: FormData) => {
    const res = await action(s, fd);
    return res;
  }, undefined);
  const [copied, setCopied] = useState(false);
  const link = state?.inviteLink && typeof window !== "undefined" ? window.location.origin + state.inviteLink : state?.inviteLink;
  return (
    <form action={run} className={className} key={resetOnSuccess && state?.ok ? state.ok + (state.inviteLink ?? "") : undefined}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state?.ok && !state.inviteLink && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
      {state?.inviteLink && (
        <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm sm:col-span-full">
          <p>{state.ok}</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => { navigator.clipboard.writeText(link ?? ""); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
