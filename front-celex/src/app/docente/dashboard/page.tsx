"use client";

import TeacherGuard from "@/components/guards/TeacherGuard";
import DocenteDashboardShell from "@/components/docente/DocenteDashboardShell";

export default function DocenteDashboardPage() {
  return (
    <TeacherGuard>
      <DocenteDashboardShell />
    </TeacherGuard>
  );
}
