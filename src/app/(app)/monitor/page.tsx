"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MonitoredPost = {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  author: string;
  snippet: string;
  relevanceScore: number | null;
  relevanceReason: string | null;
  draftReply: string | null;
  draftReplyAt: string | null;
  postedAt: string;
  discoveredAt: string;
};

type MonitoredSub = {
  id: string;
  subreddit: string;
  projectName: string;
  postCount: number;
  isActive: boolean;
};

type Project = { id: string; name: string };

export default function MonitorPage() {
  const [posts, setPosts] = useState<MonitoredPost[]>([]);
  const [subs, setSubs] = useState<MonitoredSub[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add subreddit form
  const [newSub, setNewSub] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [addingError, setAddingError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [postsRes, subsRes, projectsRes] = await Promise.all([
        fetch("/api/monitor/posts"),
        fetch("/api/monitor/subreddits"),
        fetch("/api/projects"),
      ]);
      if (postsRes.ok) {
        const data = (await postsRes.json()) as { items: MonitoredPost[] };
        setPosts(data.items);
      }
      if (subsRes.ok) {
        const data = (await subsRes.json()) as { items: MonitoredSub[] };
        setSubs(data.items);
      }
      if (projectsRes.ok) {
        const data = (await projectsRes.json()) as {
          items?: Project[];
          projects?: Project[];
        };
        const list = data.items ?? data.projects ?? [];
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      }
    } catch {
      setError("Failed to load monitoring data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function addSubreddit() {
    if (!newSub.trim()) return;
    if (!selectedProjectId) {
      setAddingError("Create a project first in Onboarding.");
      return;
    }
    setAddingError(null);
    setIsAdding(true);
    try {
      const res = await fetch("/api/monitor/subreddits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subreddit: newSub.trim(),
          projectId: selectedProjectId,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAddingError(data.error ?? "Failed to add subreddit");
        return;
      }

      setNewSub("");
      void loadData();
    } catch {
      setAddingError("Network error. Try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function draftReply(postId: string) {
    setDraftingId(postId);
    try {
      const res = await fetch(`/api/monitor/posts/${postId}/draft-reply`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { draft: string };
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  draftReply: data.draft,
                  draftReplyAt: new Date().toISOString(),
                }
              : p,
          ),
        );
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setDraftingId(null);
    }
  }

  function scoreColor(score: number | null): string {
    if (score === null) return "";
    if (score >= 70) return "text-emerald-600";
    if (score >= 50) return "text-amber-600";
    return "text-muted-foreground";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Subreddit Monitor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track subreddits for relevant posts and draft reply comments with AI.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.4fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              Qualified posts {posts.length > 0 ? `(${posts.length})` : ""}
            </p>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!isLoading && posts.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-card/80 p-6">
              <p className="text-sm font-semibold">No posts yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add subreddits to monitor on the right. Posts will appear here
                after the next scan (every 15 minutes).
              </p>
            </div>
          ) : null}

          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-[24px] border border-border bg-card/80 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>r/{post.subreddit}</span>
                    <span>u/{post.author}</span>
                    {post.relevanceScore !== null ? (
                      <span
                        className={`font-semibold ${scoreColor(post.relevanceScore)}`}
                      >
                        {post.relevanceScore}% match
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm font-semibold hover:underline"
                  >
                    {post.title}
                  </a>
                  {post.snippet ? (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {post.snippet}
                    </p>
                  ) : null}
                  {post.relevanceReason ? (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      {post.relevanceReason}
                    </p>
                  ) : null}
                </div>
              </div>

              {post.draftReply ? (
                <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Draft reply
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {post.draftReply}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          post.draftReply ?? "",
                        );
                      }}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                    >
                      Copy to clipboard
                    </button>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    >
                      Open on Reddit
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void draftReply(post.id)}
                    disabled={draftingId === post.id}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {draftingId === post.id ? "Drafting..." : "Draft reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <p className="text-sm font-semibold">Monitored subreddits</p>
            {projects.length > 0 ? (
              <div className="mt-3">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="project-select"
                >
                  Project
                </label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                placeholder="r/startups"
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addSubreddit();
                }}
              />
              <button
                type="button"
                onClick={() => void addSubreddit()}
                disabled={isAdding || !selectedProjectId}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
            {addingError ? (
              <p className="mt-2 text-xs text-destructive">{addingError}</p>
            ) : null}
            {projects.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Create a project in Onboarding first.
              </p>
            ) : null}

            {subs.length > 0 ? (
              <div className="mt-4 space-y-2">
                {subs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">r/{sub.subreddit}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.projectName} &middot; {sub.postCount} posts
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${sub.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      {sub.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                No subreddits monitored yet.
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <p className="text-sm font-semibold">How it works</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>Add subreddits you want to monitor</li>
              <li>We scan for new posts every 15 minutes</li>
              <li>AI scores each post for relevance to your product</li>
              <li>Click "Draft reply" to generate a comment</li>
              <li>Copy the comment and post it on Reddit</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
