import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { ProfeView } from "./ProfeView";

export const metadata: Metadata = { title: "Tu profe" };

export default function ProfePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfeView />
    </Suspense>
  );
}
