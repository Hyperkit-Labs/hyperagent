import {
  getBreadcrumbItems,
  getCommandPaletteRouteItems,
  getRouteLabel,
  getStudioNavItems,
  STUDIO_NAV_ITEMS,
} from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";

describe("Studio navigation contract", () => {
  it("keeps a single ordered nav set across groups", () => {
    expect(getStudioNavItems("core").map((item) => item.label)).toEqual([
      "Overview",
      "Projects",
    ]);

    expect(getStudioNavItems("tools").map((item) => item.label)).toEqual([
      "Agents",
      "Deployments",
      "Contracts",
      "Apps",
      "Networks",
      "Analytics",
      "History",
      "Payments",
      "Logs & Monitoring",
      "Security",
    ]);

    expect(getStudioNavItems("resources").map((item) => item.label)).toEqual([
      "Templates",
      "Marketplace",
      "Infrastructure",
      "Docs",
    ]);

    expect(STUDIO_NAV_ITEMS).toHaveLength(16);
  });

  it("covers dynamic workflow and app breadcrumb paths", () => {
    expect(getBreadcrumbItems("/workflows/abc123")).toEqual([
      { href: ROUTES.WORKFLOWS, label: "Projects" },
      { href: "/workflows/abc123", label: "Workflow", current: true },
    ]);

    expect(getBreadcrumbItems("/workflows/abc123/runs/run987")).toEqual([
      { href: ROUTES.WORKFLOWS, label: "Projects" },
      { href: "/workflows/abc123", label: "Workflow" },
      {
        href: "/workflows/abc123/runs/run987",
        label: "Run",
        current: true,
      },
    ]);

    expect(getBreadcrumbItems("/apps/demo-app")).toEqual([
      { href: ROUTES.APPS, label: "Apps" },
      { href: "/apps/demo-app", label: "App", current: true },
    ]);
  });

  it("resolves route labels consistently for static and dynamic paths", () => {
    expect(getRouteLabel(ROUTES.MONITORING)).toBe("Logs & Monitoring");
    expect(getRouteLabel(ROUTES.MARKETPLACE)).toBe("Marketplace");
    expect(getRouteLabel("/workflows/abc123/runs/run987")).toBe("Run");
    expect(getRouteLabel("/apps/demo-app")).toBe("App");
  });

  it("exposes all quick-jump items plus settings", () => {
    const labels = getCommandPaletteRouteItems().map((item) => item.label);
    expect(labels).toContain("Marketplace");
    expect(labels).toContain("Settings");
    expect(labels).toContain("Logs & Monitoring");
    expect(labels).toHaveLength(STUDIO_NAV_ITEMS.length + 1);
  });
});
