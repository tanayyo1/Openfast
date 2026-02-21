export type AppNavItem = {
  label: string;
  href: string;
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
      { label: "Opportunities", href: "/opportunities" },
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
      { label: "Analytics", href: "/analytics" },
      { label: "Brand Monitoring", href: "/brand-monitoring" },
      { label: "Account Health", href: "/health" },
    ],
  },
];

export const appNavItems: AppNavItem[] = appNavSections.flatMap(
  (section) => section.items,
);

export const appQuickLinks = [
  { label: "Settings", href: "/settings" },
  { label: "Support", href: "/seo/guides/support" },
] as const;
