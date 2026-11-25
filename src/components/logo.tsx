export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={`text-[28px] font-extrabold tracking-[-0.06em] ${light ? "text-white" : "text-ink"}`}>
        blend<span className="text-brand-300">.</span>
      </span>
      <span className={`mt-1 text-[10px] font-bold tracking-[0.16em] ${light ? "text-brand-300/80" : "text-brand-600"}`}>
        INSPECT
      </span>
    </span>
  );
}
