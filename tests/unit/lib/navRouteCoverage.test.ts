import fs from "node:fs";
import path from "node:path";
import { appNavItems, appQuickLinks } from "@/components/app/navConfig";

function isRouteGroup(segment: string) {
  return segment.startsWith("(") && segment.endsWith(")");
}

function collectPageRouteTemplates(
  directory: string,
  segments: string[] = [],
): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const templates: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nextSegments = isRouteGroup(entry.name)
        ? segments
        : [...segments, entry.name];
      templates.push(...collectPageRouteTemplates(fullPath, nextSegments));
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      templates.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }

  return templates;
}

function isDynamicSegment(segment: string) {
  return /^\[.+\]$/.test(segment);
}

function isCatchAllSegment(segment: string) {
  return /^\[\.\.\..+\]$/.test(segment);
}

function isOptionalCatchAllSegment(segment: string) {
  return /^\[\[\.\.\..+\]\]$/.test(segment);
}

function templateMatchesHref(template: string, href: string) {
  const templateSegments = template.split("/").filter(Boolean);
  const hrefSegments = href.split("/").filter(Boolean);

  let templateIndex = 0;
  let hrefIndex = 0;

  while (templateIndex < templateSegments.length) {
    const templateSegment = templateSegments[templateIndex];

    if (isOptionalCatchAllSegment(templateSegment)) {
      return true;
    }

    if (isCatchAllSegment(templateSegment)) {
      return hrefIndex < hrefSegments.length;
    }

    if (hrefIndex >= hrefSegments.length) {
      return false;
    }

    if (
      !isDynamicSegment(templateSegment) &&
      templateSegment !== hrefSegments[hrefIndex]
    ) {
      return false;
    }

    templateIndex += 1;
    hrefIndex += 1;
  }

  return hrefIndex === hrefSegments.length;
}

describe("left-nav route coverage", () => {
  const appDir = path.join(process.cwd(), "src", "app");
  const routeTemplates = Array.from(
    new Set(collectPageRouteTemplates(appDir)),
  );
  const leftNavHrefs = [...appNavItems, ...appQuickLinks].map(
    (item) => item.href,
  );

  test("template matcher handles dynamic and catch-all segments safely", () => {
    expect(templateMatchesHref("/seo/[type]/[slug]", "/seo/guides/support")).toBe(
      true,
    );
    expect(templateMatchesHref("/seo/[type]/[slug]", "/seo/guides")).toBe(
      false,
    );

    expect(templateMatchesHref("/docs/[...slug]", "/docs")).toBe(false);
    expect(templateMatchesHref("/docs/[...slug]", "/docs/getting-started")).toBe(
      true,
    );

    expect(templateMatchesHref("/docs/[[...slug]]", "/docs")).toBe(true);
    expect(templateMatchesHref("/docs/[[...slug]]", "/docs/a/b")).toBe(true);
  });

  test("template matcher avoids prefix-collision false positives", () => {
    expect(templateMatchesHref("/content", "/content-calendar")).toBe(false);
    expect(templateMatchesHref("/settings", "/settings-advanced")).toBe(false);
  });

  test("every left-nav href resolves to an existing app route template", () => {
    const unmatched = leftNavHrefs.filter(
      (href) =>
        !routeTemplates.some((template) => templateMatchesHref(template, href)),
    );

    expect(unmatched).toEqual([]);
  });
});
