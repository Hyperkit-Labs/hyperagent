import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Zustand store with a stable devtools name. Use for real global client state only;
 * prefer URL and TanStack Query for server state.
 */
export function createGlobalStore<T extends object>(
  name: string,
  initializer: StateCreator<T, [], []>
) {
  const isDev =
    typeof process !== "undefined" && process.env.NODE_ENV === "development";
  return create<T>()(
    devtools(initializer, {
      name,
      enabled: isDev,
    })
  );
}
