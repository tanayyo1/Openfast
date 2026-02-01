import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DemoProject = {
  id: string;
  name: string;
  url?: string;
  description: string;
  brandVoice: string;
  goals: string[];
  createdAt: string;
};

export type DemoRedditAccount = {
  id: string;
  username: string;
  tier: "New" | "Established";
  connectedAt: string;
};

export type DemoTaskStatus =
  | "Draft"
  | "Needs approval"
  | "Approved"
  | "Scheduled"
  | "Published"
  | "Failed";

export type DemoTaskType = "Post" | "Comment";

export type DemoTask = {
  id: string;
  roadmapId: string;
  projectId: string;
  type: DemoTaskType;
  subreddit: string;
  bestWindow: string;
  status: DemoTaskStatus;
  draftId?: string;
  scheduledAt?: string;
};

export type DemoRoadmap = {
  id: string;
  projectId: string;
  title: string;
  window: string;
  createdAt: string;
};

export type DemoDraftVariant = {
  title: string;
  body: string;
  riskScore: number;
  notes: string[];
};

export type DemoDraft = {
  id: string;
  taskId: string;
  projectId: string;
  subreddit: string;
  status: DemoTaskStatus;
  variants: DemoDraftVariant[];
  selectedIndex: number;
  editedTitle: string;
  editedBody: string;
  createdAt: string;
};

type DemoState = {
  projects: DemoProject[];
  redditAccounts: DemoRedditAccount[];
  roadmaps: DemoRoadmap[];
  tasks: DemoTask[];
  drafts: DemoDraft[];

  createProject: (input: {
    name: string;
    url?: string;
    description: string;
    brandVoice: string;
    goals: string[];
  }) => string;

  connectRedditAccount: (input: {
    username: string;
    tier: DemoRedditAccount["tier"];
  }) => string;

  generateRoadmap: (input: { projectId: string }) => string;

  generateDraftForTask: (input: { taskId: string }) => string;
  selectDraftVariant: (input: { draftId: string; index: number }) => void;
  saveDraftEdits: (input: {
    draftId: string;
    title: string;
    body: string;
  }) => void;
  requestApproval: (input: { taskId: string }) => void;
  approveDraft: (input: { taskId: string }) => void;

  scheduleTask: (input: { taskId: string; scheduledAt: string }) => void;
  markPublished: (input: { taskId: string }) => void;

  resetDemo: () => void;
};

const nowIso = () => new Date().toISOString();

function makeId(prefix: string) {
  // crypto.randomUUID exists in modern browsers. For safety in older environments, fall back.
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}-${Date.now()}`;
  return `${prefix}_${uuid}`;
}

function seedTasks(roadmapId: string, projectId: string): DemoTask[] {
  return [
    {
      id: makeId("task"),
      roadmapId,
      projectId,
      type: "Post",
      subreddit: "r/startups",
      bestWindow: "Tue 09:00",
      status: "Draft",
    },
    {
      id: makeId("task"),
      roadmapId,
      projectId,
      type: "Comment",
      subreddit: "r/SaaS",
      bestWindow: "Thu 13:00",
      status: "Draft",
    },
    {
      id: makeId("task"),
      roadmapId,
      projectId,
      type: "Post",
      subreddit: "r/Entrepreneur",
      bestWindow: "Sat 10:00",
      status: "Draft",
    },
  ];
}

function seedVariants(subreddit: string): DemoDraftVariant[] {
  return [
    {
      title: `What has been your best ${subreddit} learning this month?`,
      body: `Sharing a quick lesson from building in public.\n\nWhat is one thing you would do differently if you restarted today?`,
      riskScore: 22,
      notes: ["Ends with a question", "No links in body", "No direct CTA"],
    },
    {
      title: `Looking for feedback on a simple workflow I use`,
      body: `I tried a lightweight workflow and it helped reduce context switching.\n\nWhat workflow do you follow when you are overwhelmed?`,
      riskScore: 35,
      notes: ["Keep tone humble", "Avoid product naming", "No outbound links"],
    },
    {
      title: `How do you approach this problem?`,
      body: `I am comparing a few approaches and would love to hear what has worked for you.\n\nWhat tradeoffs matter most in your setup?`,
      riskScore: 18,
      notes: ["Generic enough for strict subs", "Discussion-led", "No hype"],
    },
  ];
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      projects: [],
      redditAccounts: [],
      roadmaps: [],
      tasks: [],
      drafts: [],

      createProject: (input) => {
        const projectId = makeId("project");
        const project: DemoProject = {
          id: projectId,
          name: input.name,
          url: input.url,
          description: input.description,
          brandVoice: input.brandVoice,
          goals: input.goals,
          createdAt: nowIso(),
        };
        set((state) => ({ projects: [project, ...state.projects] }));
        return projectId;
      },

      connectRedditAccount: (input) => {
        const accountId = makeId("reddit");
        const account: DemoRedditAccount = {
          id: accountId,
          username: input.username,
          tier: input.tier,
          connectedAt: nowIso(),
        };
        set((state) => ({
          redditAccounts: [account, ...state.redditAccounts],
        }));
        return accountId;
      },

      generateRoadmap: ({ projectId }) => {
        const roadmapId = makeId("roadmap");
        const roadmap: DemoRoadmap = {
          id: roadmapId,
          projectId,
          title: "MVP demo roadmap",
          window: "Next 14 days",
          createdAt: nowIso(),
        };
        const newTasks = seedTasks(roadmapId, projectId);
        set((state) => ({
          roadmaps: [roadmap, ...state.roadmaps],
          tasks: [...newTasks, ...state.tasks],
        }));
        return roadmapId;
      },

      generateDraftForTask: ({ taskId }) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return "";

        const draftId = makeId("draft");
        const variants = seedVariants(task.subreddit);
        const selected = variants[0];

        const draft: DemoDraft = {
          id: draftId,
          taskId,
          projectId: task.projectId,
          subreddit: task.subreddit,
          status: "Draft",
          variants,
          selectedIndex: 0,
          editedTitle: selected.title,
          editedBody: selected.body,
          createdAt: nowIso(),
        };

        set((state) => ({
          drafts: [draft, ...state.drafts],
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, draftId } : t,
          ),
        }));

        return draftId;
      },

      selectDraftVariant: ({ draftId, index }) => {
        set((state) => ({
          drafts: state.drafts.map((draft) => {
            if (draft.id !== draftId) return draft;
            const next = draft.variants[index] ?? draft.variants[0];
            if (!next) return draft;
            return {
              ...draft,
              selectedIndex: index,
              editedTitle: next.title,
              editedBody: next.body,
            };
          }),
        }));
      },

      saveDraftEdits: ({ draftId, title, body }) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === draftId
              ? { ...draft, editedTitle: title, editedBody: body }
              : draft,
          ),
        }));
      },

      requestApproval: ({ taskId }) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, status: "Needs approval" } : task,
          ),
          drafts: state.drafts.map((draft) =>
            draft.taskId === taskId
              ? { ...draft, status: "Needs approval" }
              : draft,
          ),
        }));
      },

      approveDraft: ({ taskId }) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, status: "Approved" } : task,
          ),
          drafts: state.drafts.map((draft) =>
            draft.taskId === taskId ? { ...draft, status: "Approved" } : draft,
          ),
        }));
      },

      scheduleTask: ({ taskId, scheduledAt }) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? { ...task, status: "Scheduled", scheduledAt }
              : task,
          ),
        }));
      },

      markPublished: ({ taskId }) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, status: "Published" } : task,
          ),
        }));
      },

      resetDemo: () => {
        set({
          projects: [],
          redditAccounts: [],
          roadmaps: [],
          tasks: [],
          drafts: [],
        });
      },
    }),
    {
      name: "rf_demo_store_v1",
    },
  ),
);
