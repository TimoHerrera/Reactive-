// Mail diario de avisos (F11): arma el resumen y lo manda con Resend. El armado es puro (se testea);
// el envío solo corre en el servidor (/api/cron/avisos) con RESEND_API_KEY.
import type { Alert } from "./alerts";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Asunto, texto y HTML del resumen. `siteUrl` sin «/» final. */
export function digestEmail(alerts: Alert[], opts: { name: string; siteUrl: string }) {
  const n = alerts.length;
  const subject = n === 1 ? `Reactive · ${alerts[0]!.title}` : `Reactive · ${n} avisos nuevos`;
  const hello = `Hola ${opts.name.split(" ")[0]}:`;
  const settings = `${opts.siteUrl}/coach/avisos/configurar`;
  const text = [
    hello,
    "",
    ...alerts.map((a) => `• ${a.title}\n  ${a.detail}\n  ${opts.siteUrl}${a.href}`),
    "",
    `Ver todos: ${opts.siteUrl}/coach/avisos`,
    `Cambiar qué avisos recibís: ${settings}`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;max-width:560px">
<p>${escape(hello)}</p>
<ul style="padding-left:18px">
${alerts
  .map((a) => `<li style="margin-bottom:12px"><a href="${escape(opts.siteUrl + a.href)}" style="color:#2457E6;font-weight:bold">${escape(a.title)}</a><br><span style="color:#555">${escape(a.detail)}</span></li>`)
  .join("\n")}
</ul>
<p><a href="${escape(opts.siteUrl)}/coach/avisos" style="color:#2457E6">Ver todos los avisos</a></p>
<p style="color:#888;font-size:12px">Te llega porque activaste «También por mail» en Mis avisos. <a href="${escape(settings)}" style="color:#888">Cambiar o apagar</a>.</p>
</div>`;
  return { subject, text, html };
}

/** Envía con Resend. Devuelve el error como texto (no tira) para que un mail fallido no corte al resto. */
export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AVISOS_FROM;
  if (!key || !from) return "Falta RESEND_API_KEY o AVISOS_FROM.";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    return res.ok ? null : `Resend ${res.status}: ${await res.text()}`;
  } catch (e) {
    return (e as Error).message;
  }
}
