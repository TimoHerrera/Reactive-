"use client";

import { useEffect } from "react";
import { LogoMark, PillButton } from "@/components/ui";

const RELOAD_KEY = "rx-chunk-reload";

/**
 * Error inesperado en una pantalla.
 * Si es un chunk que ya no existe (hubo un deploy nuevo con la app abierta, o se cortó la red),
 * recarga una vez sola; si vuelve a pasar, muestra la pantalla con «Reintentar».
 */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunk = error.name === "ChunkLoadError" || /Loading chunk|Failed to fetch dynamically imported module/i.test(error.message);

  useEffect(() => {
    if (!isChunk) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
    } catch {
      // sin storage: igual recargamos una vez
    }
    window.location.reload();
  }, [isChunk]);

  useEffect(() => {
    // Si la pantalla carga bien después, se habilita otra recarga automática a futuro.
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        // nada
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="phone bg-grid flex min-h-dvh flex-col items-center justify-center px-gutter text-center">
      <LogoMark className="h-14 w-12 text-ink" />
      <h1 className="display mt-8 text-h1">Algo falló</h1>
      <p className="mt-3 max-w-[18rem] text-body text-muted">
        {isChunk ? "Hay una versión nueva de la app o se cortó la conexión." : "Tuvimos un problema al cargar esta pantalla."}
      </p>
      <PillButton
        arrow
        className="mt-8"
        onClick={() => {
          if (isChunk) window.location.reload();
          else reset();
        }}
      >
        Reintentar
      </PillButton>
    </main>
  );
}
