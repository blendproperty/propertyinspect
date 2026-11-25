"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { FormError } from "@/components/form-error";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-stone-500">Set up the first administrator account. Everyone else is invited from the Team page.</p>
      </div>
      <FormError error={state?.error} />
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="company">Company</label>
        <input className="input" id="company" name="company" autoComplete="organization" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
      <p className="text-center text-sm text-stone-500">
        Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
