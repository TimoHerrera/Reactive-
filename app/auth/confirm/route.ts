import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

// Links de los mails de Supabase (invitación y recuperación) con token_hash, verificados del lado del servidor.
// Plantillas de email (Supabase → Authentication → Email Templates):
//   Invite user:     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/activar
//   Reset password:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nueva-contrasena
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? (type === "invite" ? "/activar" : "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (tokenHash && type) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL(type === "invite" ? "/activar?error=link" : "/login?error=link", url.origin));
}
