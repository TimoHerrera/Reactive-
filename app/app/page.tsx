import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { HoyView } from "./HoyView";

export default function HoyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HoyView />
    </Suspense>
  );
}
