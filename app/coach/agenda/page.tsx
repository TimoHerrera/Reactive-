import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { AgendaView } from "./AgendaView";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AgendaView />
    </Suspense>
  );
}
