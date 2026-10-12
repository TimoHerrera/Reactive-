"use client";

import { RoleShell } from "@/components/RoleShell";
import { CLIENT_TABS } from "@/components/ui/TabBar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell area="client" tabs={CLIENT_TABS}>
      {children}
    </RoleShell>
  );
}
