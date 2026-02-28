import {
  calculateDayIndexFromDate,
  calculateActualDueDate,
} from "@/lib/roadmapRetarget";

describe("roadmapRetarget", () => {
  describe("calculateActualDueDate", () => {
    it("calculates due date correctly for dayIndex 1", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const dueDate = calculateActualDueDate(1, startDate);
      expect(dueDate.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    });

    it("calculates due date correctly for dayIndex 5", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const dueDate = calculateActualDueDate(5, startDate);
      expect(dueDate.toISOString()).toBe("2024-01-05T00:00:00.000Z");
    });

    it("handles month overflow correctly", () => {
      const startDate = new Date("2024-01-30T00:00:00Z");
      const dueDate = calculateActualDueDate(3, startDate);
      expect(dueDate.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    });

    it("handles year overflow correctly", () => {
      const startDate = new Date("2024-12-30T00:00:00Z");
      const dueDate = calculateActualDueDate(5, startDate);
      expect(dueDate.toISOString()).toBe("2025-01-03T00:00:00.000Z");
    });
  });

  describe("calculateDayIndexFromDate", () => {
    it("returns 1 for start date", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const taskDate = new Date("2024-01-01T00:00:00Z");
      const dayIndex = calculateDayIndexFromDate(taskDate, startDate, 30);
      expect(dayIndex).toBe(1);
    });

    it("returns 5 for date 4 days after start", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const taskDate = new Date("2024-01-05T00:00:00Z");
      const dayIndex = calculateDayIndexFromDate(taskDate, startDate, 30);
      expect(dayIndex).toBe(5);
    });

    it("clamps to horizonDays maximum", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const taskDate = new Date("2024-02-15T00:00:00Z");
      const dayIndex = calculateDayIndexFromDate(taskDate, startDate, 30);
      expect(dayIndex).toBe(30);
    });

    it("clamps to minimum of 1", () => {
      const startDate = new Date("2024-01-05T00:00:00Z");
      const taskDate = new Date("2024-01-01T00:00:00Z");
      const dayIndex = calculateDayIndexFromDate(taskDate, startDate, 30);
      expect(dayIndex).toBe(1);
    });

    it("handles negative delta (moving earlier)", () => {
      const startDate = new Date("2024-01-10T00:00:00Z");
      const taskDate = new Date("2024-01-05T00:00:00Z");
      const dayIndex = calculateDayIndexFromDate(taskDate, startDate, 30);
      expect(dayIndex).toBe(1);
    });
  });

  describe("date delta calculations", () => {
    it("calculates positive delta correctly", () => {
      const oldDate = new Date("2024-01-01T00:00:00Z");
      const newDate = new Date("2024-01-10T00:00:00Z");
      const deltaMs = newDate.getTime() - oldDate.getTime();
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));
      expect(deltaDays).toBe(9);
    });

    it("calculates negative delta correctly", () => {
      const oldDate = new Date("2024-01-15T00:00:00Z");
      const newDate = new Date("2024-01-10T00:00:00Z");
      const deltaMs = newDate.getTime() - oldDate.getTime();
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));
      expect(deltaDays).toBe(-5);
    });

    it("handles month boundary correctly", () => {
      const oldDate = new Date("2024-01-28T00:00:00Z");
      const newDate = new Date("2024-02-05T00:00:00Z");
      const deltaMs = newDate.getTime() - oldDate.getTime();
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));
      expect(deltaDays).toBe(8);
    });
  });
});
