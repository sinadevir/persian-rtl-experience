import { describe, expect, it } from "vitest";
import { inferFilter, matchesFilter } from "@/components/cis/column-filter";

describe("column filters", () => {
  it("picks yes/no for boolean columns, date for ISO dates, text otherwise", () => {
    expect(inferFilter([true, false, null])?.type).toBe("boolean");
    expect(inferFilter(["2025-05-01T10:00:00", "2025-06-02"])?.type).toBe("date");
    expect(inferFilter(["تهران", 12])?.type).toBe("text");
    expect(inferFilter([undefined, ""])).toBeUndefined();
  });
  it("text filter matches Persian digits against Latin values", () => {
    expect(matchesFilter({ type: "text" }, "code", { code: "۱۲" }, "P-1234")).toBe(true);
    expect(matchesFilter({ type: "text" }, "code", { code: "۹۹" }, "P-1234")).toBe(false);
  });
  it("date range keeps only days inside the range", () => {
    const f = { type: "dateRange", from: "from", to: "to" } as const;
    const v = { from: "2025-05-01", to: "2025-05-31" };
    expect(matchesFilter(f, "at", v, "2025-05-15T08:00:00")).toBe(true);
    expect(matchesFilter(f, "at", v, "2025-06-01T08:00:00")).toBe(false);
  });
});
