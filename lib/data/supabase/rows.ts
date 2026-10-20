// Mapeos fila de Postgres → dominio. Los usan la capa de datos del navegador y el mail diario de avisos (servidor).
import type { Appointment, AppointmentType, AvailabilityRule, BookingSettings, ClientPlan, NotificationPrefs, Payment, Profile, TimeOff } from "../types";

export type Row = Record<string, unknown>;

export const toProfile = (r: Row): Profile => ({
  id: r.id as string,
  role: r.role as Profile["role"],
  fullName: r.full_name as string,
  email: (r.email as string) ?? "",
  phone: (r.phone as string) ?? null,
  title: (r.title as string) ?? null,
  sport: (r.sport as string) ?? null,
  caseType: (r.case_type as Profile["caseType"]) ?? null,
  caseDetail: (r.case_detail as string) ?? null,
  goal: (r.goal as string) ?? null,
  coachId: (r.coach_id as string) ?? null,
  clientSince: (r.client_since as string) ?? null,
  createdAt: r.created_at as string,
  bio: (r.bio as string) ?? null,
  avatarPath: (r.avatar_path as string) ?? null,
  activatedAt: (r.activated_at as string) ?? null,
  disabledAt: (r.disabled_at as string) ?? null,
});

export const toAppointment = (r: Row): Appointment => ({
  id: r.id as string,
  clientId: r.client_id as string,
  coachId: r.coach_id as string,
  startsAt: r.starts_at as string,
  durationMin: r.duration_min as number,
  type: r.type as Appointment["type"],
  status: r.status as Appointment["status"],
  notes: (r.notes as string) ?? null,
  seriesId: (r.series_id as string) ?? null,
  createdBy: (r.created_by as string) ?? null,
  createdAt: r.created_at as string,
  rescheduleReason: (r.reschedule_reason as string) ?? null,
  reschedulePreference: (r.reschedule_preference as string) ?? null,
  rescheduleRequestedAt: (r.reschedule_requested_at as string) ?? null,
});

export const toPlan = (r: Row): ClientPlan => ({
  clientId: r.client_id as string,
  kind: r.kind as ClientPlan["kind"],
  amountCents: Number(r.amount_cents),
  dueDay: (r.due_day as number) ?? null,
  packSessions: (r.pack_sessions as number) ?? null,
  startsOn: r.starts_on as string,
  active: !!r.active,
  updatedAt: r.updated_at as string,
});

export const toPayment = (r: Row): Payment => ({
  id: r.id as string,
  clientId: r.client_id as string,
  amountCents: Number(r.amount_cents),
  paidAt: r.paid_at as string,
  method: r.method as Payment["method"],
  period: (r.period as string) ?? null,
  sessions: (r.sessions as number) ?? null,
  note: (r.note as string) ?? null,
  registeredBy: (r.registered_by as string) ?? null,
  createdAt: r.created_at as string,
});

export const toPrefs = (r: Row): NotificationPrefs => ({
  dueSoonEnabled: !!r.due_soon_enabled,
  dueSoonDays: Number(r.due_soon_days),
  overdueEnabled: !!r.overdue_enabled,
  overdueAfterDays: Number(r.overdue_after_days),
  overdueRepeatDays: r.overdue_repeat_days == null ? null : Number(r.overdue_repeat_days),
  packLowEnabled: !!r.pack_low_enabled,
  packLowSessions: Number(r.pack_low_sessions),
  rescheduleEnabled: !!r.reschedule_enabled,
  scope: r.scope === "all" ? "all" : "mine",
  bookingEnabled: r.booking_enabled !== false,
  emailEnabled: !!r.email_enabled,
  updatedAt: (r.updated_at as string) ?? null,
});

export const fromPrefs = (userId: string, p: Omit<NotificationPrefs, "updatedAt">): Row => ({
  user_id: userId,
  due_soon_enabled: p.dueSoonEnabled,
  due_soon_days: p.dueSoonDays,
  overdue_enabled: p.overdueEnabled,
  overdue_after_days: p.overdueAfterDays,
  overdue_repeat_days: p.overdueRepeatDays,
  pack_low_enabled: p.packLowEnabled,
  pack_low_sessions: p.packLowSessions,
  reschedule_enabled: p.rescheduleEnabled,
  scope: p.scope,
  booking_enabled: p.bookingEnabled,
  email_enabled: p.emailEnabled,
});

// ── Reservas (F12) ──
export const toBookingSettings = (r: Row): BookingSettings => ({
  coachId: r.coach_id as string,
  enabled: !!r.enabled,
  autoConfirm: !!r.auto_confirm,
  slotMinutes: Number(r.slot_minutes),
  minNoticeHours: Number(r.min_notice_hours),
  maxDaysAhead: Number(r.max_days_ahead),
  cancelHours: Number(r.cancel_hours),
  types: (r.types as AppointmentType[]) ?? [],
  updatedAt: (r.updated_at as string) ?? null,
});
/** «08:00:00» → «08:00» */
const hhmm = (t: unknown) => String(t ?? "").slice(0, 5);
export const toRule = (r: Row): AvailabilityRule => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  weekday: Number(r.weekday),
  startTime: hhmm(r.start_time),
  endTime: hhmm(r.end_time),
});
export const toTimeOff = (r: Row): TimeOff => ({ id: r.id as string, coachId: r.coach_id as string, date: r.date as string, reason: (r.reason as string) ?? null });
