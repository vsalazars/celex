"use client";

import { useState } from "react";
import SidebarNav from "./SidebarNav";
import OverviewSection from "./sections/OverviewSection";
import CoordinatorsSection from "./sections/coordinators/CoordinatorsSection";
import TeachersSection from "./sections/TeachersSection";
import StudentsSection from "./sections/StudentsSection";
import SettingsMailSection from "./sections/SettingsMailSection";
import SettingsCatalogsSection from "./sections/SettingsCatalogsSection";
import SettingsSecuritySection from "./sections/SettingsSecuritySection";

export type Section =
  | "overview"
  | "coordinators"
  | "teachers"
  | "students"
  | "settings_mail"
  | "settings_catalogs"
  | "settings_security";

export default function DashboardShell() {
  const [active, setActive] = useState<Section>("overview");

  return (
    <main className="flex min-h-[calc(100dvh-0px)]">
      <SidebarNav active={active} onChange={setActive} />
      <section className="flex-1 p-6">
        {active === "overview" && <OverviewSection />}
        {active === "coordinators" && <CoordinatorsSection />}
        {active === "teachers" && <TeachersSection />}
        {active === "students" && <StudentsSection />}
        {active === "settings_mail" && <SettingsMailSection />}
        {active === "settings_catalogs" && <SettingsCatalogsSection />}
        {active === "settings_security" && <SettingsSecuritySection />}
      </section>
    </main>
  );
}
