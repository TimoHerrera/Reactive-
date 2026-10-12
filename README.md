# Reactive App

PWA mobile-first de **REACTIVE – Rehabilitación y Entrenamiento**. Cada cliente ve su rutina personalizada y el video de cada ejercicio grabado por su profe. ¡Sin rutinas genéricas!

- Diseño (fuente de verdad visual): [`docs/REACTIVE — MVP mobile.pdf`](docs/)
- Especificación funcional: [`docs/prompt-claude-code.md`](docs/prompt-claude-code.md)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind 3.4 (tokens del design system en `tailwind.config.ts`) · Barlow / Barlow Condensed · Supabase (Postgres, Auth, Storage, RLS) · SheetJS · fuse.js · Vitest · Playwright · Vercel.

## Setup local

Requiere Node 20.19+ (recomendado: 22 LTS).

```bash
npm install
cp .env.example .env.local   # por defecto NEXT_PUBLIC_DATA_SOURCE=mock
npm run dev                  # http://localhost:3000
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y servidor de producción (el service worker solo se registra en producción) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitarios (Vitest) |

## Rutas útiles

- `/`: splash
- `/dev/ui`: catálogo de componentes del design system

## Estado por fase

- [x] **F0**: setup, tokens, fuentes, PWA y `/dev/ui`
- [ ] F1: capa de datos (mock), auth simulada por rol, layouts, migraciones/RLS/seed de Supabase
- [ ] F2: biblioteca de ejercicios con subida de video
- [ ] F3: experiencia del cliente
- [ ] F4: carga manual de rutinas
- [ ] F5: importación de Excel
- [ ] F6: Panel, Clientes, Rutinas y pulido
- [ ] F7: E2E con Playwright y deploy

Las secciones de Supabase (migraciones, seed y primer admin) se completan en F1.
