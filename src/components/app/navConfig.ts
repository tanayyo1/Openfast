export type AppNavItem = {
  label: string;
  href: string;
  featureFlag?: "advancedAnalytics" | "smartFinder";
};

export type AppNavSection = {
  title: string;
  items: AppNavItem[];
};

export const appNavSections: AppNavSection[] = [
  {
    title: "Plan",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Onboarding", href: "/onboarding" },
      { label: "Projects", href: "/projects" },
      { label: "Roadmaps", href: "/roadmaps" },
    ],
  },
  {
    title: "Execution",
    items: [
      { label: "Content", href: "/content" },
      { label: "Approvals", href: "/approvals" },
      { label: "Scheduling", href: "/scheduling" },
      {
        label: "Opportunities",
        href: "/opportunities",
        featureFlag: "smartFinder",
      },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Landing Pages", href: "/landing-pages" },
      { label: "Reddit Ads", href: "/ads" },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Analytics",
        href: "/analytics",
        featureFlag: "advancedAnalytics",
      },
      {
        label: "Brand Monitoring",
        href: "/brand-monitoring",
        featureFlag: "smartFinder",
      },
      { label: "Account Health", href: "/health" },
    ],
  },
];

export const appNavItems: AppNavItem[] = appNavSections.flatMap(
  (section) => section.items,
);

export type AppNavEntitlements = {
  hasAdvancedAnalytics: boolean;
  hasSmartFinder: boolean;
};

export function navSectionsForEntitlements(
  entitlements: AppNavEntitlements,
): AppNavSection[] {
  return appNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.featureFlag === "advancedAnalytics") {
          return entitlements.hasAdvancedAnalytics;
        }
        if (item.featureFlag === "smartFinder") {
          return entitlements.hasSmartFinder;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export const appQuickLinks = [
  { label: "Settings", href: "/settings" },
  { label: "Support", href: "/seo/guides/support" },
] as const;

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
