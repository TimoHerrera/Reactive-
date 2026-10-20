import type { Metadata } from "next";
import { TurnosView } from "./TurnosView";

export const metadata: Metadata = { title: "Turnos" };

export default function TurnosPage() {
  return <TurnosView />;
}
