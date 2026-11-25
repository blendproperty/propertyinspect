"use client";

import { useRef } from "react";

/** Simple pointer-based signature canvas. Calls onChange with a PNG data URL, or null when cleared. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const marked = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a302e";
    ctx.lineTo(x, y);
    ctx.stroke();
    marked.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (marked.current) onChange(ref.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    marked.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={600}
        height={180}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="h-36 w-full touch-none rounded-lg border border-dashed border-brand-500/60 bg-white"
      />
      <button type="button" onClick={clear} className="mt-1 text-xs text-stone-500 hover:text-ink">Clear</button>
    </div>
  );
}
