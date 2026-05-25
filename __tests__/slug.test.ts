import { describe, expect, it } from "vitest";
import {
  formatAdrFilename,
  slugifyAdrTitle,
} from "../skills/adr/scripts/lib/slug";

describe("ADR slug helpers", () => {
  it("slugifies titles with adr-tools-compatible rules", () => {
    expect(slugifyAdrTitle("Something About Node.JS")).toBe(
      "something-about-node-js",
    );
    expect(slugifyAdrTitle("Slash/Slash/Slash/")).toBe("slash-slash-slash");
    expect(slugifyAdrTitle('"-Bar-"')).toBe("bar");
  });

  it("falls back when a title has no alphanumeric characters", () => {
    expect(slugifyAdrTitle("---")).toBe("adr");
  });

  it("formats zero-padded ADR filenames", () => {
    expect(formatAdrFilename(1, "Record architecture decisions")).toBe(
      "0001-record-architecture-decisions.md",
    );
    expect(formatAdrFilename(42, "Something About Node.JS")).toBe(
      "0042-something-about-node-js.md",
    );
  });

  it("rejects invalid ADR numbers", () => {
    expect(() => formatAdrFilename(0, "Invalid")).toThrow("positive integer");
    expect(() => formatAdrFilename(1.5, "Invalid")).toThrow("positive integer");
  });
});
