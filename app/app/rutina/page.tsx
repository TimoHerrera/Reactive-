import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { RutinaView } from "./RutinaView";

export const metadata: Metadata = { title: "Mi rutina" };

export default function MiRutinaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RutinaView />
    </Suspense>
  );
}
