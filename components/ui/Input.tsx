"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { IconSearch } from "./icons";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  search?: boolean;
};

// Inputs · default / foco / error
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, search, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label mb-2 block">
          {label}
        </label>
      )}
      <div className="relative">
        {search && (
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-md border bg-surface px-4 text-body font-medium text-ink placeholder:text-muted/80",
            "outline-none transition-colors focus:border-accent focus:bg-surface-2 focus-visible:outline-none",
            error ? "border-danger" : "border-line",
            search && "pl-11",
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-2 text-small font-medium text-danger-ink">
          ✕ {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-2 text-small text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
