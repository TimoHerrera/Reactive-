import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Vuelta de los links de Supabase (invitación y recuperación de contraseña).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
