"use client";

import { useParams } from "next/navigation";
import { ClientForm } from "@/components/coach/ClientForm";
import { Loading } from "@/components/Loading";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery(() => data.profiles.get(id), [id], { live: false });
  if (q.loading && !q.data) return <Loading />;
  if (!q.data) return <p className="px-gutter pt-16 text-center text-muted">Cliente no encontrado.</p>;
  return <ClientForm client={q.data} />;
}
