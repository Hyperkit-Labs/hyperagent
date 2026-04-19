"use client";

/**
 * Flowing aurora gradient (DavidHDev/react-bits Backgrounds/Aurora).
 * WebGL2 only (no ogl) so the bundle resolves without extra installs.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) { \
  int index = 0; \
  for (int i = 0; i < 2; i++) { \
    ColorStop currentColor = colors[i]; \
    bool isInBetween = currentColor.position <= factor; \
    index = int(mix(float(index), float(i), float(isInBetween))); \
  } \
  ColorStop currentColor = colors[index]; \
  ColorStop nextColor = colors[index + 1]; \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return [0, 0, 0];
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
): WebGLProgram | null {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  gl.shaderSource(vs, vertexSrc);
  gl.shaderSource(fs, fragmentSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("[Aurora] vertex shader:", gl.getShaderInfoLog(vs));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("[Aurora] fragment shader:", gl.getShaderInfoLog(fs));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[Aurora] program:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  time?: number;
  speed?: number;
  className?: string;
}

/** Theme-aligned defaults: --color-primary scale (theme.css) */
export const AURORA_BRAND_COLOR_STOPS: string[] = [
  "#5b21b6",
  "#7c3aed",
  "#a78bfa",
];

export default function Aurora(props: AuroraProps) {
  const {
    colorStops = AURORA_BRAND_COLOR_STOPS,
    amplitude = 1.0,
    blend = 0.5,
    className,
  } = props;
  const propsRef = useRef(props);
  propsRef.current = {
    colorStops,
    amplitude,
    blend,
    speed: props.speed ?? 1,
    time: props.time,
  };

  const ctnDom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ctnDom.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.backgroundColor = "transparent";

    const glContext = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!glContext) {
      console.warn("[Aurora] WebGL2 unavailable; skipping background.");
      return;
    }

    glContext.clearColor(0, 0, 0, 0);
    glContext.enable(glContext.BLEND);
    glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);

    const program = compileProgram(glContext, VERT, FRAG);
    if (!program) return;

    const loc = {
      position: glContext.getAttribLocation(program, "position"),
      uTime: glContext.getUniformLocation(program, "uTime"),
      uAmplitude: glContext.getUniformLocation(program, "uAmplitude"),
      uResolution: glContext.getUniformLocation(program, "uResolution"),
      uBlend: glContext.getUniformLocation(program, "uBlend"),
      uColorStops: [
        glContext.getUniformLocation(program, "uColorStops[0]"),
        glContext.getUniformLocation(program, "uColorStops[1]"),
        glContext.getUniformLocation(program, "uColorStops[2]"),
      ],
    };

    const vao = glContext.createVertexArray();
    const buf = glContext.createBuffer();
    if (!vao || !buf) {
      glContext.deleteProgram(program);
      return;
    }

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    glContext.bindVertexArray(vao);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, buf);
    glContext.bufferData(
      glContext.ARRAY_BUFFER,
      positions,
      glContext.STATIC_DRAW,
    );
    glContext.enableVertexAttribArray(loc.position);
    glContext.vertexAttribPointer(
      loc.position,
      2,
      glContext.FLOAT,
      false,
      0,
      0,
    );
    glContext.bindVertexArray(null);

    function setColorStops(stops: string[]) {
      for (let i = 0; i < 3; i += 1) {
        const L = loc.uColorStops[i];
        if (L) {
          const [r, g, b] = hexToRgb01(
            stops[i] ?? stops[stops.length - 1] ?? "#000000",
          );
          glContext!.uniform3f(L, r, g, b);
        }
      }
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = Math.max(1, container!.offsetWidth);
      const cssH = Math.max(1, container!.offsetHeight);
      const w = Math.floor(cssW * dpr);
      const h = Math.floor(cssH * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      glContext!.viewport(0, 0, w, h);
      if (loc.uResolution) {
        glContext!.useProgram(program);
        glContext!.uniform2f(loc.uResolution, w, h);
      }
    }

    window.addEventListener("resize", resize);
    container.appendChild(canvas);
    resize();

    let animateId = 0;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      const { time = t * 0.01, speed = 1.0 } = propsRef.current;
      const p = propsRef.current;
      glContext.useProgram(program);
      glContext.bindVertexArray(vao);
      if (loc.uTime) glContext.uniform1f(loc.uTime, time * speed * 0.1);
      if (loc.uAmplitude)
        glContext.uniform1f(loc.uAmplitude, p.amplitude ?? 1.0);
      if (loc.uBlend) glContext.uniform1f(loc.uBlend, p.blend ?? blend);
      const nextStops = p.colorStops ?? AURORA_BRAND_COLOR_STOPS;
      setColorStops(nextStops);
      glContext.clear(glContext.COLOR_BUFFER_BIT);
      glContext.drawArrays(glContext.TRIANGLES, 0, 3);
    };
    animateId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener("resize", resize);
      if (container.contains(canvas)) container.removeChild(canvas);
      glContext.deleteVertexArray(vao);
      glContext.deleteBuffer(buf);
      glContext.deleteProgram(program);
      glContext.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [amplitude, blend]);

  return (
    <div
      ref={ctnDom}
      className={cn("h-full w-full min-h-[12rem]", className)}
      aria-hidden
    />
  );
}
