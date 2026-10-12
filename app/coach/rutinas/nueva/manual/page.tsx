import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { ManualWizard } from "./ManualWizard";

export const metadata: Metadata = { title: "Nueva rutina" };

export default function ManualPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ManualWizard />
    </Suspense>
  );
}
