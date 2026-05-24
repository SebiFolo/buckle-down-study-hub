import { describe, it, expect } from "vitest";
import { signupSchema } from "./auth-schema";

const valid = {
  username: "buck_user1",
  email: "buck@example.com",
  password: "Secure1!",
};

function messages(input: object): string[] {
  const result = signupSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => i.message);
}

describe("signupSchema — username", () => {
  it("accepts a valid username", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects username shorter than 3 characters", () => {
    expect(messages({ ...valid, username: "ab" })).toContain(
      "Username must be at least 3 characters",
    );
  });

  it("rejects username longer than 30 characters", () => {
    expect(messages({ ...valid, username: "a".repeat(31) })).not.toHaveLength(0);
  });

  it("rejects username with special characters", () => {
    expect(messages({ ...valid, username: "bad name!" })).toContain(
      "Letters, numbers, underscore only",
    );
  });

  it("accepts username with underscores and numbers", () => {
    expect(signupSchema.safeParse({ ...valid, username: "buck_42" }).success).toBe(true);
  });
});

describe("signupSchema — email", () => {
  it("rejects an invalid email", () => {
    expect(messages({ ...valid, email: "notanemail" })).toContain("Invalid email");
  });

  it("accepts a valid email", () => {
    expect(signupSchema.safeParse({ ...valid, email: "user@test.com" }).success).toBe(true);
  });
});

describe("signupSchema — password", () => {
  it("rejects password shorter than 8 characters", () => {
    expect(messages({ ...valid, password: "Sh0rt!" })).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects password longer than 72 characters", () => {
    expect(messages({ ...valid, password: "Aa1!" + "a".repeat(70) })).toContain(
      "Password must be at most 72 characters",
    );
  });

  it("rejects password with no uppercase letter", () => {
    expect(messages({ ...valid, password: "secure1!" })).toContain(
      "Password must contain at least one uppercase letter",
    );
  });

  it("rejects password with no lowercase letter", () => {
    expect(messages({ ...valid, password: "SECURE1!" })).toContain(
      "Password must contain at least one lowercase letter",
    );
  });

  it("rejects password with no number", () => {
    expect(messages({ ...valid, password: "Secure!!" })).toContain(
      "Password must contain at least one number",
    );
  });

  it("rejects password with no special character", () => {
    expect(messages({ ...valid, password: "Secure123" })).toContain(
      "Password must contain at least one special character",
    );
  });

  it("accepts a password that is exactly 8 characters", () => {
    expect(signupSchema.safeParse({ ...valid, password: "Secure1!" }).success).toBe(true);
  });

  it("accepts a password that is exactly 72 characters", () => {
    expect(
      signupSchema.safeParse({ ...valid, password: "Aa1!" + "a".repeat(68) }).success,
    ).toBe(true);
  });
});
