import { RoadmapGenerateForm } from "@/components/roadmaps/RoadmapGenerateForm";
import {
  loadRoadmapGeneratePageData,
  resolveInitialRoadmapProjectId,
} from "@/lib/roadmapsPageData";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OnboardingGenerateRoadmapPage({
  searchParams,
}: PageProps) {
  const { projects, accounts } = await loadRoadmapGeneratePageData();
  const initialProjectId = resolveInitialRoadmapProjectId(
    projects,
    searchParams?.projectId,
  );

  return (
    <RoadmapGenerateForm
      projects={projects}
      accounts={accounts}
      initialProjectId={initialProjectId}
      mode="onboarding"
    />
  );
}
