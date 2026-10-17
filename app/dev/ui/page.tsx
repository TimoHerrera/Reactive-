"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar,
  BrushNote,
  CLIENT_TABS,
  COACH_TABS,
  DayChip,
  ExerciseCard,
  FilterChip,
  ImportPreviewTable,
  Input,
  LogoMark,
  PillButton,
  ProCard,
  StatusBadge,
  Stripe,
  TabBar,
  Wordmark,
  type BadgeStatus,
} from "@/components/ui";

const COLORS = [
  ["bg", "#0A0A0A"],
  ["surface", "#161616"],
  ["surface-2", "#222222"],
  ["line", "#2E2E2E"],
  ["ink", "#FFFFFF"],
  ["muted", "#9A9A9A"],
  ["title", "#BDBDBD"],
  ["accent", "#2457E6"],
  ["accent-deep", "#1B3A9E"],
  ["success", "#34C759"],
  ["danger", "#E53935"],
  ["danger-ink", "#FF7A75"],
  ["warning", "#F5B841"],
] as const;

const BADGES: BadgeStatus[] = [
  "activa",
  "por-vencer",
  "vencida",
  "sin-rutina",
  "con-video",
  "sin-video",
  "video-yt",
  "revisar",
  "no-encontrado",
  "plantilla",
  "no-hagas-esto",
  "solo-profes",
];

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-gutter py-8">
      <h2 className="display mb-5 flex items-baseline gap-2 text-h2">
        <span className="text-small text-muted">{n}</span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  const [day, setDay] = useState("A");
  const [filter, setFilter] = useState("Piernas");
  const [done, setDone] = useState<Record<number, boolean>>({ 1: true });
  const toggle = (n: number) => setDone((d) => ({ ...d, [n]: !d[n] }));

  return (
    <main className="phone pb-[120px]">
      <header className="bg-grid px-gutter pb-8 pt-10">
        <div className="flex items-center gap-4">
          <LogoMark className="h-12 w-14 text-ink" />
          <Wordmark className="!text-left" />
        </div>
        <h1 className="display mt-8 text-display-xl text-title">Design system</h1>
        <p className="mt-2 text-small text-muted">MVP mobile · PWA · tokens en tailwind.config · v0.1</p>
      </header>

      <Section n="01" title="Color">
        <div className="grid grid-cols-3 gap-3">
          {COLORS.map(([name, hex]) => (
            <div key={name}>
              <div className="h-14 rounded-md border border-line" style={{ background: hex }} />
              <p className="mt-1.5 text-caption font-semibold">{name}</p>
              <p className="font-mono text-[0.6875rem] text-muted">{hex}</p>
            </div>
          ))}
          <div>
            <div className="bg-grid h-14 rounded-md border border-line" />
            <p className="mt-1.5 text-caption font-semibold">grilla</p>
            <p className="font-mono text-[0.6875rem] text-muted">white 7 % · 28 px</p>
          </div>
        </div>
      </Section>

      <Section n="02" title="Tipografía">
        <div className="space-y-4">
          <p className="display text-display-xl">Hola, Martina</p>
          <p className="display text-display-section text-title">Rehabilitación</p>
          <p className="display text-h1">Día A — Tren inferior</p>
          <p className="display text-h2 text-title">Bloque principal</p>
          <p className="display text-button">Empezar →</p>
          <p className="label">Tu sesión de hoy</p>
          <p className="text-title-sm">Sentadilla goblet</p>
          <p className="text-body">Si el tobillo molesta, bajá a peso corporal.</p>
          <p className="text-small text-muted">Vigente 29/9 → 26/10</p>
        </div>
      </Section>

      <Section n="03" title="Espacio y forma">
        <div className="flex items-end gap-4">
          {[
            ["sm · 8", "rounded-sm"],
            ["md · 12", "rounded-md"],
            ["lg · 16", "rounded-lg"],
            ["pill", "rounded-full"],
          ].map(([l, r]) => (
            <div key={l} className="text-center">
              <div className={`h-12 w-12 border border-line bg-surface-2 ${r}`} />
              <p className="mt-1 text-caption text-muted">{l}</p>
            </div>
          ))}
        </div>
        <ul className="mt-5 space-y-1 text-small text-muted">
          <li>Áreas táctiles de 44 px como mínimo.</li>
          <li>Sin sombras: la jerarquía sale de bg → surface → surface-2.</li>
          <li>Texto azul sobre negro no pasa AA: el azul va de fondo o subrayado.</li>
        </ul>
      </Section>

      <Section n="04" title="PillButton">
        <div className="space-y-3">
          <PillButton arrow block>
            Empezar
          </PillButton>
          <PillButton variant="inverse" arrow block>
            Ver ejercicios
          </PillButton>
          <div className="flex gap-3">
            <PillButton variant="outline" size="sm" className="flex-1">
              Editar
            </PillButton>
            <PillButton size="sm" disabled className="flex-1">
              Deshabilitado
            </PillButton>
          </div>
          <p className="text-caption text-muted">primary · inverse · outline · disabled — h 56 / 48 / 44</p>
        </div>
      </Section>

      <Section n="05" title="Stripe · BrushNote">
        <div className="-mx-gutter space-y-6 overflow-hidden px-0 py-2 [&>*]:-mx-4">
          <Stripe>¡Tu recuperación en manos expertas!</Stripe>
          <Stripe tilt>¡Sin rutinas genéricas!</Stripe>
        </div>
        <BrushNote className="mt-6">Calidad &gt; cantidad. ¡No faltes!</BrushNote>
      </Section>

      <Section n="06" title="StatusBadge">
        <div className="flex flex-wrap gap-2">
          {BADGES.map((b) => (
            <StatusBadge key={b} status={b} />
          ))}
        </div>
      </Section>

      <Section n="07" title="DayChip · filtros">
        <div className="flex gap-2">
          {[
            ["A", "Tren inferior"],
            ["B", "Agilidad + tren sup."],
            ["C", "Fuerza + estabilidad"],
          ].map(([l, t]) => (
            <DayChip key={l} label={`Día ${l}`} title={t} active={day === l} onClick={() => setDay(l!)} />
          ))}
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {["Todos", "Piernas", "Core", "Movilidad"].map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </FilterChip>
          ))}
        </div>
      </Section>

      <Section n="08" title="ExerciseCard">
        <div className="space-y-3">
          <ExerciseCard
            number={3}
            name="Sentadilla goblet"
            href="#"
            chips={[{ text: "4 × 8" }, { text: "16 kg" }, { text: "Desc. 90 s", muted: true }, { text: "Tempo 3-1-1", muted: true }]}
            note="Rodillas en la línea de los pies."
            done={!!done[3]}
            onToggle={() => toggle(3)}
          />
          <ExerciseCard
            number={2}
            name="Activación de tobillo con banda"
            chips={[{ text: "3 × 15" }, { text: "Banda media" }]}
            done={!!done[2]}
            onToggle={() => toggle(2)}
          />
          <ExerciseCard
            number={1}
            name="Movilidad de flexores de cadera"
            href="#"
            chips={[{ text: "2 × 45 s" }]}
            done={!!done[1]}
            onToggle={() => toggle(1)}
          />
        </div>
      </Section>

      <Section n="09" title="Input">
        <div className="space-y-5">
          <Input label="Email" type="email" placeholder="tu@email.com" />
          <Input label="Nombre de la rutina" defaultValue="Readaptación – Fase 2" />
          <Input label="Contraseña" type="password" defaultValue="secreto" error="Email o contraseña incorrectos." />
          <Input search placeholder="¿No sabés cómo se llama? Buscalo…" aria-label="Buscar ejercicio" />
        </div>
      </Section>

      <Section n="10" title="Avatar">
        <div className="flex items-center gap-4">
          <Avatar name="Martina G." size="xs" />
          <Avatar name="Martina G." size="sm" />
          <Avatar name="Sofía R." size="md" />
          <Avatar name="Nico R." size="lg" pro />
        </div>
        <ProCard name="Nico R." role="Kinesiólogo deportivo" className="mt-5" />
      </Section>

      <Section n="11" title="ImportPreviewTable">
        <ImportPreviewTable
          rows={[
            { key: "1", day: "A", order: 3, block: "Principal", sets: 4, exercise: "Sentadilla goblet", reps: "8", load: "16 kg", status: "ok-video" },
            { key: "2", day: "A", order: 4, block: "Principal", sets: 4, exercise: "RDL c/ mancuernas", reps: "8", load: "2×14", status: "revisar", suggestion: "Peso muerto rumano" },
            { key: "3", day: "A", order: 9, block: "Accesorios", sets: 3, exercise: "Salto al cajón unipodal", reps: "5", load: "", status: "no-encontrado" },
          ]}
        />
        <p className="mt-2 text-caption text-muted">
          Columnas: Día | Bloque | Orden | Ejercicio | Series | Reps | Carga | Descanso | Notas · scroll horizontal en mobile.
        </p>
      </Section>

      <Section n="12" title="TabBar">
        <div className="-mx-gutter space-y-3">
          <TabBar items={CLIENT_TABS} activeHref="/app" fixed={false} />
          <TabBar items={COACH_TABS} activeHref="/coach" fixed={false} />
        </div>
      </Section>
    </main>
  );
}
