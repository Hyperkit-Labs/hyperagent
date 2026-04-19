"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SmoothTabItem {
  id: string;
  title: string;
  /** Compact label for the tab strip when space is tight; full `title` is still used for `title` + a11y */
  tabLabel?: string;
  cardContent: React.ReactNode;
  /** Tailwind background classes for the sliding indicator (e.g. bg-violet-600) */
  color: string;
}

export interface SmoothTabProps {
  items: SmoothTabItem[];
  defaultTabId?: string;
  className?: string;
  contentClassName?: string;
  /** Merged onto the tab panel wrapper (default min-height) */
  contentPanelClassName?: string;
  onChange?: (tabId: string) => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    position: "absolute" as const,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
};

const transition = {
  duration: 0.4,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

export function SmoothTab({
  items,
  defaultTabId,
  className,
  contentClassName,
  contentPanelClassName,
  onChange,
}: SmoothTabProps) {
  const firstId = items[0]?.id ?? "";
  const [selected, setSelected] = React.useState<string>(
    defaultTabId ?? firstId,
  );
  const [direction, setDirection] = React.useState(0);
  const [dimensions, setDimensions] = React.useState({ width: 0, left: 0 });

  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(selected);
      const container = containerRef.current;

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    requestAnimationFrame(() => {
      updateDimensions();
    });

    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [selected]);

  const handleTabClick = (tabId: string) => {
    const currentIndex = items.findIndex((item) => item.id === selected);
    const newIndex = items.findIndex((item) => item.id === tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setSelected(tabId);
    onChange?.(tabId);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabId: string,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTabClick(tabId);
    }
  };

  const selectedItem = items.find((item) => item.id === selected);
  const n = items.length;

  if (!items.length) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn("relative mb-4 flex-1", contentClassName)}>
        <div
          className={cn(
            "relative min-h-[256px] w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/40",
            contentPanelClassName,
          )}
        >
          <div className="absolute inset-0 overflow-hidden rounded-xl overscroll-none">
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="popLayout"
            >
              <motion.div
                animate="center"
                className="absolute inset-0 h-full min-h-0 w-full overflow-hidden will-change-transform"
                custom={direction}
                exit="exit"
                initial="enter"
                key={`card-${selected}`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
                transition={transition}
                variants={slideVariants}
              >
                {selectedItem?.cardContent}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div
        aria-label="Tabs"
        className={cn(
          "relative mx-auto mt-auto w-full max-w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 py-1",
          className,
        )}
        ref={containerRef}
        role="tablist"
      >
        <motion.div
          animate={{
            width: Math.max(dimensions.width - 8, 0),
            x: dimensions.left + 4,
            opacity: 1,
          }}
          className={cn(
            "absolute z-[1] rounded-lg",
            selectedItem?.color ?? "bg-violet-600",
          )}
          initial={false}
          style={{ height: "calc(100% - 8px)", top: "4px" }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        />

        <div
          className="relative z-[2] grid w-full min-w-0 gap-0.5 sm:gap-1"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item) => {
            const isSelected = selected === item.id;
            const stripLabel = item.tabLabel ?? item.title;
            return (
              <motion.button
                aria-controls={`panel-${item.id}`}
                aria-label={item.title}
                aria-selected={isSelected}
                className={cn(
                  "relative flex min-w-0 items-center justify-center rounded-lg px-1 py-1.5 sm:px-1.5",
                  "text-center text-[11px] font-medium leading-tight transition-all duration-300 sm:text-xs",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                  isSelected
                    ? "text-white"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]/80 hover:text-[var(--color-text-primary)]",
                )}
                id={`tab-${item.id}`}
                key={item.id}
                title={item.title}
                onClick={() => handleTabClick(item.id)}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                ref={(el) => {
                  if (el) buttonRefs.current.set(item.id, el);
                  else buttonRefs.current.delete(item.id);
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                <span className="min-w-0 whitespace-nowrap">{stripLabel}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
