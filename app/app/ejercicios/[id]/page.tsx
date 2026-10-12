import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { ExerciseDetail } from "./ExerciseDetail";

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExerciseDetail />
    </Suspense>
  );
}
