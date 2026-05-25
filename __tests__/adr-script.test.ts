import { describe, expect, it } from "vitest";
import { formatAdrFilename, slugifyAdrTitle } from "../skills/adr/scripts/adr";

describe("ADR skill helper script", () => {
  it("slugifies titles with adr-tools-compatible rules", () => {
    expect(slugifyAdrTitle("Something About Node.JS")).toBe(
      "something-about-node-js",
    );
    expect(slugifyAdrTitle("Slash/Slash/Slash/")).toBe("slash-slash-slash");
    expect(slugifyAdrTitle('"-Bar-"')).toBe("bar");
  });

  it("formats zero-padded ADR filenames", () => {
    expect(formatAdrFilename(1, "Record architecture decisions")).toBe(
      "0001-record-architecture-decisions.md",
    );
  });

  it("rejects invalid ADR numbers", () => {
    expect(() => formatAdrFilename(0, "Invalid")).toThrow("positive integer");
  });
});
