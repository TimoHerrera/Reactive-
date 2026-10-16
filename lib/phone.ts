// Teléfonos de Argentina → formato internacional para WhatsApp (549 + área + número, sin el 0 ni el 15).

/**
 * «+54 9 11 5555-0101», «011 15 5555-0101», «11 5555-0101», «(0351) 15 123-4567», «5491155550101» → «5491155550101».
 * Un número de otro país que ya viene con «+» y código distinto de 54 se deja como está (solo dígitos).
 * Devuelve null si no se puede armar un número válido (ej. falta el código de área).
 */
export function normalizeArPhone(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  let d = text.replace(/\D/g, "");
  if (text.startsWith("+") && !d.startsWith("54")) return d.length >= 8 ? d : null;
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);

  // Nacional = área (2 a 4 dígitos) + abonado, 10 dígitos. Si sobran 2, es el «15» del celular después del área.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  // Ningún código de área empieza con 15: «15 5555-0101» es un celular sin área.
  return d.length === 10 && !d.startsWith("15") ? `549${d}` : null;
}

/** Link de WhatsApp con mensaje precargado. Null si no hay teléfono válido. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const n = normalizeArPhone(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}
