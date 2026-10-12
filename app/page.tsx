import { LogoMark, PillButton, Stripe, Wordmark } from "@/components/ui";

export default function SplashPage() {
  return (
    <main className="phone bg-grid flex flex-col overflow-hidden px-gutter pb-8 pt-16">
      <div className="flex flex-1 flex-col items-center justify-center">
        <LogoMark className="h-[124px] w-[112px] text-ink" />
        <Wordmark className="mt-10 text-ink" />
      </div>

      <Stripe tilt className="-mx-8 my-10 text-[2.125rem]">
        ¡Sin rutinas genéricas!
      </Stripe>

      <p className="mx-auto max-w-[17rem] text-center text-[1.0625rem] text-muted">
        Cada ejercicio, técnica y terapia pensada solo para vos.
      </p>

      <PillButton href="/login" variant="inverse" arrow block className="mt-8 h-16">
        Entrar
      </PillButton>
      <p className="mt-6 text-center text-label font-bold tracking-[.12em] text-muted">#COMUNIDADREACTIVE</p>
    </main>
  );
}
