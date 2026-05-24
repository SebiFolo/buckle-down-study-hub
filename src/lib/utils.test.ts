import { describe, it, expect } from "vitest";
import { stripMarkup } from "./utils";

describe("stripMarkup", () => {
  it("returns empty string for null", () => {
    expect(stripMarkup(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(stripMarkup(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(stripMarkup("")).toBe("");
  });

  it("leaves plain text unchanged", () => {
    expect(stripMarkup("hello world")).toBe("hello world");
  });

  it("removes heading hashes", () => {
    expect(stripMarkup("# Hello")).toBe("Hello");
  });

  it("removes bold asterisks", () => {
    expect(stripMarkup("**bold**")).toBe("bold");
  });

  it("removes italic underscores", () => {
    expect(stripMarkup("_italic_")).toBe("italic");
  });

  it("removes blockquote chevron", () => {
    expect(stripMarkup("> quote")).toBe("quote");
  });

  it("removes backticks", () => {
    expect(stripMarkup("`code`")).toBe("code");
  });

  it("removes link brackets and parens", () => {
    expect(stripMarkup("[link](url)")).toBe("linkurl");
  });

  it("collapses multiple spaces into one", () => {
    expect(stripMarkup("hello   world")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripMarkup("  hello  ")).toBe("hello");
  });

  it("handles a realistic markdown snippet", () => {
    expect(stripMarkup("## Summary\n**Key point**: hello world")).toBe(
      "Summary\nKey point: hello world",
    );
  });
});
