import type { Metadata } from "next";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import {
  HeroSection,
  ProblemSection,
  WorkflowSection,
  ProofSection,
  FeaturesSection,
  CTASection,
} from "@/components/home";

export const metadata: Metadata = {
  title:
    "RedditFast - Find Viral Reddit Content in Minutes | AI-Powered Discovery",
  description:
    "Discover trending Reddit posts, analyze subreddit rules, and get AI-generated drafts. Lower your ban risk while scaling your Reddit growth with 80% time saved.",
  openGraph: {
    title: "RedditFast - Find Viral Reddit Content in Minutes",
    description:
      "Discover trending Reddit posts, analyze subreddit rules, and get AI-generated drafts. Start free today.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div>
      <AnalyticsBeacon
        eventName="homepage_view"
        source="web_public"
        onceKey="public_homepage_view"
      />
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <ProofSection />
      <FeaturesSection />
      <CTASection />
    </div>
  );
}
