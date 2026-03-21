/**
 * Unit tests: login redirect targets — no nested /login?next= loops.
 */

import { getLoginRedirectHref } from "@/lib/authRedirect";
import { ROUTES } from "@/constants/routes";

describe("authRedirect", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("returns plain /login when pathname is already /login (strips nested next)", () => {
    Object.defineProperty(window, "location", {
      value: {
        pathname: ROUTES.LOGIN,
        search: "?next=%2F",
      },
      writable: true,
      configurable: true,
    });
    expect(getLoginRedirectHref()).toBe(ROUTES.LOGIN);
  });

  it("includes encoded next for protected paths", () => {
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/",
        search: "",
      },
      writable: true,
      configurable: true,
    });
    expect(getLoginRedirectHref()).toBe(`${ROUTES.LOGIN}?next=%2F`);
  });
});
