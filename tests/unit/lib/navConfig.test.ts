import {
  appNavItems,
  appNavSections,
  appQuickLinks,
  isNavItemActive,
  navSectionsForEntitlements,
} from "@/components/app/navConfig";

describe("app navigation config", () => {
  test("has stable section order for IA", () => {
    expect(appNavSections.map((section) => section.title)).toEqual([
      "Plan",
      "Execution",
      "Growth",
      "Insights",
    ]);
  });

  test("flattens section items without losing routes", () => {
    const flattened = appNavSections.flatMap((section) => section.items);
    expect(appNavItems).toEqual(flattened);
  });

  test("does not contain duplicate nav hrefs", () => {
    const hrefs = appNavItems.map((item) => item.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  test("uses title case labels for insights routes", () => {
    expect(appNavItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/brand-monitoring",
          label: "Brand Monitoring",
        }),
        expect.objectContaining({ href: "/health", label: "Account Health" }),
      ]),
    );
  });

  test("keeps quick links focused on support and settings", () => {
    expect(appQuickLinks).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "Support", href: "/seo/guides/support" },
    ]);
  });

  test("matches active nav routes for nested and exact paths", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/setup", "/dashboard")).toBe(false);

    expect(isNavItemActive("/content", "/content")).toBe(true);
    expect(isNavItemActive("/content/drafts/123", "/content")).toBe(true);
    expect(isNavItemActive("/content-calendar", "/content")).toBe(false);

    expect(isNavItemActive("/seo/guides/support", "/seo/guides/support")).toBe(
      true,
    );
    expect(
      isNavItemActive("/seo/guides/support/faq", "/seo/guides/support"),
    ).toBe(true);
    expect(
      isNavItemActive("/seo/guides/supporting", "/seo/guides/support"),
    ).toBe(false);
  });

  test("filters entitlement-gated links consistently", () => {
    const freeSections = navSectionsForEntitlements({
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
    });
    const freeHrefs = freeSections.flatMap((section) =>
      section.items.map((item) => item.href),
    );
    expect(freeHrefs).not.toContain("/analytics");
    expect(freeHrefs).not.toContain("/brand-monitoring");
    expect(freeHrefs).not.toContain("/opportunities");

    const paidSections = navSectionsForEntitlements({
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
    });
    const paidHrefs = paidSections.flatMap((section) =>
      section.items.map((item) => item.href),
    );
    expect(paidHrefs).toContain("/analytics");
    expect(paidHrefs).toContain("/brand-monitoring");
    expect(paidHrefs).toContain("/opportunities");
  });
});
