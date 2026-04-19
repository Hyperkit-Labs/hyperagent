"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface LogoCarouselItem {
  id: string;
  name: string;
  content: ReactNode;
}

function distributeLogos(
  allLogos: LogoCarouselItem[],
  columnCount: number,
): LogoCarouselItem[][] {
  const columns: LogoCarouselItem[][] = Array.from(
    { length: columnCount },
    () => [],
  );

  allLogos.forEach((logo, index) => {
    columns[index % columnCount].push(logo);
  });

  const maxLength = Math.max(...columns.map((col) => col.length), 0);
  columns.forEach((col) => {
    if (maxLength === 0) return;
    let i = 0;
    while (col.length < maxLength) {
      col.push(allLogos[i % allLogos.length]);
      i++;
    }
  });

  return columns;
}

interface LogoColumnProps {
  logos: LogoCarouselItem[];
  index: number;
  currentTime: number;
  columnClassName?: string;
}

const LogoColumn: React.FC<LogoColumnProps> = React.memo(
  ({ logos, index, currentTime, columnClassName }) => {
    const cycleInterval = 2000;
    const columnDelay = index * 200;
    const adjustedTime =
      (currentTime + columnDelay) % (cycleInterval * logos.length);
    const currentIndex = Math.floor(adjustedTime / cycleInterval);

    const slide = useMemo(() => logos[currentIndex], [logos, currentIndex]);

    return (
      <motion.div
        className={
          columnClassName ??
          "relative h-14 w-24 overflow-hidden md:h-24 md:w-48"
        }
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.1,
          duration: 0.5,
          ease: "easeOut",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${slide.id}-${currentIndex}`}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ y: "10%", opacity: 0, filter: "blur(8px)" }}
            animate={{
              y: "0%",
              opacity: 1,
              filter: "blur(0px)",
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 20,
                mass: 1,
                bounce: 0.2,
                duration: 0.5,
              },
            }}
            exit={{
              y: "-20%",
              opacity: 0,
              filter: "blur(6px)",
              transition: {
                type: "tween",
                ease: "easeIn",
                duration: 0.3,
              },
            }}
          >
            {slide.content}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  },
);

LogoColumn.displayName = "LogoColumn";

export interface LogoCarouselProps {
  items: LogoCarouselItem[];
  columnCount?: number;
  className?: string;
  columnClassName?: string;
}

export function LogoCarousel({
  items,
  columnCount = 2,
  className = "",
  columnClassName,
}: LogoCarouselProps) {
  const logoSets = useMemo(() => {
    if (items.length === 0) return [];
    return distributeLogos(items, Math.max(1, columnCount));
  }, [items, columnCount]);

  const [currentTime, setCurrentTime] = useState(0);

  const tick = useCallback(() => {
    setCurrentTime((t) => t + 100);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(tick, 100);
    return () => clearInterval(intervalId);
  }, [tick]);

  if (items.length === 0 || logoSets.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {logoSets.map((logos, index) => (
          <LogoColumn
            key={index}
            columnClassName={columnClassName}
            currentTime={currentTime}
            index={index}
            logos={logos}
          />
        ))}
      </div>
    </div>
  );
}
