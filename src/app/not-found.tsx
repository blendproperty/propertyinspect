import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-extrabold tracking-tight text-brand-900">404</p>
      <p className="text-stone-600">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary">Back to overview</Link>
    </div>
  );
}
