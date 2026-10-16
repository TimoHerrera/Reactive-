import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { PagosView } from "./PagosView";

export const metadata: Metadata = { title: "Pagos" };

export default function PagosPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PagosView />
    </Suspense>
  );
}
