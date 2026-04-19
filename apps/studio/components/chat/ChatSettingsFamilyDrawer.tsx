"use client";

import Link from "next/link";
import { ArrowLeft, Key, Settings2 } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { LLMKeysCard } from "@/components/settings/LLMKeysCard";
import {
  FamilyDrawerRoot,
  FamilyDrawerPortal,
  FamilyDrawerOverlay,
  FamilyDrawerContent,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerAnimatedContent,
  FamilyDrawerClose,
  FamilyDrawerHeader,
  FamilyDrawerButton,
  FamilyDrawerViewContent,
  useFamilyDrawer,
  type ViewsRegistry,
} from "@/components/cult-ui/FamilyDrawer";

function ChatKeysView() {
  const { setView } = useFamilyDrawer();

  return (
    <>
      <FamilyDrawerHeader
        description="Encrypted for your workspace. Required before the chat model can run."
        icon={<Key className="h-10 w-10 text-[var(--color-primary-light)]" />}
        title="API keys for chat"
      />
      <div className="mt-5 max-h-[50vh] overflow-y-auto pr-1">
        <LLMKeysCard />
      </div>
      <div className="mt-4">
        <FamilyDrawerButton onClick={() => setView("more")}>
          <Settings2 className="h-5 w-5 shrink-0" />
          More settings
        </FamilyDrawerButton>
      </div>
    </>
  );
}

function ChatMoreSettingsView() {
  const { setView } = useFamilyDrawer();

  return (
    <>
      <FamilyDrawerHeader
        description="Workspace, billing, integrations, and network defaults live in the full Settings area."
        icon={
          <Settings2 className="h-10 w-10 text-[var(--color-primary-light)]" />
        }
        title="Go further"
      />
      <div className="mt-6 space-y-3">
        <FamilyDrawerButton onClick={() => setView("default")}>
          <ArrowLeft className="h-5 w-5 shrink-0" />
          Back to API keys
        </FamilyDrawerButton>
        <Link
          className="flex h-12 w-full items-center justify-center rounded-[16px] border border-[var(--color-border-subtle)] text-[15px] font-medium text-[var(--color-primary-light)] transition-colors hover:bg-[var(--color-bg-elevated)]"
          href={ROUTES.SETTINGS}
        >
          Open full Settings
        </Link>
      </div>
    </>
  );
}

const chatSettingsViews: ViewsRegistry = {
  default: ChatKeysView,
  more: ChatMoreSettingsView,
};

export function ChatSettingsFamilyDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FamilyDrawerRoot
      defaultView="default"
      onOpenChange={onOpenChange}
      open={open}
      views={chatSettingsViews}
    >
      <FamilyDrawerPortal>
        <FamilyDrawerOverlay />
        <FamilyDrawerContent className="border border-[var(--color-border-subtle)] shadow-2xl">
          <FamilyDrawerClose className="text-[var(--color-text-muted)]" />
          <FamilyDrawerAnimatedWrapper>
            <FamilyDrawerAnimatedContent>
              <FamilyDrawerViewContent />
            </FamilyDrawerAnimatedContent>
          </FamilyDrawerAnimatedWrapper>
        </FamilyDrawerContent>
      </FamilyDrawerPortal>
    </FamilyDrawerRoot>
  );
}
