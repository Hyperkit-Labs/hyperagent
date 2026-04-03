/**
 * Unit tests: login redirect targets -- no nested /login?next= loops.
 */

import { getLoginRedirectHref } from "@/lib/authRedirect";
import { ROUTES } from "@/constants/routes";

describe("authRedirect", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("returns plain /login when pathname is already /login (strips nested next)", () => {
    window.history.pushState({}, "", `${ROUTES.LOGIN}?next=%2F`);
    expect(getLoginRedirectHref()).toBe(ROUTES.LOGIN);
  });

  it("includes encoded next for protected paths", () => {
    window.history.pushState({}, "", "/");
    expect(getLoginRedirectHref()).toBe(`${ROUTES.LOGIN}?next=%2F`);
  });
});
