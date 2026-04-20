"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { SessionGate } from "@/components/auth/SessionGate";
import { useTrackRecord } from "@/hooks/useTrackRecord";
import { LiquidGlass, SpotlightCard } from "@/components/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BorderGlow } from "@/components/ui/react-bits/BorderGlow";
import { Counter } from "@/components/ui/react-bits/Counter";
import { SmoothTab } from "@/components/ui/SmoothTab";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TrackRecordItem = {
  label: string;
  value: number;
  prefix: string;
  suffix: string;
  desc: string;
};

const AUDIT_CHART_CONFIG = {
  score: {
    label: "Relative coverage",
    color: "var(--color-primary-mid)",
  },
} satisfies ChartConfig;

const VULN_CHART_CONFIG = {
  score: {
    label: "Finding intensity",
    color: "var(--color-semantic-error)",
  },
} satisfies ChartConfig;

function auditRadarRows(value: number) {
  const cap = 500;
  const pct =
    value <= 0
      ? 6
      : Math.min(100, Math.round((value / Math.max(cap, value)) * 100));
  const j = (d: number) => Math.max(4, Math.min(100, pct + d));
  /* Short axis labels so ticks stay readable in a small polar chart */
  return [
    { axis: "Scope", score: j(0) },
    { axis: "Depth", score: j(9) },
    { axis: "Auto", score: j(-7) },
    { axis: "Report", score: j(5) },
    { axis: "Follow", score: j(-5) },
  ];
}

function vulnerabilityRadialRow(value: number) {
  const cap = 320;
  const score =
    value <= 0
      ? 3
      : Math.min(100, Math.round((value / Math.max(cap, value)) * 100));
  return [{ name: "findings", score }];
}

const trackRecordChartBoxClassName =
  "mx-auto aspect-square h-[108px] w-[108px] max-h-[108px] max-w-[108px] shrink-0 sm:h-[118px] sm:w-[118px] sm:max-h-[118px] sm:max-w-[118px]";

function TrackRecordMetricVisual({ item }: { item: TrackRecordItem }) {
  const n = typeof item.value === "number" ? item.value : 0;

  const counterBlock = (
    <p className="flex flex-wrap items-baseline justify-center gap-0.5 text-[var(--color-text-primary)]">
      {item.prefix ? (
        <span className="text-3xl font-bold tracking-tight">{item.prefix}</span>
      ) : null}
      <Counter
        borderRadius={0}
        fontSize={30}
        fontWeight={700}
        gap={4}
        gradientFrom="var(--color-bg-panel)"
        gradientHeight={10}
        gradientTo="transparent"
        horizontalPadding={0}
        textColor="var(--color-text-primary)"
        value={n}
      />
      {item.suffix ? (
        <span className="text-3xl font-bold tracking-tight">{item.suffix}</span>
      ) : null}
    </p>
  );

  const descBlock = (
    <p className="mt-1 pb-0.5 text-center text-sm leading-snug text-pretty text-[var(--color-text-muted)]">
      {item.desc}
    </p>
  );

  if (item.label === "Audits") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-1 py-1">
        <ChartContainer
          config={AUDIT_CHART_CONFIG}
          className={`${trackRecordChartBoxClassName} [&_.recharts-polar-angle-axis-tick_text]:fill-[var(--color-text-muted)]`}
        >
          <RadarChart
            data={auditRadarRows(n)}
            cx="50%"
            cy="50%"
            outerRadius="56%"
            margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarGrid />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 9 }}
              tickLine={false}
            />
            <Radar
              name="score"
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.55}
              stroke="var(--color-score)"
              strokeWidth={1}
            />
          </RadarChart>
        </ChartContainer>
        <div className="w-full min-w-0">
          {counterBlock}
          {descBlock}
        </div>
      </div>
    );
  }

  if (item.label === "Vulnerabilities") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-0.5 py-1">
        <ChartContainer
          config={VULN_CHART_CONFIG}
          className={trackRecordChartBoxClassName}
        >
          <RadialBarChart
            data={vulnerabilityRadialRow(n)}
            innerRadius={28}
            outerRadius={50}
            startAngle={90}
            endAngle={-270}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <RadialBar
              dataKey="score"
              background={{ fill: "var(--color-bg-surface)" }}
              cornerRadius={6}
              fill="var(--color-score)"
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="w-full min-w-0">
          {counterBlock}
          {descBlock}
        </div>
      </div>
    );
  }

  const tooltipBody =
    item.label === "Users"
      ? "Confirmed beta testers on the waitlist (verified email and wallet). The count refreshes while this page is open."
      : "Smart contracts deployed through Hyperkit, including publishes tracked after successful pipeline runs.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-full min-h-0 cursor-default flex-col items-center justify-center px-0.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-alpha-40)]">
          {counterBlock}
          {descBlock}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[240px] text-[var(--color-text-secondary)]"
      >
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  );
}

const TRACK_TAB_COLORS = [
  "bg-violet-600",
  "bg-indigo-600",
  "bg-fuchsia-600",
  "bg-teal-600",
] as const;

const BORDER_GLOW_COLORS = ["#a78bfa", "#818cf8", "#c4b5fd"] as const;

/** Short tab strip labels so four tabs fit without truncation in narrow cards */
const TRACK_TAB_STRIP_LABEL: Record<string, string> = {
  Users: "Users",
  Audits: "Audits",
  Vulnerabilities: "Vulns",
  Deployments: "Deploy",
};

export function LoginAuthPanel() {
  const { trackRecord } = useTrackRecord();

  const trackTabs = trackRecord.map((item, i) => ({
    id: item.label,
    title: item.label,
    tabLabel: TRACK_TAB_STRIP_LABEL[item.label] ?? item.label,
    color: TRACK_TAB_COLORS[i % TRACK_TAB_COLORS.length],
    cardContent: (
      <BorderGlow
        className="h-full min-h-0 w-full border-[var(--color-border-subtle)]"
        backgroundColor="var(--color-bg-panel)"
        borderRadius={12}
        colors={[...BORDER_GLOW_COLORS]}
        coneSpread={22}
        edgeSensitivity={26}
        glowColor="262 58% 58%"
        glowIntensity={0.88}
        glowRadius={26}
      >
        <div className="flex h-full min-h-0 flex-col justify-center px-3 py-2 sm:px-4 sm:py-3">
          <SpotlightCard className="!overflow-visible !rounded-xl !border-transparent !bg-transparent !shadow-none">
            <TrackRecordMetricVisual item={item} />
          </SpotlightCard>
        </div>
      </BorderGlow>
    ),
  }));

  return (
    <div className="flex h-full min-h-0 w-full max-w-md flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 lg:max-h-full lg:overflow-hidden lg:p-6">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
      >
        <div className="lg:hidden text-center mb-8">
          <Image
            src="/hyperkit-header-white.svg"
            alt="Hyperkit"
            width={160}
            height={52}
            className="h-10 w-auto mx-auto"
            priority
          />
          <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
            AI-powered smart contract development platform
          </p>
        </div>

        <BorderGlow
          className="w-full overflow-hidden border-[var(--color-border-accent)] shadow-2xl shadow-[var(--color-primary-alpha-10)]"
          backgroundColor="var(--color-bg-panel)"
          borderRadius={16}
          colors={[...BORDER_GLOW_COLORS]}
          edgeSensitivity={28}
          glowColor="262 58% 58%"
          glowIntensity={0.95}
          glowRadius={36}
        >
          <div className="flex flex-col overflow-hidden">
            <div className="relative p-5 lg:p-6">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-50)] to-transparent" />
              <SessionGate
                title="Sign in to get started"
                description="Connect your wallet to start building. No gas fees."
                noWrapper={true}
              />
            </div>

            <div className="border-t border-[var(--color-border-subtle)] border-dashed opacity-50" />

            <div className="bg-[var(--color-bg-panel)]/30 p-4 lg:p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Track Record
              </p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <LiquidGlass intensity="medium" className="p-3 sm:p-4">
                  <TooltipProvider delayDuration={200}>
                    <SmoothTab
                      defaultTabId={trackTabs[0]?.id}
                      items={trackTabs}
                      contentPanelClassName="!min-h-[212px] lg:!min-h-[220px]"
                    />
                  </TooltipProvider>
                </LiquidGlass>
              </motion.div>
            </div>
          </div>
        </BorderGlow>
      </motion.div>
    </div>
  );
}
