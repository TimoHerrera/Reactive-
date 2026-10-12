// Textos institucionales de Reactive (editables sin tocar las pantallas).

export type Service = { title: string; body: string };

export const SERVICES: Service[] = [
  {
    title: "Rehabilitación",
    body: "Sesiones 100 % personalizadas según tu lesión, objetivos y ritmo de progreso. Lesiones deportivas, postquirúrgico, dolor crónico o limitación de movilidad.",
  },
  // TODO(Reactive): revisar estos textos con el equipo; el diseño solo trae el de Rehabilitación.
  {
    title: "Evaluaciones funcionales",
    body: "Medimos fuerza, movilidad y control para saber de dónde partís y ajustar tu plan con datos.",
  },
  {
    title: "Entrenamiento",
    body: "Rendimiento deportivo y prevención de lesiones, con el mismo seguimiento de tu profe.",
  },
];

/** WhatsApp de Reactive (formato internacional sin + ni espacios). */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export function whatsappLink(message: string): string | null {
  return WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}` : null;
}
