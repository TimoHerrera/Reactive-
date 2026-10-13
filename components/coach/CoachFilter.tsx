"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { FilterChip } from "@/components/ui";
import { data, type Profile } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

const KEY = "rx-profe-filtro"; // se borra al cambiar de sesión (prefijo rx-)
const EVENT = "rx-profe-filtro";

/**
 * Filtro «Profe: Todos / Nico / Jano…» (solo admin). Lo comparten Panel, Clientes y Rutinas.
 * Para un profe no aplica: la capa de datos ya le devuelve solo lo suyo.
 */
export function useCoachFilter(): {
  isAdmin: boolean;
  coachId: string | null;
  setCoachId: (id: string | null) => void;
  coaches: Profile[];
} {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const [coachId, setState] = useState<string | null>(null);
  const staff = useQuery(() => (isAdmin ? data.profiles.listStaff() : Promise.resolve([] as Profile[])), [isAdmin]);

  useEffect(() => {
    const read = () => {
      try {
        setState(sessionStorage.getItem(KEY));
      } catch {
        setState(null);
      }
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  const setCoachId = useCallback((id: string | null) => {
    try {
      if (id) sessionStorage.setItem(KEY, id);
      else sessionStorage.removeItem(KEY);
    } catch {
      // sin storage: el filtro vive solo en esta pantalla
    }
    setState(id);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const coaches = (staff.data ?? []).filter((p) => !p.disabledAt).sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
  return { isAdmin, coachId: isAdmin ? coachId : null, setCoachId, coaches };
}

export function CoachFilterChips({ filter, className }: { filter: ReturnType<typeof useCoachFilter>; className?: string }) {
  if (!filter.isAdmin || filter.coaches.length === 0) return null;
  return (
    <div className={className}>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-gutter" role="group" aria-label="Filtrar por profe">
        <span className="label shrink-0">Profe</span>
        <FilterChip active={!filter.coachId} onClick={() => filter.setCoachId(null)}>
          Todos
        </FilterChip>
        {filter.coaches.map((c) => (
          <FilterChip key={c.id} active={filter.coachId === c.id} onClick={() => filter.setCoachId(c.id)}>
            {c.fullName}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
