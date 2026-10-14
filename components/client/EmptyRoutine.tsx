import { BrushNote, LogoMark, PillButton } from "@/components/ui";

// Estado vacío: «Tu profe todavía no cargó tu rutina».
export function EmptyRoutine({ title = "Mi rutina" }: { title?: string }) {
  return (
    <div className="bg-grid flex min-h-[calc(100dvh-84px)] flex-col px-gutter pb-8 pt-12">
      <h1 className="display text-display-xl text-title">{title}</h1>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-line">
          <LogoMark className="h-12 w-14 text-line" title="" />
        </div>
        <h2 className="display mt-8 text-h1">
          Tu profe todavía no
          <br />
          cargó tu rutina
        </h2>
        <p className="mt-4 max-w-[19rem] text-body text-muted">
          Apenas la publique, aparece acá. Mientras tanto, chusmeá los videos de la biblioteca.
        </p>
        <PillButton href="/app/ejercicios" variant="inverse" arrow className="mt-8">
          Ver ejercicios
        </PillButton>
      </div>
      <BrushNote title="" className="mt-8 text-center">
        <span className="font-semibold">El entrenamiento no es copiar y pegar. Por eso tu rutina se arma a mano.</span>
      </BrushNote>
    </div>
  );
}
