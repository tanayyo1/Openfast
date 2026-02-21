import {
  appNavItems,
  appNavSections,
  appQuickLinks,
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
});
