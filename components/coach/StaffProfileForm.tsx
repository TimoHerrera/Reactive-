"use client";

import { useRef, useState, type FormEvent } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Input, PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import type { Profile } from "@/lib/data/types";

export const BIO_MAX = 280;
const PHOTO_MAX_MB = 8;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Achica la foto a 512 px (JPEG) para que pese poco. Si el navegador no puede, sube la original. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const side = 512;
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Perfil público del profe: lo que ve el cliente en «Tu profe».
 * Cada profe edita el suyo; el admin, el de todos (lo validan el repo y RLS).
 */
export function StaffProfileForm({ profile, onSaved }: { profile: Profile; onSaved?: (p: Profile) => void }) {
  const [v, setV] = useState({
    fullName: profile.fullName,
    title: profile.title ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
  });
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [uploading, setUploading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setMsg({ ok: false, text: "Usá una foto JPG, PNG o WebP." });
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return setMsg({ ok: false, text: `La foto pesa más de ${PHOTO_MAX_MB} MB.` });
    setMsg(null);
    setUploading(0);
    try {
      const blob = await shrinkPhoto(file);
      const path = await data.videos.upload(blob, { name: `avatar-${profile.id}.jpg`, onProgress: (p) => setUploading(p) });
      setAvatarPath(path);
    } catch {
      setMsg({ ok: false, text: "No pudimos subir la foto. Probá de nuevo." });
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (v.fullName.trim().length < 2) return setMsg({ ok: false, text: "Falta el nombre." });
    if (v.bio.length > BIO_MAX) return setMsg({ ok: false, text: `La bio tiene más de ${BIO_MAX} caracteres.` });
    setBusy(true);
    setMsg(null);
    try {
      const saved = await data.profiles.update(profile.id, {
        fullName: v.fullName.trim(),
        title: v.title.trim() || null,
        phone: v.phone.trim() || null,
        bio: v.bio.trim() || null,
        avatarPath,
      });
      setMsg({ ok: true, text: "Perfil guardado." });
      onSaved?.(saved);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || "No pudimos guardar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate aria-label="Perfil del profe">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={v.fullName || profile.fullName} avatarPath={avatarPath} size="lg" pro className="!h-20 !w-20 !text-[1.75rem]" />
        <div className="flex flex-col items-start gap-1">
          <input
            ref={fileRef}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            className="sr-only"
            id="avatar-file"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
          <label
            htmlFor="avatar-file"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-line px-4 text-small font-bold hover:bg-surface-2 focus-within:outline"
          >
            {uploading !== null ? `Subiendo… ${Math.round(uploading * 100)}%` : avatarPath ? "Cambiar foto" : "Subir foto"}
          </label>
          {avatarPath && uploading === null && (
            <button type="button" onClick={() => setAvatarPath(null)} className="min-h-[44px] text-small text-muted underline underline-offset-4">
              Quitar foto (usar iniciales)
            </button>
          )}
        </div>
      </div>

      <Input label="Nombre" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
      <Input label="Email" value={profile.email} disabled readOnly hint="El email no se cambia desde acá." />
      <Input label="Título" placeholder="Kinesiólogo deportivo" value={v.title} onChange={(e) => set("title", e.target.value)} />
      <Input label="WhatsApp" type="tel" inputMode="tel" placeholder="+54 9 11 …" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
      <div>
        <label htmlFor="bio" className="label mb-2 block">
          Bio corta
        </label>
        <textarea
          id="bio"
          rows={3}
          maxLength={BIO_MAX}
          value={v.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Contá en dos líneas en qué te especializás."
          aria-describedby="bio-count"
          className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <p id="bio-count" className="mt-1 text-right text-caption text-muted">
          {v.bio.length}/{BIO_MAX}
        </p>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-small text-success" : "text-small font-medium text-danger-ink"}>
          {msg.ok ? "✓" : "✕"} {msg.text}
        </p>
      )}
      <PillButton type="submit" block arrow disabled={busy || uploading !== null}>
        {busy ? "Guardando…" : "Guardar perfil"}
      </PillButton>
    </form>
  );
}
