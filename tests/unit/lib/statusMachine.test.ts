import { ScheduledStatus } from "@prisma/client";
import { assertScheduledStatusTransition } from "@/lib/scheduling/statusMachine";

describe("assertScheduledStatusTransition", () => {
  it("allows scheduled -> publishing", () => {
    expect(() =>
      assertScheduledStatusTransition(
        ScheduledStatus.SCHEDULED,
        ScheduledStatus.PUBLISHING,
      ),
    ).not.toThrow();
  });

  it("rejects published -> publishing", () => {
    expect(() =>
      assertScheduledStatusTransition(
        ScheduledStatus.PUBLISHED,
        ScheduledStatus.PUBLISHING,
      ),
    ).toThrow(/INVALID_STATUS_TRANSITION/);
  });
});
