import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { ImportFlow } from "./ImportFlow";

export const metadata: Metadata = { title: "Importar Excel" };

export default function ImportarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ImportFlow />
    </Suspense>
  );
}
