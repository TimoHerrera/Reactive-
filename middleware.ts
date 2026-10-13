import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { decodeMockSession, homeForRole, MOCK_SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Role } from "@/lib/data/types";

const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "mock";
const AUTH_PAGES = ["/login", "/recuperar"];

type Viewer = { role: Role | null; disabled?: boolean };

async function resolveViewer(req: NextRequest, res: NextResponse): Promise<Viewer> {
  if (DATA_SOURCE === "mock") {
    // En mock un desactivado no puede iniciar sesión, así que la cookie alcanza.
    return { role: decodeMockSession(req.cookies.get(MOCK_SESSION_COOKIE)?.value)?.role ?? null };
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { role: null };
  const { data: row } = await supabase.from("profiles").select("role, disabled_at").eq("id", data.user.id).maybeSingle();
  // Desactivado: RLS ya no le deja leer su fila (row = null) o la ve con disabled_at. En ambos casos, afuera.
  if (!row || row.disabled_at) {
    await supabase.auth.signOut();
    return { role: null, disabled: true };
  }
  return { role: row.role as Role };
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const { pathname, search } = req.nextUrl;
  const { role, disabled } = await resolveViewer(req, res);

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  const needsAuth = pathname.startsWith("/app") || pathname.startsWith("/coach");
  if (needsAuth && !role) {
    return redirect(disabled ? "/login?error=desactivado" : `/login?next=${encodeURIComponent(pathname + search)}`);
  }
  // /coach es solo para staff. /app lo ve el cliente y también el staff («Ver como Martina»).
  if (pathname.startsWith("/coach") && role === "client") return redirect("/app");
  // Equipo (alta de profes, roles, desactivar): solo admin.
  if (pathname.startsWith("/coach/equipo") && role !== "admin") return redirect("/coach");
  if (role && AUTH_PAGES.includes(pathname)) return redirect(homeForRole(role));

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/coach/:path*", "/login", "/recuperar"],
};
