import { Logo } from "@/components/logo";
import { APP_TAGLINE } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-10 text-brand-100 lg:flex">
        <Logo light />
        <div>
          <p className="text-3xl leading-snug font-semibold text-white">Walk the property once. Send a clear, signed condition report the same day.</p>
          <p className="mt-4 text-brand-100/80">{APP_TAGLINE}</p>
        </div>
        <p className="text-xs text-brand-100/60">Blend Property Management</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
