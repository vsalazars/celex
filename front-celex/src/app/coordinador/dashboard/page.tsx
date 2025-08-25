"use client";

import CoordinatorGuard from "@/components/guards/CoordinatorGuard";
import CoordinatorDashboardShell from "@/components/coordinator/CoordinatorDashboardShell";

export default function CoordinatorDashboardPage() {
  return (
    <CoordinatorGuard>
      <CoordinatorDashboardShell />
    </CoordinatorGuard>
  );
}
