"use client";

import { RoleShell } from "@/components/RoleShell";
import { COACH_TABS } from "@/components/ui/TabBar";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell area="coach" tabs={COACH_TABS}>
      {children}
    </RoleShell>
  );
}
