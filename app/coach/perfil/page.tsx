"use client";

import { Loading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { StaffProfileForm } from "@/components/coach/StaffProfileForm";
import { BackHeader } from "@/components/coach/TeamParts";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/** Mi perfil (profe): es lo que ve el cliente en «Tu profe → Ver perfil». */
export default function MiPerfilPage() {
  const { user } = useSession();
  const q = useQuery(() => (user ? data.profiles.get(user.id) : Promise.resolve(null)), [user?.id], { live: false });
  if (!user || (q.loading && !q.data)) return <Loading />;
  if (!q.data) return <p className="px-gutter pt-16 text-center text-muted">No pudimos cargar tu perfil.</p>;
  return (
    <div className="pb-10">
      <BackHeader href="/coach" label="Panel" title="Mi perfil" />
      <div className="px-gutter">
        <p className="mb-5 text-small text-muted">Esto es lo que ven tus clientes en «Tu profe».</p>
        <StaffProfileForm profile={q.data} />
      </div>
    </div>
  );
}
