"use client";

import { Shimmer } from "@/components/ai-elements";
import { BentoCard, BentoGrid } from "@/components/ui";

/** Skeleton for the workspace tab card body (matches loaded `WorkspaceTab` layout). */
export function WorkspaceTabSkeleton() {
  return (
    <div
      className="space-y-4 py-1"
      role="status"
      aria-busy="true"
      aria-label="Loading workspace settings"
    >
      <span className="sr-only">Loading workspace settings</span>
      <div className="flex items-center gap-2 flex-wrap">
        <Shimmer height="h-3" width="w-14" rounded="sm" />
        <Shimmer height="h-5" width="w-[7.5rem]" rounded="full" />
        <Shimmer height="h-5" width="w-20" rounded="full" />
        <Shimmer
          height="h-5"
          width="w-40"
          rounded="full"
          className="ml-auto max-w-[min(100%,12rem)]"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 text-sm">
        <div className="space-y-4">
          <div>
            <Shimmer height="h-3" width="w-28" rounded="sm" className="mb-2" />
            <Shimmer height="h-10" width="w-full" rounded="lg" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Shimmer height="h-3" width="w-16" rounded="sm" />
            <Shimmer height="h-3" width="w-8" rounded="sm" />
            <Shimmer height="h-3" width="w-20" rounded="sm" />
            <Shimmer height="h-3" width="w-8" rounded="sm" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Shimmer height="h-3" width="w-32" rounded="sm" />
            <Shimmer height="h-3" width="w-28" rounded="sm" />
          </div>
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] max-h-40 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 border-b border-[var(--color-border-subtle)] last:border-0"
              >
                <Shimmer height="h-3" width="w-28" rounded="sm" />
                <Shimmer height="h-3" width="w-24" rounded="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full Settings page shell while auth bootstrap or config is pending (`RequireApiSession`). */
export function SettingsBootstrapSkeleton() {
  return (
    <div
      className="p-6 lg:p-8"
      role="status"
      aria-busy="true"
      aria-label="Loading workspace settings"
    >
      <span className="sr-only">
        Loading workspace settings. First load after deploy can take up to a
        minute if the API is warming up.
      </span>
      <div className="max-w-6xl mx-auto animate-enter">
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2">
            <Shimmer
              height="h-5"
              width="w-5"
              rounded="md"
              className="shrink-0"
            />
            <div className="space-y-2 min-w-0 flex-1">
              <Shimmer height="h-7" width="w-36" rounded="md" />
              <Shimmer height="h-4" width="w-full max-w-md" rounded="sm" />
            </div>
          </div>

          <BentoGrid className="lg:gap-3">
            {[0, 1, 2, 3].map((i) => (
              <BentoCard key={i} className="!p-0">
                <div className="p-4 space-y-2 h-full min-h-[5.5rem]">
                  <Shimmer height="h-4" width="w-4" rounded="md" />
                  <Shimmer height="h-4" width="w-24" rounded="sm" />
                  <Shimmer height="h-3" width="w-32" rounded="sm" />
                </div>
              </BentoCard>
            ))}
            <BentoCard colSpan={2} className="!p-0">
              <div className="p-4 space-y-2 min-h-[5.5rem]">
                <Shimmer height="h-4" width="w-4" rounded="md" />
                <Shimmer height="h-4" width="w-28" rounded="sm" />
                <Shimmer height="h-3" width="w-52 max-w-full" rounded="sm" />
              </div>
            </BentoCard>
          </BentoGrid>

          <Shimmer
            height="h-px"
            width="w-full"
            rounded="none"
            className="opacity-50"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {[0, 1, 2, 3, 4].map((i) => (
                <Shimmer
                  key={i}
                  height="h-[3.25rem]"
                  width="w-full"
                  rounded="lg"
                  className="min-w-[10rem] md:min-w-0"
                />
              ))}
            </nav>
          </aside>
          <main className="flex-1 min-w-0 space-y-6">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] backdrop-blur-md p-4">
              <WorkspaceTabSkeleton />
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] text-center md:text-left">
              First load after deploy can take up to a minute if the API is
              warming up.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

/** Minimal shell while session is not ready yet (before bootstrap). */
export function SessionPrepSkeleton() {
  return (
    <div className="p-6 lg:p-8 min-h-[60vh] flex flex-col items-center justify-center">
      <div
        className="w-full max-w-sm space-y-4"
        role="status"
        aria-busy="true"
        aria-label="Preparing your session"
      >
        <span className="sr-only">Preparing your session</span>
        <Shimmer
          height="h-10"
          width="w-3/4"
          rounded="lg"
          className="mx-auto max-w-xs"
        />
        <Shimmer height="h-3" width="w-full" rounded="sm" />
        <Shimmer
          height="h-3"
          width="w-5/6"
          rounded="sm"
          className="mx-auto max-w-md"
        />
      </div>
    </div>
  );
}

/** Non-settings routes: avoid showing the Settings chrome during bootstrap. */
export function GenericBootstrapSkeleton() {
  return (
    <div
      className="p-6 lg:p-8 min-h-[50vh]"
      role="status"
      aria-busy="true"
      aria-label="Loading application"
    >
      <span className="sr-only">
        Loading. First load after deploy can take up to a minute if the API is
        warming up.
      </span>
      <div className="max-w-4xl mx-auto space-y-6">
        <Shimmer height="h-9" width="w-56" rounded="lg" />
        <div className="glass-panel rounded-xl p-6 space-y-3">
          <Shimmer height="h-4" width="w-full" rounded="sm" />
          <Shimmer
            height="h-4"
            width="w-full"
            rounded="sm"
            className="max-w-2xl"
          />
          <Shimmer
            height="h-4"
            width="w-full"
            rounded="sm"
            className="max-w-xl"
          />
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          First load after deploy can take up to a minute if the API is warming
          up.
        </p>
      </div>
    </div>
  );
}
