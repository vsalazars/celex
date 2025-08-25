"use client";

import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/admin/DashboardShell";

export default function AdminDashboardPage() {
  return (
    <RequireAuth roles={["superuser"]}>
      <DashboardShell />
    </RequireAuth>
  );
}
