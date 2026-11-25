"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, ChevronDown, Loader2, Trash2, X } from "lucide-react";
import { cx } from "@/lib/format";
import { CONTACT_ROLES, SECTION_KINDS, type SectionKind } from "@/lib/options";
import { SignaturePad } from "@/components/signature-pad";
import {
  addItem,
  addSection,
  addSignature,
  deletePhoto,
  removeItem,
  removeSignature,
  updateItem,
  updateSectionNotes,
  uploadPhoto,
} from "../actions";

type Rating = "yes" | "no" | "na";
export type RunnerItem = {
  id: string;
  name: string;
  ratings: Record<string, Rating>;
  description: string | null;
  comment: string | null;
  value: string | null;
  photos: { id: string }[];
};
export type RunnerSection = { id: string; name: string; kind: SectionKind; notes: string | null; items: RunnerItem[] };
export type RunnerSignature = { id: string; signerName: string; signerRole: keyof typeof CONTACT_ROLES; image: string; signedAt: string };

const RATING_LABEL: Record<Rating, string> = { yes: "Yes", no: "No", na: "N/A" };
const RATING_TONE: Record<Rating, string> = {
  yes: "bg-emerald-600 text-white border-emerald-600",
  no: "bg-rose-600 text-white border-rose-600",
  na: "bg-stone-500 text-white border-stone-500",
};

function useSaver() {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const run = async (fn: () => Promise<unknown>) => {
    setState("saving");
    try {
      await fn();
      setState("saved");
    } catch {
      setState("error");
    }
  };
  return { state, run };
}

function RatingButtons({ value, onChange, disabled }: { value?: Rating; onChange: (v: Rating | null) => void; disabled: boolean }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-300">
      {(["yes", "no", "na"] as Rating[]).map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === r ? null : r)}
          className={cx(
            "min-w-11 border-l border-stone-300 px-2.5 py-1.5 text-xs font-semibold first:border-l-0",
            value === r ? RATING_TONE[r] : "bg-white text-stone-600 hover:bg-stone-50",
          )}
        >
          {RATING_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function ItemRow({ item, kind, checks, locked }: { item: RunnerItem; kind: SectionKind; checks: string[]; locked: boolean }) {
  const [ratings, setRatings] = useState(item.ratings);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saver = useSaver();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const hasProblem = Object.values(ratings).includes("no");
  const showComment = hasProblem || !!item.comment;
  const [open, setOpen] = useState(showComment || !!item.description);

  const rateMany = (changes: Record<string, Rating | null>) => {
    setRatings((r) => {
      const next = { ...r };
      for (const [check, v] of Object.entries(changes)) {
        if (v === null) delete next[check];
        else next[check] = v;
      }
      return next;
    });
    if (Object.values(changes).includes("no")) setOpen(true);
    saver.run(() => updateItem(item.id, { ratings: changes }));
  };
  const rate = (check: string, v: Rating | null) => rateMany({ [check]: v });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("itemId", item.id);
      fd.set("file", file);
      const res = await uploadPhoto(fd);
      if (res.error) setError(res.error);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const valueField = kind === "meters" || kind === "keys";

  return (
    <li className={cx("px-4 py-3 sm:px-5", hasProblem && "bg-rose-50/40")}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-1.5 text-left font-medium xl:w-56 xl:shrink-0">
          <ChevronDown className={cx("h-4 w-4 shrink-0 text-stone-400 transition-transform", !open && "-rotate-90")} />
          <span className="truncate">{item.name}</span>
          {item.photos.length > 0 && <span className="text-xs font-normal text-stone-400">· {item.photos.length} photo{item.photos.length > 1 ? "s" : ""}</span>}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {kind === "room" && !locked && (
            <button
              type="button"
              onClick={() => rateMany(Object.fromEntries(checks.map((c) => [c, "yes" as Rating])))}
              className="rounded-lg border border-emerald-200 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              title="Mark every check Yes"
            >
              All OK
            </button>
          )}
          {kind === "room" &&
            checks.map((c) => (
              <div key={c} className="flex w-full items-center gap-1.5 sm:w-auto">
                <span className="w-20 text-xs text-stone-500 sm:w-auto">{c}</span>
                <RatingButtons value={ratings[c]} onChange={(v) => rate(c, v)} disabled={locked} />
              </div>
            ))}
          {kind === "checklist" && <RatingButtons value={ratings.Answer} onChange={(v) => rate("Answer", v)} disabled={locked} />}
          {valueField && (
            <input
              defaultValue={item.value ?? ""}
              disabled={locked}
              placeholder={kind === "meters" ? "Reading" : "Quantity"}
              inputMode={kind === "meters" ? "decimal" : "numeric"}
              className="input w-32"
              onBlur={(e) => e.target.value !== (item.value ?? "") && saver.run(() => updateItem(item.id, { value: e.target.value }))}
            />
          )}
          <span className="w-12 text-right text-[11px] text-stone-400">
            {saver.state === "saving" ? "Saving…" : saver.state === "saved" ? "Saved" : saver.state === "error" ? <span className="text-rose-600">Not saved</span> : ""}
          </span>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 pl-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {kind === "room" && (
              <input
                defaultValue={item.description ?? ""}
                disabled={locked}
                placeholder="Description, e.g. white painted plaster"
                className="input"
                onBlur={(e) => e.target.value !== (item.description ?? "") && saver.run(() => updateItem(item.id, { description: e.target.value }))}
              />
            )}
            <textarea
              defaultValue={item.comment ?? ""}
              disabled={locked}
              rows={kind === "room" ? 1 : 2}
              placeholder={hasProblem ? "What's wrong? This goes on the report." : "Comment"}
              className={cx("input", kind !== "room" && "sm:col-span-2")}
              onBlur={(e) => e.target.value !== (item.comment ?? "") && saver.run(() => updateItem(item.id, { comment: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {item.photos.map((p) => (
              <div key={p.id} className="group relative">
                <a href={`/api/files/photo/${p.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/photo/${p.id}`} alt={`${item.name} photo`} className="h-20 w-24 rounded-lg object-cover" />
                </a>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => deletePhoto(p.id))}
                    className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-white p-0.5 shadow group-hover:block"
                    aria-label="Delete photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!locked && (
              <>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary h-20 w-24 flex-col gap-1 text-xs" disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {uploading ? "Uploading" : "Add photo"}
                </button>
              </>
            )}
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {!locked && (
              <form action={removeItem} onSubmit={(e) => !confirm(`Remove "${item.name}" from this inspection?`) && e.preventDefault()}>
                <input type="hidden" name="itemId" value={item.id} />
                <button className="inline-flex items-center gap-1 text-stone-400 hover:text-rose-600"><Trash2 className="h-3 w-3" /> Remove item</button>
              </form>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Progress({ section, checks }: { section: RunnerSection; checks: string[] }) {
  if (section.kind === "notes") return null;
  const done = section.items.filter((i) =>
    section.kind === "room" ? checks.every((c) => i.ratings[c]) : section.kind === "checklist" ? i.ratings.Answer : i.value,
  ).length;
  const problems = section.items.filter((i) => Object.values(i.ratings).includes("no")).length;
  return (
    <span className="text-xs font-normal text-stone-500">
      {done}/{section.items.length}
      {problems > 0 && <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-700">{problems} issue{problems > 1 ? "s" : ""}</span>}
    </span>
  );
}

export function InspectionRunner({
  inspectionId,
  sections,
  checks,
  signatures,
  locked,
}: {
  inspectionId: string;
  sections: RunnerSection[];
  checks: string[];
  signatures: RunnerSignature[];
  locked: boolean;
}) {
  const [sig, setSig] = useState<string | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [sigKey, setSigKey] = useState(0);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="no-print top-6 hidden self-start lg:sticky lg:block">
        <p className="mb-2 text-[11px] font-bold tracking-[0.13em] text-stone-500 uppercase">Sections</p>
        <ul className="space-y-0.5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#s-${s.id}`} className="flex justify-between gap-2 rounded-md px-2 py-1 text-stone-600 hover:bg-white hover:text-ink">
                <span className="truncate">{s.name}</span>
              </a>
            </li>
          ))}
          <li><a href="#sign" className="block rounded-md px-2 py-1 text-stone-600 hover:bg-white hover:text-ink">Sign-off</a></li>
        </ul>
      </nav>

      <div className="space-y-5">
        {sections.length === 0 && (
          <div className="card p-6 text-sm text-stone-500">This inspection has no sections yet. Add the first room below.</div>
        )}
        {sections.map((s) => (
          <section key={s.id} id={`s-${s.id}`} className="card scroll-mt-20 overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="text-xs text-stone-500">{SECTION_KINDS[s.kind]}</p>
              </div>
              <Progress section={s} checks={checks} />
            </header>
            {s.kind === "notes" ? (
              <div className="p-4 sm:p-5">
                <textarea
                  defaultValue={s.notes ?? ""}
                  disabled={locked}
                  rows={4}
                  className="input"
                  placeholder="General notes for the report"
                  onBlur={(e) => e.target.value !== (s.notes ?? "") && updateSectionNotes(s.id, e.target.value)}
                />
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {s.items.map((i) => (
                  <ItemRow key={i.id} item={i} kind={s.kind} checks={checks} locked={locked} />
                ))}
              </ul>
            )}
            {!locked && s.kind !== "notes" && (
              <form action={addItem} className="flex gap-2 border-t border-stone-100 px-4 py-3 sm:px-5">
                <input type="hidden" name="sectionId" value={s.id} />
                <input name="name" placeholder="Add an item" className="input" required />
                <button className="btn-secondary shrink-0">Add</button>
              </form>
            )}
          </section>
        ))}

        {!locked && (
          <form action={addSection} className="card flex flex-wrap gap-2 p-4">
            <input type="hidden" name="inspectionId" value={inspectionId} />
            <input name="name" placeholder="New room or section, e.g. Bedroom 3" className="input min-w-48 flex-1" required />
            <select name="kind" className="input w-auto" defaultValue="room">
              {Object.entries(SECTION_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-secondary">Add section</button>
          </form>
        )}

        <section id="sign" className="card scroll-mt-20 p-5">
          <h2 className="font-semibold">Sign-off</h2>
          <p className="mb-4 text-sm text-stone-500">Signatures appear at the end of the report, with the time they were captured.</p>
          {signatures.length > 0 && (
            <ul className="mb-5 grid gap-3 sm:grid-cols-2">
              {signatures.map((s) => (
                <li key={s.id} className="rounded-lg border border-stone-200 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt={`Signature of ${s.signerName}`} className="h-20 w-full object-contain" />
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span><b>{s.signerName}</b> · {CONTACT_ROLES[s.signerRole]}</span>
                    {!locked && (
                      <form action={removeSignature}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="text-xs text-stone-400 hover:text-rose-600">Remove</button>
                      </form>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{new Date(s.signedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <form
              key={sigKey}
              action={(fd) => {
                if (!sig) {
                  setSigError("Draw a signature first.");
                  return;
                }
                fd.set("image", sig);
                startTransition(async () => {
                  const res = await addSignature(fd);
                  if (res.error) setSigError(res.error);
                  else {
                    setSigError(null);
                    setSig(null);
                    setSigKey((k) => k + 1);
                  }
                });
              }}
              className="space-y-3"
            >
              <input type="hidden" name="inspectionId" value={inspectionId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="signerName" placeholder="Full name" className="input" required />
                <select name="signerRole" className="input" defaultValue="tenant">
                  {Object.entries(CONTACT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <SignaturePad onChange={setSig} />
              {sigError && <p className="text-sm text-rose-600">{sigError}</p>}
              <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save signature"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
