"use client";

import { useParams } from "next/navigation";
import { ClientForm } from "@/components/coach/ClientForm";
import { NoAccess } from "@/components/coach/NoAccess";
import { Loading } from "@/components/Loading";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery(() => data.profiles.get(id), [id], { live: false });
  if (q.loading && !q.data) return <Loading />;
  if (!q.data || q.data.role !== "client") {
    return <NoAccess text="Este cliente no existe o lo atiende otro profe." href="/coach/clientes" label="Volver a Clientes" />;
  }
  return <ClientForm client={q.data} />;
}
