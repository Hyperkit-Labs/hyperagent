"use client";

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  className?: string;
}

export function Card({ children, hover, className = "" }: CardProps) {
  return (
    <div
      className={`glass-panel rounded-xl p-5 ${hover ? "glass-panel-hover transition-transform hover:translate-y-[-2px]" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
