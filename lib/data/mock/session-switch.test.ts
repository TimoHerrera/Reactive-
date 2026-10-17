// @vitest-environment happy-dom
// Cambio de usuario en la misma pestaña: cliente → logout → profe y profe → logout → cliente.
// Nunca se ven datos de la sesión anterior, y cada login/logout avisa a las queries.
import { beforeEach, describe, expect, it } from "vitest";
import { onSessionChange } from "@/lib/auth/session-events";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { mockDataSource as data } from "./index";
import { resetMockDb } from "./store";

const login = async (email: string) => {
  const res = await data.auth.signIn(email, DEMO_PASSWORD);
  expect(res.ok).toBe(true);
};

/** Lo que carga el Panel del profe. */
const panel = async () => {
  const [clients, routines, requests] = await Promise.all([
    data.profiles.listClients(),
    data.routines.list(),
    data.accessRequests.list(),
  ]);
  return { clients: clients.length, routines: routines.length, requests: requests.length };
};

beforeEach(async () => {
  window.localStorage.clear();
  resetMockDb();
  await data.auth.signOut();
});

describe("cambio de sesión en la misma pestaña", () => {
  it("cliente → logout → profe: el Panel muestra los clientes del profe", async () => {
    await login("martina@reactive.test");
    expect(await panel()).toEqual({ clients: 1, routines: 2, requests: 0 }); // la clienta solo se ve a sí misma
    await data.auth.signOut();
    expect(await data.auth.getUser()).toBeNull();

    await login("nico@reactive.test");
    const p = await panel();
    expect(p.clients).toBe(8);
    expect(p.routines).toBeGreaterThan(2);
    expect(p.requests).toBe(1); // la que lo eligió; la «Todavía no tengo» la ve el admin
    expect((await data.auth.getUser())?.role).toBe("coach");
  });

  it("profe → logout → cliente: ve su rutina y nada del profe", async () => {
    await login("nico@reactive.test");
    expect((await data.coachNotes.listForClient(IDS.martina)).length).toBeGreaterThan(0);
    await data.auth.signOut();

    await login("martina@reactive.test");
    const routines = await data.routines.listForClient(IDS.martina);
    expect(routines.map((r) => r.name)).toContain("Readaptación – Fase 2");
    // Nada del profe ni de otros clientes:
    expect(await data.coachNotes.listForClient(IDS.martina)).toEqual([]);
    expect((await data.profiles.listClients()).map((c) => c.id)).toEqual([IDS.martina]);
    expect(await data.routines.listForClient(IDS.sofia)).toEqual([]);
    expect(await data.accessRequests.list()).toEqual([]);
  });

  it("login, logout y activación avisan a las queries (para descartar datos viejos)", async () => {
    let count = 0;
    const off = onSessionChange(() => count++);
    await login("martina@reactive.test");
    await data.auth.signOut();
    await login("nico@reactive.test");
    off();
    expect(count).toBe(3);
  });

  it("la cookie de sesión acompaña al usuario (la usa el middleware)", async () => {
    await login("martina@reactive.test");
    expect(document.cookie).toContain(encodeURIComponent(`client:${IDS.martina}`));
    await data.auth.signOut();
    await login("nico@reactive.test");
    expect(document.cookie).toContain(encodeURIComponent(`coach:${IDS.nico}`));
    expect(document.cookie).not.toContain(encodeURIComponent(`client:${IDS.martina}`));
  });
});

describe("limpieza de la pestaña al cambiar de usuario", () => {
  it("borra el borrador de rutina, «Ver como» y la posición de Mi Rutina; no toca otras claves", async () => {
    const { clearSessionScopedStorage } = await import("@/lib/auth/session-events");
    sessionStorage.setItem("rx-routine-draft", "{}");
    sessionStorage.setItem("rx-ver-como", IDS.martina);
    sessionStorage.setItem("rx-rutina-pos", "{}");
    sessionStorage.setItem("otra-cosa", "1");
    clearSessionScopedStorage();
    expect(sessionStorage.getItem("rx-routine-draft")).toBeNull();
    expect(sessionStorage.getItem("rx-ver-como")).toBeNull();
    expect(sessionStorage.getItem("rx-rutina-pos")).toBeNull();
    expect(sessionStorage.getItem("otra-cosa")).toBe("1");
  });
});
