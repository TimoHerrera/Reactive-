import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { ClientDetail } from "./ClientDetail";

export default function ClientPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientDetail />
    </Suspense>
  );
}
