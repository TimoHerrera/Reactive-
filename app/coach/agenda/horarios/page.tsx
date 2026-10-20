import type { Metadata } from "next";
import { HorariosView } from "./HorariosView";

export const metadata: Metadata = { title: "Mis horarios" };

export default function HorariosPage() {
  return <HorariosView />;
}
