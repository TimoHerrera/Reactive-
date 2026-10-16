import type { Metadata } from "next";
import { AvisosView } from "./AvisosView";

export const metadata: Metadata = { title: "Avisos" };

export default function AvisosPage() {
  return <AvisosView />;
}
