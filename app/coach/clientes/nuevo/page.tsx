import type { Metadata } from "next";
import { ClientForm } from "@/components/coach/ClientForm";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewClientPage() {
  return <ClientForm />;
}
