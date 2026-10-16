// Mail diario de avisos (F11). Lo llama Vercel Cron (vercel.json) con «Authorization: Bearer CRON_SECRET».
// Lee con la service role, arma el resumen de cada profe que activó «También por mail» y marca lo enviado.
import { NextResponse, type NextRequest } from "next/server";
import { baToday } from "@/lib/agenda/time";
import { addDays } from "@/lib/dates";
import { toAppointment, toPayment, toPlan, toPrefs, toProfile, type Row } from "@/lib/data/supabase/rows";
import { DATA_SOURCE } from "@/lib/supabase/env";
import { getAdminSupabase } from "@/lib/supabase/server";
import { planDigests } from "@/lib/notify/digest";
import { digestEmail, sendEmail } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

function rowsOf({ data, error }: { data: unknown; error: { message: string } | null }): Row[] {
  if (error) throw new Error(error.message);
  return (data as Row[]) ?? [];
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (DATA_SOURCE !== "supabase") return NextResponse.json({ skipped: "modo demo: no se mandan mails" });

  const sb = getAdminSupabase();
  const prefRows = rowsOf(await sb.from("notification_prefs").select("*").eq("email_enabled", true));
  if (prefRows.length === 0) return NextResponse.json({ sent: 0 });
  const userIds = prefRows.map((r) => r.user_id as string);

  const today = baToday();
  const [profiles, plans, payments, state] = await Promise.all([
    sb.from("profiles").select("*").then(rowsOf),
    sb.from("client_plans").select("*").then(rowsOf),
    sb.from("payments").select("*").then(rowsOf),
    sb.from("notification_state").select("*").in("user_id", userIds).then(rowsOf),
  ]);
  // Asistencias desde el plan más viejo (packs y por sesión) y pedidos de reprogramación recientes.
  const from = [addDays(today, -30), ...plans.map((p) => p.starts_on as string)].sort()[0]!;
  const appointments = rowsOf(await sb.from("appointments").select("*").gte("starts_at", `${from}T00:00:00-03:00`));

  const digests = planDigests({
    profiles: profiles.map(toProfile),
    plans: plans.map(toPlan),
    payments: payments.map(toPayment),
    appointments: appointments.map(toAppointment),
    prefs: new Map(prefRows.map((r) => [r.user_id as string, toPrefs(r)])),
    state: state.map((s) => ({ userId: s.user_id as string, key: s.key as string, seenAt: (s.seen_at as string) ?? null, emailedAt: (s.emailed_at as string) ?? null })),
    today,
  });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const results = [];
  for (const { user, alerts } of digests) {
    const error = await sendEmail({ to: user.email, ...digestEmail(alerts, { name: user.fullName, siteUrl }) });
    if (!error) {
      const emailedAt = new Date().toISOString();
      await sb.from("notification_state").upsert(alerts.map((a) => ({ user_id: user.id, key: a.key, emailed_at: emailedAt })));
    }
    results.push({ user: user.id, alerts: alerts.length, error });
  }
  return NextResponse.json({ sent: results.filter((r) => !r.error).length, results });
}
