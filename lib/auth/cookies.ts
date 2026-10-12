import type { Role } from "@/lib/data/types";

/** Cookie de la sesión simulada (solo modo mock): «rol:userId». La lee el middleware. */
export const MOCK_SESSION_COOKIE = "rx_mock_session";

export function encodeMockSession(role: Role, userId: string) {
  return `${role}:${userId}`;
}

export function decodeMockSession(value: string | undefined | null): { role: Role; userId: string } | null {
  if (!value) return null;
  const [role, userId] = decodeURIComponent(value).split(":");
  if (!userId || (role !== "admin" && role !== "coach" && role !== "client")) return null;
  return { role, userId };
}

export function homeForRole(role: Role): string {
  return role === "client" ? "/app" : "/coach";
}
