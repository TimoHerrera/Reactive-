import Link from "next/link";
import { PillButton } from "@/components/ui";

// Se construye en F5 (importación de Excel con matching).
export default function ImportarPage() {
  return (
    <div className="px-gutter pt-16 text-center">
      <p className="label">Importar Excel</p>
      <h1 className="display mt-2 text-h1">Llega en la próxima fase</h1>
      <p className="mt-3 text-muted">Mientras tanto, podés cargarla a mano o partir de una plantilla.</p>
      <PillButton href="/coach/rutinas/nueva" variant="inverse" className="mt-8">
        Volver
      </PillButton>
      <Link href="/coach" className="mt-4 block text-small text-muted underline">
        Ir al panel
      </Link>
    </div>
  );
}
