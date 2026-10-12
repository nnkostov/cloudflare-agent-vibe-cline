import { describe, it, expect } from "vitest";
import { decodeBase64Utf8 } from "./github";

const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe("decodeBase64Utf8", () => {
  it("decodes ASCII", () => {
    expect(decodeBase64Utf8(encode("# Hello"))).toBe("# Hello");
  });

  it("decodes multi-byte UTF-8 without garbling", () => {
    const readme = "# 大语言模型 — fast inference 🚀";
    expect(decodeBase64Utf8(encode(readme))).toBe(readme);
  });
});
