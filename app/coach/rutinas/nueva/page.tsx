import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { NuevaRutina } from "./NuevaRutina";

export const metadata: Metadata = { title: "Nueva rutina" };

export default function NuevaRutinaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NuevaRutina />
    </Suspense>
  );
}
