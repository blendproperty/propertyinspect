"use client";

import { useActionState } from "react";
import { acceptInvite } from "../../actions";
import { FormError } from "@/components/form-error";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-stone-500">You&apos;ve been invited. Choose a password to finish setting up your account.</p>
      </div>
      <FormError error={state?.error} />
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save and continue"}</button>
    </form>
  );
}
