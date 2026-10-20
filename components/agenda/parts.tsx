"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/data/types";
import { whatsappUrl } from "@/lib/phone";

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  pendiente: "bg-warning/20 text-warning",
  agendado: "bg-accent/20 text-ink",
  reprogramacion_pedida: "bg-warning/20 text-warning",
  cancelado: "bg-surface-2 text-muted line-through",
  asistio: "bg-success/20 text-success",
  ausente: "bg-danger/20 text-danger-ink",
};

export function StatusPill({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-bold", STATUS_CLASS[status], className)}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

export const inputClass =
  "h-12 w-full rounded-md border border-line bg-bg px-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent [color-scheme:dark]";

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="label mb-1 block text-[0.6875rem]">{label}</span>
      {children}
    </label>
  );
}

/** Opciones en píldoras (tipo de turno, «solo este / este y los siguientes»…). */
export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "min-h-[44px] rounded-full px-4 text-small font-semibold",
            value === key ? "bg-accent font-bold text-ink" : "border border-line text-title hover:bg-surface-2",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Mensaje de WhatsApp precargado y editable antes de abrirlo.
 * Abre wa.me con el teléfono normalizado (549…); sin teléfono válido, lo avisa.
 */
export function WhatsAppSheet({ title, to, phone, initialText, onClose, onSent }: {
  title: string;
  to: string;
  phone: string | null;
  initialText: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [text, setText] = useState(initialText);
  const url = whatsappUrl(phone, text);
  return (
    <Sheet title={title} subtitle={`Para ${to}`} onClose={onClose}>
      <Field label="Mensaje (lo podés editar)">
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
      </Field>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onSent?.();
            onClose();
          }}
          className="mt-4 flex h-12 items-center justify-center rounded-full bg-success font-bold text-bg"
        >
          Abrir WhatsApp
        </a>
      ) : (
        <p className="mt-4 rounded-md border border-warning/60 bg-warning/10 px-4 py-3 text-small">
          {to.split(" ")[0]} no tiene un teléfono válido con código de área. Cargalo en «Editar datos» (ej.: 11 5555-0101).
        </p>
      )}
    </Sheet>
  );
}

/** Botón chico de WhatsApp (abre el sheet con el mensaje). */
export function WhatsAppButton({ onClick, label = "WhatsApp", disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-success/60 px-4 text-small font-bold text-success hover:bg-success/10 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
      </svg>
      {label}
    </button>
  );
}
