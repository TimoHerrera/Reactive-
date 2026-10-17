import type { Metadata } from "next";
import { ConfigurarAvisosView } from "./ConfigurarAvisosView";

export const metadata: Metadata = { title: "Mis avisos" };

export default function ConfigurarAvisosPage() {
  return <ConfigurarAvisosView />;
}
