// Crea (o promueve) el primer admin. No hay PIN fijo ni registro público de profes: el resto del equipo
// lo invita un admin desde «Equipo».
//
//   npm run create-admin -- email@ejemplo.com "Nombre Apellido"
//
// Usa SUPABASE_SERVICE_ROLE_KEY (de .env.local o del entorno). Correlo en tu compu, nunca en el navegador.
import { createClient } from "@supabase/supabase-js";
import { codeExpiry, generateInviteCode, hashCode, parseCreateAdminArgs } from "../lib/team/rules";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se usan las variables del entorno
}

function fail(msg: string): never {
  console.error(`✕ ${msg}`);
  process.exit(1);
}

async function main() {
  const args = parseCreateAdminArgs(process.argv.slice(2));
  if (!args.ok) fail(args.error);
  const { email, name } = args;

  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase") {
    console.log("Modo mock (NEXT_PUBLIC_DATA_SOURCE no es «supabase»): no hay base real que tocar.");
    console.log("En la demo ya existe un admin: entrá con «Admin» en el acceso rápido de /login (admin@reactive.test).");
    console.log("Para crear el admin real, configurá Supabase en .env.local y volvé a correr este comando.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) ¿Ya tiene perfil? → se promueve.
  const { data: existing, error: selErr } = await admin.from("profiles").select("id, role, full_name, disabled_at").eq("email", email).maybeSingle();
  if (selErr) fail(`No pudimos leer los perfiles: ${selErr.message}. ¿Corriste las migraciones?`);
  if (existing) {
    const { error } = await admin.from("profiles").update({ role: "admin", disabled_at: null }).eq("id", existing.id);
    if (error) fail(`No pudimos promoverlo: ${error.message}`);
    await admin.auth.admin.updateUserById(existing.id, { ban_duration: "none" });
    console.log(`✓ ${existing.full_name} (${email}) ahora es admin. Era: ${existing.role}${existing.disabled_at ? " (desactivado, ya reactivado)" : ""}.`);
    return;
  }

  // 2) ¿Existe en Auth sin perfil? → se crea el perfil.
  let userId: string | null = null;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`No pudimos listar usuarios: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  let invited = false;

  // 3) No existe → invitación por mail (lleva a /activar).
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/activar")}`,
      data: { full_name: name },
    });
    if (error || !data.user) fail(`No pudimos invitarlo: ${error?.message ?? "sin usuario"}`);
    userId = data.user.id;
    invited = true;
  }

  const { error: upErr } = await admin.from("profiles").upsert({ id: userId, role: "admin", full_name: name, email });
  if (upErr) fail(`No pudimos crear el perfil: ${upErr.message}`);

  if (!invited) {
    console.log(`✓ ${name} (${email}) ya tenía usuario: ahora es admin. Entrá en ${site}/login.`);
    return;
  }

  // Código de respaldo por si el mail no llega (un solo uso, 48 h).
  const code = generateInviteCode();
  const { error: codeErr } = await admin.from("invite_codes").insert({
    code_hash: await hashCode(code),
    email,
    profile_id: userId,
    expires_at: codeExpiry(),
  });
  console.log(`✓ ${name} (${email}) es admin. Le mandamos un mail para crear su contraseña.`);
  if (!codeErr) {
    console.log(`  Si el mail no llega: ${site}/activar?codigo → email + código ${code} (un solo uso, vence en 48 h).`);
  }
}

main().catch((e) => fail((e as Error).message));
