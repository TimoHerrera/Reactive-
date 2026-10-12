import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { decodeMockSession, homeForRole, MOCK_SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Role } from "@/lib/data/types";

const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "mock";
const AUTH_PAGES = ["/login", "/recuperar"];

async function resolveRole(req: NextRequest, res: NextResponse): Promise<Role | null> {
  if (DATA_SOURCE === "mock") {
    return decodeMockSession(req.cookies.get(MOCK_SESSION_COOKIE)?.value)?.role ?? null;
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
  if (!data.user) return null;
  const { data: row } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return (row?.role as Role) ?? null;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const { pathname, search } = req.nextUrl;
  const role = await resolveRole(req, res);

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  const needsAuth = pathname.startsWith("/app") || pathname.startsWith("/coach");
  if (needsAuth && !role) {
    return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  // /coach es solo para staff. /app lo ve el cliente y también el staff («Ver como Martina»).
  if (pathname.startsWith("/coach") && role === "client") return redirect("/app");
  if (role && AUTH_PAGES.includes(pathname)) return redirect(homeForRole(role));

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/coach/:path*", "/login", "/recuperar"],
};
