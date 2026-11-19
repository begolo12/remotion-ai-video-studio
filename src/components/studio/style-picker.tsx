"use client";

import type { StyleId } from "@/lib/plan/schema";
import { STYLE_LIST } from "@/lib/plan/styles";
import { cn } from "./cn";
import { CheckIcon } from "./icons";

type StylePickerProps = {
  value: StyleId;
  onChange: (styleId: StyleId) => void;
  disabled?: boolean;
};

export function StylePicker({ value, onChange, disabled }: StylePickerProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-zinc-200">Gaya visual</legend>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STYLE_LIST.map((style) => {
          const selected = style.id === value;
          return (
            <button
              key={style.id}
              type="button"
              data-testid={`style-option-${style.id}`}
              aria-pressed={selected}
              onClick={() => onChange(style.id)}
              disabled={disabled}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-2.5 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                selected
                  ? "border-amber-400/60 bg-amber-400/[0.08] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <span
                aria-hidden="true"
                className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/15"
                style={{ background: style.background }}
              >
                <span
                  className="size-2.5 rounded-full ring-1 ring-black/20"
                  style={{ backgroundColor: style.accent }}
                />
                <span
                  className="absolute bottom-1.5 right-1.5 size-1.5 rounded-full"
                  style={{ backgroundColor: style.accent2 }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-zinc-100">
                    {style.label}
                  </span>
                  {selected ? (
                    <CheckIcon className="size-3.5 shrink-0 text-amber-300" />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">
                  {style.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
