"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";
import { FormError } from "@/components/form-error";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-stone-500">Welcome back.</p>
      </div>
      <FormError error={state?.error} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm text-stone-500">
        New here? <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
    </form>
  );
}
