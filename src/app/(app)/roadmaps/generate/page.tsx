import { RoadmapGenerateForm } from "@/components/roadmaps/RoadmapGenerateForm";
import { loadRoadmapGeneratePageData } from "@/lib/roadmapsPageData";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function RoadmapGeneratePage({ searchParams }: PageProps) {
  const { projects, accounts } = await loadRoadmapGeneratePageData();
  const projectParam = searchParams?.projectId;
  const projectId =
    typeof projectParam === "string"
      ? projectParam
      : Array.isArray(projectParam)
        ? (projectParam[0] ?? "")
        : "";

  const initialProjectId = projects.some((project) => project.id === projectId)
    ? projectId
    : (projects[0]?.id ?? "");

  return (
    <RoadmapGenerateForm
      projects={projects}
      accounts={accounts}
      initialProjectId={initialProjectId}
    />
  );
}
