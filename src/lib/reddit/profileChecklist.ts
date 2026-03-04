import type { SafetyTier } from "@prisma/client";

export type ChecklistItemStatus = "PASS" | "WARN" | "FAIL";

export type ProfileChecklistItem = {
  key: string;
  label: string;
  status: ChecklistItemStatus;
  detail: string;
  action?: string;
};

export type ProfileChecklistInput = {
  scopes: string[];
  accountAgeDays: number;
  linkKarma: number;
  commentKarma: number;
  safetyTier: SafetyTier;
  lastSyncAt: Date;
  latestHealthScore: number | null;
  publishedComments: number;
  commentFirstMinComments: number;
};

function normalizeScopes(scopes: string[]) {
  return new Set(
    scopes
      .map((scope) => scope.trim().toLowerCase())
      .filter((scope) => scope.length > 0),
  );
}

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function parseNonNegativeEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.floor(raw);
}

export function getChecklistThresholds() {
  return {
    minimumAccountAgeDays: parsePositiveEnvInt(
      "PROFILE_CHECKLIST_MIN_ACCOUNT_AGE_DAYS",
      14,
    ),
    minimumCombinedKarma: parsePositiveEnvInt(
      "PROFILE_CHECKLIST_MIN_COMBINED_KARMA",
      50,
    ),
    minimumCommentKarma: parsePositiveEnvInt(
      "PROFILE_CHECKLIST_MIN_COMMENT_KARMA",
      20,
    ),
    maximumSyncAgeDays: parsePositiveEnvInt(
      "PROFILE_CHECKLIST_MAX_SYNC_AGE_DAYS",
      7,
    ),
    minimumHealthScore: parsePositiveEnvInt(
      "PROFILE_CHECKLIST_MIN_HEALTH_SCORE",
      45,
    ),
    maxWarningsForReady: parseNonNegativeEnvInt(
      "PROFILE_CHECKLIST_MAX_WARNINGS_FOR_READY",
      2,
    ),
  };
}

function pass(
  key: string,
  label: string,
  detail: string,
): ProfileChecklistItem {
  return { key, label, status: "PASS", detail };
}

function warn(
  key: string,
  label: string,
  detail: string,
  action?: string,
): ProfileChecklistItem {
  return { key, label, status: "WARN", detail, action };
}

function fail(
  key: string,
  label: string,
  detail: string,
  action: string,
): ProfileChecklistItem {
  return { key, label, status: "FAIL", detail, action };
}

export function buildRedditProfileChecklist(input: ProfileChecklistInput) {
  const thresholds = getChecklistThresholds();
  const scopeSet = normalizeScopes(input.scopes);
  const accountAgeDays = Math.max(0, Math.floor(input.accountAgeDays));
  const linkKarma = Math.max(0, Math.floor(input.linkKarma));
  const commentKarma = Math.max(0, Math.floor(input.commentKarma));
  const combinedKarma = linkKarma + commentKarma;
  const publishedComments = Math.max(0, Math.floor(input.publishedComments));
  const commentFirstMinComments = Math.max(
    0,
    Math.floor(input.commentFirstMinComments),
  );
  const syncAgeDays = Math.max(
    0,
    Math.floor(
      (Date.now() - input.lastSyncAt.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const items: ProfileChecklistItem[] = [];

  const missingScopes = ["identity", "read", "submit"].filter(
    (scope) => !scopeSet.has(scope),
  );
  if (missingScopes.length === 0) {
    items.push(
      pass(
        "required_scopes",
        "Required scopes",
        "All core Reddit scopes are connected.",
      ),
    );
  } else {
    items.push(
      fail(
        "required_scopes",
        "Required scopes",
        `Missing scopes: ${missingScopes.join(", ")}.`,
        "Reconnect the Reddit account and approve all requested permissions.",
      ),
    );
  }

  if (accountAgeDays >= thresholds.minimumAccountAgeDays) {
    items.push(
      pass(
        "account_age",
        "Account age",
        `Account age is ${accountAgeDays} days.`,
      ),
    );
  } else {
    items.push(
      warn(
        "account_age",
        "Account age",
        `Account age is ${accountAgeDays} days; recommended minimum is ${thresholds.minimumAccountAgeDays}.`,
        "Prioritize comments and avoid promotional posts until account age increases.",
      ),
    );
  }

  if (combinedKarma >= thresholds.minimumCombinedKarma) {
    items.push(
      pass(
        "combined_karma",
        "Combined karma",
        `Combined karma is ${combinedKarma}.`,
      ),
    );
  } else {
    items.push(
      warn(
        "combined_karma",
        "Combined karma",
        `Combined karma is ${combinedKarma}; target at least ${thresholds.minimumCombinedKarma}.`,
        "Publish value-first comments in selected subreddits to build trust.",
      ),
    );
  }

  if (commentKarma >= thresholds.minimumCommentKarma) {
    items.push(
      pass(
        "comment_karma",
        "Comment karma",
        `Comment karma is ${commentKarma}.`,
      ),
    );
  } else {
    items.push(
      warn(
        "comment_karma",
        "Comment karma",
        `Comment karma is ${commentKarma}; target at least ${thresholds.minimumCommentKarma}.`,
        "Engage in existing threads before creating new posts.",
      ),
    );
  }

  if (syncAgeDays <= thresholds.maximumSyncAgeDays) {
    items.push(
      pass(
        "sync_freshness",
        "Sync freshness",
        `Last account sync was ${syncAgeDays} day(s) ago.`,
      ),
    );
  } else {
    items.push(
      warn(
        "sync_freshness",
        "Sync freshness",
        `Last account sync was ${syncAgeDays} day(s) ago.`,
        "Run an account health refresh before scheduling new content.",
      ),
    );
  }

  if (input.safetyTier === "RESTRICTED") {
    items.push(
      fail(
        "safety_tier",
        "Safety tier",
        "Account is currently RESTRICTED.",
        "Pause posting and complete visibility/health checks before resuming.",
      ),
    );
  } else {
    items.push(
      pass(
        "safety_tier",
        "Safety tier",
        `Current tier is ${input.safetyTier}.`,
      ),
    );
  }

  if (input.latestHealthScore == null) {
    items.push(
      warn(
        "health_score",
        "Health score",
        "No recent health snapshot found.",
        "Run account health check to capture a baseline score.",
      ),
    );
  } else if (input.latestHealthScore >= thresholds.minimumHealthScore) {
    items.push(
      pass(
        "health_score",
        "Health score",
        `Latest health score is ${input.latestHealthScore}.`,
      ),
    );
  } else {
    items.push(
      fail(
        "health_score",
        "Health score",
        `Latest health score is ${input.latestHealthScore} (minimum ${thresholds.minimumHealthScore}).`,
        "Address removals/warnings and improve account health before posting.",
      ),
    );
  }

  if (input.safetyTier === "NEW") {
    if (publishedComments >= commentFirstMinComments) {
      items.push(
        pass(
          "comment_first_progress",
          "Comment-first progress",
          `Published comments: ${publishedComments}/${commentFirstMinComments}.`,
        ),
      );
    } else {
      items.push(
        fail(
          "comment_first_progress",
          "Comment-first progress",
          `Published comments: ${publishedComments}/${commentFirstMinComments}.`,
          "Complete comment-first requirement before scheduling post drafts.",
        ),
      );
    }
  } else {
    items.push(
      pass(
        "comment_first_progress",
        "Comment-first progress",
        "Comment-first requirement applies only to NEW tier accounts.",
      ),
    );
  }

  const passed = items.filter((item) => item.status === "PASS").length;
  const warned = items.filter((item) => item.status === "WARN").length;
  const failed = items.filter((item) => item.status === "FAIL").length;
  const score = Math.round((passed / items.length) * 100);

  return {
    score,
    summary: {
      total: items.length,
      passed,
      warned,
      failed,
    },
    readiness:
      failed > 0
        ? "NOT_READY"
        : warned > thresholds.maxWarningsForReady
          ? "NEEDS_IMPROVEMENT"
          : "READY",
    items,
  };
}
