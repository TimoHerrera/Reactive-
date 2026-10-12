import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { PerfilView } from "./PerfilView";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PerfilView />
    </Suspense>
  );
}
