import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { ClientesList } from "./ClientesList";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientesList />
    </Suspense>
  );
}
