"use client";

import { useMemo } from "react";
import { useBilling } from "@/components/billing/useBilling";
import { useSession } from "@/components/SessionProvider";
import { addDays } from "@/lib/dates";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import type { NotificationPrefs } from "@/lib/data/types";
import { buildAlerts, type Alert } from "@/lib/notify/alerts";

/** Avisos del profe con sus preferencias, separados en nuevos (no vistos) y vistos. */
export function useAlerts() {
  const { user } = useSession();
  const billing = useBilling();
  const q = useQuery(async () => {
    const [prefs, seen, appointments] = await Promise.all([
      data.notifications.getPrefs(),
      data.notifications.listSeen(),
      data.appointments.list({ from: addDays(billing.today, -30) }),
    ]);
    return { prefs, seen: new Set(seen), appointments };
  }, [user?.id]);

  /** Avisos que habría hoy con estas preferencias (también para la vista previa de «Mis avisos»). */
  const compute = (prefs: NotificationPrefs | undefined): Alert[] =>
    q.data && billing.data && user && prefs
      ? buildAlerts({ rows: billing.rows, appointments: q.data.appointments, prefs, me: user, today: billing.today })
      : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const alerts = useMemo(() => compute(q.data?.prefs), [q.data, billing.data, billing.rows, billing.today, user]);

  const seen = q.data?.seen;
  const fresh = alerts.filter((a) => !seen?.has(a.key));
  const old = alerts.filter((a) => seen?.has(a.key));

  const markSeen = async (keys: string[]) => {
    if (keys.length === 0) return;
    q.setData((prev) => (prev ? { ...prev, seen: new Set([...prev.seen, ...keys]) } : prev));
    await data.notifications.markSeen(keys);
  };

  return {
    loading: !q.data || !billing.data,
    error: q.error ?? billing.error,
    reload: async () => void (await Promise.all([q.reload(), billing.reload()])),
    prefs: q.data?.prefs,
    alerts,
    fresh,
    old,
    today: billing.today,
    markSeen,
    compute,
  };
}
