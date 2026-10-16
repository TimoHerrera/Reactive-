import type { Metadata } from "next";
import { AjustesView } from "./AjustesView";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return <AjustesView />;
}
