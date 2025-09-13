"use client";

import { useState } from "react";
import DocenteSidebarNav, { TeacherSection } from "./DocenteSidebarNav";
import OverviewSection from "./sections/OverviewSection";
import GroupsSection from "./sections/GroupsSection";
import MaterialsSection from "./sections/MaterialsSection";
import EvaluationsSection from "./sections/EvaluationsSection";
import SettingsSection from "./sections/SettingsSection";
import SecuritySection from "./sections/SecuritySection";
import PlacementSection from "./sections/PlacementSection"; // 👈 NUEVO

export default function DocenteDashboardShell() {
  const [active, setActive] = useState<TeacherSection>("overview");

  return (
    <main className="flex min-h-[calc(100dvh-0px)]">
      <DocenteSidebarNav active={active} onChange={setActive} />
      <section className="flex-1 p-6">
        {active === "overview"    && <OverviewSection />}
        {active === "groups"      && <GroupsSection />}
        {active === "placement"   && <PlacementSection />}   {/* 👈 NUEVO */}
        {active === "materials"   && <MaterialsSection />}
        {active === "evaluations" && <EvaluationsSection />}
        {active === "settings"    && <SettingsSection />}
        {active === "security"    && <SecuritySection />}
      </section>
    </main>
  );
}
