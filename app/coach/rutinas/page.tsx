import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading } from "@/components/Loading";
import { RutinasList } from "./RutinasList";

export const metadata: Metadata = { title: "Rutinas" };

export default function RutinasPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RutinasList />
    </Suspense>
  );
}
