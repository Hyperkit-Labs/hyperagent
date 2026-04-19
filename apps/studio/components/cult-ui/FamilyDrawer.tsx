"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import useMeasure from "react-use-measure";
import { Drawer } from "vaul";

type ViewComponent = React.ComponentType<Record<string, unknown>>;

export interface ViewsRegistry {
  [viewName: string]: ViewComponent;
}

interface FamilyDrawerContextValue {
  isOpen: boolean;
  view: string;
  setView: (view: string) => void;
  opacityDuration: number;
  elementRef: ReturnType<typeof useMeasure>[0];
  bounds: ReturnType<typeof useMeasure>[1];
  views: ViewsRegistry | undefined;
}

const FamilyDrawerContext = createContext<FamilyDrawerContextValue | undefined>(
  undefined,
);

export function useFamilyDrawer() {
  const context = useContext(FamilyDrawerContext);
  if (!context) {
    throw new Error(
      "FamilyDrawer components must be used within FamilyDrawerRoot",
    );
  }
  return context;
}

interface FamilyDrawerRootProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultView?: string;
  onViewChange?: (view: string) => void;
  views?: ViewsRegistry;
}

function FamilyDrawerRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  defaultView = "default",
  onViewChange,
  views: customViews,
}: FamilyDrawerRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [view, setViewState] = useState(defaultView);
  const [elementRef, bounds] = useMeasure();
  const previousHeightRef = useRef<number | null>(null);
  const [opacityDuration, setOpacityDuration] = useState(0.15);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const currentHeight = bounds.height;
    const MIN_DURATION = 0.15;
    const MAX_DURATION = 0.27;

    if (previousHeightRef.current === null) {
      previousHeightRef.current = currentHeight;
      return;
    }

    const heightDifference = Math.abs(
      currentHeight - previousHeightRef.current,
    );
    previousHeightRef.current = currentHeight;

    setOpacityDuration(
      Math.min(Math.max(heightDifference / 500, MIN_DURATION), MAX_DURATION),
    );
  }, [bounds.height]);

  const handleViewChange = (newView: string) => {
    setViewState(newView);
    onViewChange?.(newView);
  };

  const views =
    customViews && Object.keys(customViews).length > 0
      ? customViews
      : undefined;

  const contextValue: FamilyDrawerContextValue = {
    isOpen,
    view,
    setView: handleViewChange,
    opacityDuration,
    elementRef,
    bounds,
    views,
  };

  return (
    <FamilyDrawerContext.Provider value={contextValue}>
      <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
        {children}
      </Drawer.Root>
    </FamilyDrawerContext.Provider>
  );
}

interface FamilyDrawerTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
}

function FamilyDrawerTrigger({
  children,
  asChild = false,
  className,
}: FamilyDrawerTriggerProps) {
  if (asChild) {
    return (
      <Drawer.Trigger asChild>
        <Slot>{children}</Slot>
      </Drawer.Trigger>
    );
  }

  return (
    <Drawer.Trigger asChild>
      <button
        className={clsx(
          "fixed top-1/2 left-1/2 h-[44px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-4 py-2 font-medium text-[var(--color-text-primary)] antialiased transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none md:font-medium",
          className,
        )}
        type="button"
      >
        {children}
      </button>
    </Drawer.Trigger>
  );
}

function FamilyDrawerPortal({ children }: { children: ReactNode }) {
  return <Drawer.Portal>{children}</Drawer.Portal>;
}

interface FamilyDrawerOverlayProps {
  className?: string;
  onClick?: () => void;
}

function FamilyDrawerOverlay({ className, onClick }: FamilyDrawerOverlayProps) {
  return (
    <Drawer.Overlay
      className={clsx("fixed inset-0 z-[100] bg-black/60", className)}
      onClick={onClick}
    />
  );
}

interface FamilyDrawerContentProps {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

function FamilyDrawerContent({
  children,
  className,
  asChild = false,
}: FamilyDrawerContentProps) {
  const { bounds } = useFamilyDrawer();

  const content = (
    <motion.div
      animate={{
        height: bounds.height,
        transition: {
          duration: 0.27,
          ease: [0.25, 1, 0.5, 1],
        },
      }}
    >
      {children}
    </motion.div>
  );

  const panelClass = clsx(
    "fixed inset-x-4 bottom-4 z-[101] mx-auto max-h-[85vh] max-w-lg overflow-hidden rounded-[28px] bg-[var(--color-bg-panel)] outline-none md:mx-auto md:w-full",
    className,
  );

  if (asChild) {
    return (
      <Drawer.Content asChild className={panelClass}>
        <Slot>{content}</Slot>
      </Drawer.Content>
    );
  }

  return (
    <Drawer.Content asChild className={panelClass}>
      {content}
    </Drawer.Content>
  );
}

interface FamilyDrawerAnimatedWrapperProps {
  children: ReactNode;
  className?: string;
}

function FamilyDrawerAnimatedWrapper({
  children,
  className,
}: FamilyDrawerAnimatedWrapperProps) {
  const { elementRef } = useFamilyDrawer();

  return (
    <div
      ref={elementRef}
      className={clsx("px-6 pt-2.5 pb-6 antialiased", className)}
    >
      {children}
    </div>
  );
}

interface FamilyDrawerAnimatedContentProps {
  children: ReactNode;
}

function FamilyDrawerAnimatedContent({
  children,
}: FamilyDrawerAnimatedContentProps) {
  const { view, opacityDuration } = useFamilyDrawer();

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        key={view}
        transition={{
          duration: opacityDuration,
          ease: [0.26, 0.08, 0.25, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface FamilyDrawerCloseProps {
  children?: ReactNode;
  asChild?: boolean;
  className?: string;
}

function FamilyDrawerClose({
  children,
  asChild = false,
  className,
}: FamilyDrawerCloseProps) {
  const defaultClose = (
    <button
      data-vaul-no-drag=""
      className={clsx(
        "absolute top-7 right-8 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-transform focus:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none active:scale-75",
        className,
      )}
      type="button"
    >
      {children || <CloseIcon />}
    </button>
  );

  if (asChild) {
    return (
      <Drawer.Close asChild>
        <Slot>{defaultClose}</Slot>
      </Drawer.Close>
    );
  }

  return <Drawer.Close asChild>{defaultClose}</Drawer.Close>;
}

interface FamilyDrawerHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

function FamilyDrawerHeader({
  icon,
  title,
  description,
  className,
}: FamilyDrawerHeaderProps) {
  return (
    <header className={clsx("mt-[21px]", className)}>
      {icon}
      <h2 className="mt-2.5 text-[22px] font-semibold text-[var(--color-text-primary)] md:font-medium">
        {title}
      </h2>
      <p className="mt-3 text-[17px] leading-[24px] font-medium text-[var(--color-text-muted)] md:font-normal">
        {description}
      </p>
    </header>
  );
}

interface FamilyDrawerButtonProps {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  asChild?: boolean;
}

function FamilyDrawerButton({
  children,
  onClick,
  className,
  asChild = false,
}: FamilyDrawerButtonProps) {
  const button = (
    <button
      data-vaul-no-drag=""
      className={clsx(
        "flex h-12 w-full cursor-pointer items-center gap-[15px] rounded-[16px] bg-[var(--color-bg-elevated)] px-4 text-left text-[17px] font-semibold text-[var(--color-text-primary)] transition-transform focus:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none active:scale-95 md:font-medium",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );

  if (asChild) {
    return <Slot>{button}</Slot>;
  }

  return button;
}

interface FamilyDrawerSecondaryButtonProps {
  children: ReactNode;
  onClick: () => void;
  className: string;
  asChild?: boolean;
}

function FamilyDrawerSecondaryButton({
  children,
  onClick,
  className,
  asChild = false,
}: FamilyDrawerSecondaryButtonProps) {
  const button = (
    <button
      data-vaul-no-drag=""
      type="button"
      className={clsx(
        "flex h-12 w-full cursor-pointer items-center justify-center gap-[15px] rounded-full text-center text-[19px] font-semibold transition-transform focus:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none active:scale-95 md:font-medium",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );

  if (asChild) {
    return <Slot>{button}</Slot>;
  }

  return button;
}

interface FamilyDrawerViewContentProps {
  views?: ViewsRegistry;
}

function FamilyDrawerViewContent(
  {
    views: propViews,
  }: FamilyDrawerViewContentProps = {} as FamilyDrawerViewContentProps,
) {
  const { view, views: contextViews } = useFamilyDrawer();

  const views = propViews || contextViews;

  if (!views) {
    throw new Error(
      "FamilyDrawerViewContent requires views to be provided via props or FamilyDrawerRoot",
    );
  }

  const ViewComponent = views[view];

  if (!ViewComponent) {
    const DefaultComponent = views.default;
    return DefaultComponent ? <DefaultComponent /> : null;
  }

  return <ViewComponent />;
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.4854 1.99998L2.00007 10.4853"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4854 10.4844L2.00007 1.99908"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export {
  FamilyDrawerRoot,
  FamilyDrawerTrigger,
  FamilyDrawerPortal,
  FamilyDrawerOverlay,
  FamilyDrawerContent,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerAnimatedContent,
  FamilyDrawerClose,
  FamilyDrawerHeader,
  FamilyDrawerButton,
  FamilyDrawerSecondaryButton,
  FamilyDrawerViewContent,
  type ViewComponent,
};
