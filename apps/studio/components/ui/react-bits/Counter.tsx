"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import {
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

type PlaceValue = number | ".";

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

function Number({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });

  const baseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return <motion.span style={{ ...baseStyle, y }}>{number}</motion.span>;
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number): number {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

function DecimalPointDigit({
  height,
  digitStyle,
}: {
  height: number;
  digitStyle?: CSSProperties;
}) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ height, width: "fit-content", ...digitStyle }}
    >
      .
    </span>
  );
}

interface RollingDigitProps {
  place: number;
  value: number;
  height: number;
  digitStyle?: CSSProperties;
}

function RollingDigit({ place, value, height, digitStyle }: RollingDigitProps) {
  const valueRoundedToPlace = getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace, {
    stiffness: 200,
    damping: 30,
  });

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  const defaultStyle: CSSProperties = {
    height,
    position: "relative",
    width: "1ch",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <span
      className="relative inline-flex overflow-hidden"
      style={{ ...defaultStyle, ...digitStyle }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

function Digit({
  place,
  value,
  height,
  digitStyle,
}: {
  place: PlaceValue;
  value: number;
  height: number;
  digitStyle?: CSSProperties;
}) {
  if (place === ".") {
    return <DecimalPointDigit digitStyle={digitStyle} height={height} />;
  }
  return (
    <RollingDigit
      digitStyle={digitStyle}
      height={height}
      place={place}
      value={value}
    />
  );
}

export interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: PlaceValue[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: CSSProperties["fontWeight"];
  containerStyle?: CSSProperties;
  counterStyle?: CSSProperties;
  digitStyle?: CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: CSSProperties;
  bottomGradientStyle?: CSSProperties;
}

export function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places = [...value.toString()].map((ch, i, a) => {
    if (ch === ".") {
      return ".";
    }

    const dotIndex = a.indexOf(".");
    const isInteger = dotIndex === -1;

    const exponent = isInteger
      ? a.length - i - 1
      : i < dotIndex
        ? dotIndex - i - 1
        : -(i - dotIndex);

    return 10 ** exponent;
  }),
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = "inherit",
  fontWeight = "inherit",
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = "black",
  gradientTo = "transparent",
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  const height = fontSize + padding;

  const defaultContainerStyle: CSSProperties = {
    position: "relative",
    display: "inline-block",
  };

  const defaultCounterStyle: CSSProperties = {
    fontSize,
    display: "flex",
    gap,
    overflow: "hidden",
    borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    lineHeight: 1,
    color: textColor,
    fontWeight,
    direction: "ltr",
  };

  const gradientContainerStyle: CSSProperties = {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const defaultTopGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  };

  const defaultBottomGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  };

  return (
    <span style={{ ...defaultContainerStyle, ...containerStyle }}>
      <span style={{ ...defaultCounterStyle, ...counterStyle }}>
        {places.map((place, idx) => (
          <Digit
            key={`${place}-${idx}`}
            place={place}
            value={value}
            height={height}
            digitStyle={digitStyle}
          />
        ))}
      </span>
      <span style={gradientContainerStyle}>
        <span style={topGradientStyle ?? defaultTopGradientStyle} />
        <span style={bottomGradientStyle ?? defaultBottomGradientStyle} />
      </span>
    </span>
  );
}
