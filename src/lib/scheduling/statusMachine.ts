import { ScheduledStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<ScheduledStatus, ScheduledStatus[]> = {
  SCHEDULED: [ScheduledStatus.PUBLISHING, ScheduledStatus.CANCELLED],
  PENDING_APPROVAL: [ScheduledStatus.SCHEDULED, ScheduledStatus.CANCELLED],
  PUBLISHING: [
    ScheduledStatus.PUBLISHED,
    ScheduledStatus.FAILED_RETRYABLE,
    ScheduledStatus.FAILED_PERMANENT,
  ],
  PUBLISHED: [],
  FAILED_RETRYABLE: [ScheduledStatus.PUBLISHING],
  FAILED_PERMANENT: [],
  CANCELLED: [],
};

export function assertScheduledStatusTransition(
  from: ScheduledStatus,
  to: ScheduledStatus,
) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`INVALID_STATUS_TRANSITION:${from}->${to}`);
  }
}
