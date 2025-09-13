"use client";

import { useState } from "react";
import CoordinatorSidebarNav, { CoordinatorSection } from "./CoordinatorSidebarNav";
import OverviewSection from "./sections/OverviewSection";
import GroupsSection from "./sections/GroupsSection";
import TeachersSection from "./sections/TeachersSection";
import StudentsSection from "./sections/StudentsSection";
import ReportsSection from "./sections/ReportsSection";
import SettingsSection from "./sections/SettingsSection";
import SecuritySection from "./sections/SecuritySection";
import InscripcionesSection from "@/components/coordinator/sections/InscripcionesSection"; // 👈 NUEVO
import CoordinatorPlacement from "./sections/CoordinatorPlacement"; // 👈 NUEVO
import SurveySection from "@/components/coordinator/sections/SurveySection"; // 👈 NUEVO (Encuesta)

export default function CoordinatorDashboardShell() {
  const [active, setActive] = useState<CoordinatorSection>("overview");

  return (
    <main className="flex min-h-[calc(100dvh-0px)]">
      <CoordinatorSidebarNav active={active} onChange={setActive} />
      <section className="flex-1 p-6">
        {active === "overview"       && <OverviewSection />}
        {active === "groups"         && <GroupsSection />}
        {active === "teachers"       && <TeachersSection />}
        {active === "students"       && <StudentsSection />}
        {active === "inscripciones"  && <InscripcionesSection />}   {/* NUEVO */}
        {active === "placement"      && <CoordinatorPlacement />}   {/* NUEVO */}
        {active === "encuesta"       && <SurveySection />}          {/* NUEVO */}
        {active === "reports"        && <ReportsSection />}
        {active === "settings"       && <SettingsSection />}
        {active === "security"       && <SecuritySection />}
      </section>
    </main>
  );
}
