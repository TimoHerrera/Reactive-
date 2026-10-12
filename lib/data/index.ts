import { DATA_SOURCE } from "@/lib/supabase/env";
import type { DataSource } from "./repositories";
import { mockDataSource } from "./mock";
import { supabaseDataSource } from "./supabase";

export type { DataSource } from "./repositories";
export * from "./types";

/** Fuente de datos según NEXT_PUBLIC_DATA_SOURCE (mock | supabase). Usar desde componentes cliente. */
export const data: DataSource = DATA_SOURCE === "supabase" ? supabaseDataSource : mockDataSource;
