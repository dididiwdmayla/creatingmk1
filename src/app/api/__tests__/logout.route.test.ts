import { describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth";
import { POST } from "../logout/route";

describe("POST /api/logout", () => {
  it("limpa o cookie de sessão", async () => {
    const res = await POST();

    expect(res.status).toBe(204);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/Max-Age=0/);
  });
});
