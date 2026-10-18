import React, { useEffect, useRef, useMemo } from 'react';

export interface VaporRibbonsProps {
  /**
   * Primary brand color (ribbon 1)
   * Default: #a86df2
   */
  color1?: string;
  /**
   * Secondary brand color (ribbon 2)
   * Default: #d66de0
   */
  color2?: string;
  /**
   * Tertiary brand color (ribbon 3)
   * Default: #6d5df2
   */
  color3?: string;
  /**
   * Array of colors as alternative to color1/color2/color3
   */
  colors?: [string, string, string] | string[];
  /**
   * Background color of the effect canvas
   * Default: #0f1013
   */
  background?: string;
  /**
   * Animation speed multiplier
   * Default: 1.0
   */
  speed?: number;
  /**
   * Additional CSS classes for canvas container
   */
  className?: string;
  /**
   * Inline styles for canvas container
   */
  style?: React.CSSProperties;
}

const VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Silky, high-performance WebGL fragment shader:
// 1. Natural fluid wave propagation speed (eliminates the slow creeping sensation).
// 2. High-speed continuous analog grain (eliminates the 5Hz stepping flicker that caused perceptual lag).
// 3. Fast hardware-native sinusoidal harmonics for 60 FPS rasterization on integrated GPUs.
const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uBg;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Flowing ribbon: Gaussian core around continuous harmonic wave, inside wide vapor halo
float ribbon(vec2 p, float base, float seed, float s) {
  float path = base
    + 0.13 * sin(p.x * 1.5 + seed + s * 0.55)
    + 0.06 * sin(p.x * 2.7 - seed * 1.8 - s * 0.38)
    + 0.05 * sin(p.x * 0.8 + seed * 2.5 + s * 0.28);

  float m = abs(p.y - path);
  
  // Organic width modulation
  float wdt = 0.045 + 0.02 * sin(p.x * 1.2 + seed * 3.8 + s * 0.32);

  // Soft Gaussian core
  float dCore = m / wdt;
  float body = exp(-dCore * dCore);

  // Atmospheric vapor halo
  float dHalo = m / (wdt * 3.6);
  float halo = exp(-dHalo * dHalo) * 0.22;

  return body + halo;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes - 0.5;
  uv.x *= uRes.x / uRes.y;
  float s = uTime * uSpeed;

  // Diagonal ribbon tilt
  float a = -0.14;
  vec2 p = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;

  vec3 col = vec3(0.0);
  col += uC0 * ribbon(p, 0.26, 1.7, s) * 0.65;
  col += uC1 * ribbon(p, -0.04, 4.9, s) * 0.75;
  col += uC2 * ribbon(p, -0.34, 8.3, s) * 0.5;

  // Atmospheric film response curve
  col = 1.0 - exp(-col * 1.7);

  // Smooth continuous grain (eliminates low-Hz stepping flicker)
  float gr = hash(gl_FragCoord.xy + fract(uTime * 0.05) * vec2(13.7, 7.3));
  col *= 0.96 + 0.08 * gr;

  gl_FragColor = vec4(uBg + col, 1.0);
}
`;

function resolveHexColor(target: HTMLElement | null, color: string): string {
  if (color.startsWith('var(')) {
    const varName = color.slice(4, -1).trim();
    if (target) {
      const resolved = getComputedStyle(target).getPropertyValue(varName).trim();
      if (resolved) return resolved;
    }
    return '#a86df2';
  }
  return color;
}

function parseNormalizedRgb(hexColor: string): [number, number, number] {
  let cleaned = hexColor.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  if (Number.isNaN(num)) {
    return [1.0, 1.0, 1.0];
  }
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

/**
 * VaporRibbons
 * Silky 60fps procedural flowing vapor ribbons background.
 */
export const VaporRibbons: React.FC<VaporRibbonsProps> = ({
  color1 = '#a86df2',
  color2 = '#d66de0',
  color3 = '#6d5df2',
  colors,
  background = '#0f1013',
  speed = 1.0,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derive palette
  const effectiveC0 = colors && colors[0] ? colors[0] : color1;
  const effectiveC1 = colors && colors[1] ? colors[1] : color2;
  const effectiveC2 = colors && colors[2] ? colors[2] : color3;

  const memoizedProps = useMemo(() => ({
    c0: effectiveC0,
    c1: effectiveC1,
    c2: effectiveC2,
    bg: background,
    speed,
  }), [effectiveC0, effectiveC1, effectiveC2, background, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Optimal 0.5x resolution buffer for volumetric soft gradients:
    // Slashes fill-rate load by 75% while bilinear interpolation renders silky, velvety gradients.
    const renderScale = 0.5;

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      depth: false,
      stencil: false,
    });

    if (!gl) {
      // 2D Canvas fallback
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const render2DFallback = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const targetW = Math.max(320, Math.round(width * renderScale));
        const targetH = Math.max(240, Math.round(height * renderScale));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

        ctx.fillStyle = memoizedProps.bg;
        ctx.fillRect(0, 0, width, height);

        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0.1, memoizedProps.c0 + '44');
        grad.addColorStop(0.5, memoizedProps.c1 + '55');
        grad.addColorStop(0.9, memoizedProps.c2 + '33');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(width * 0.5, height * 0.45, width * 0.6, height * 0.35, -0.15, 0, Math.PI * 2);
        ctx.fill();
      };

      render2DFallback();
      window.addEventListener('resize', render2DFallback);
      return () => window.removeEventListener('resize', render2DFallback);
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        if (!gl.isContextLost()) {
          console.error('VaporRibbons shader compile error:', gl.getShaderInfoLog(shader));
        }
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('VaporRibbons program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full screen triangle
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const aPosLoc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    const uResLoc = gl.getUniformLocation(program, 'uRes');
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uSpeedLoc = gl.getUniformLocation(program, 'uSpeed');
    const uC0Loc = gl.getUniformLocation(program, 'uC0');
    const uC1Loc = gl.getUniformLocation(program, 'uC1');
    const uC2Loc = gl.getUniformLocation(program, 'uC2');
    const uBgLoc = gl.getUniformLocation(program, 'uBg');

    // Parse color vectors
    const c0Rgb = parseNormalizedRgb(resolveHexColor(canvas, memoizedProps.c0));
    const c1Rgb = parseNormalizedRgb(resolveHexColor(canvas, memoizedProps.c1));
    const c2Rgb = parseNormalizedRgb(resolveHexColor(canvas, memoizedProps.c2));
    const bgRgb = parseNormalizedRgb(resolveHexColor(canvas, memoizedProps.bg));

    if (uC0Loc) gl.uniform3f(uC0Loc, c0Rgb[0], c0Rgb[1], c0Rgb[2]);
    if (uC1Loc) gl.uniform3f(uC1Loc, c1Rgb[0], c1Rgb[1], c1Rgb[2]);
    if (uC2Loc) gl.uniform3f(uC2Loc, c2Rgb[0], c2Rgb[1], c2Rgb[2]);
    if (uBgLoc) gl.uniform3f(uBgLoc, bgRgb[0], bgRgb[1], bgRgb[2]);
    if (uSpeedLoc) gl.uniform1f(uSpeedLoc, memoizedProps.speed);

    let animationFrameId = 0;
    let isIntersecting = true;
    const startTime = performance.now();

    const drawFrame = (currentTimeSec: number) => {
      gl.uniform2f(uResLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(uTimeLoc, currentTimeSec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      drawFrame(elapsed);
      animationFrameId = requestAnimationFrame(loop);
    };

    const startAnimation = () => {
      if (prefersReducedMotion || animationFrameId || !isIntersecting || document.hidden) {
        return;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    const stopAnimation = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const targetW = Math.max(320, Math.round(width * renderScale));
      const targetH = Math.max(240, Math.round(height * renderScale));

      // Guard against redundant buffer reallocation
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        gl.viewport(0, 0, targetW, targetH);
      }

      drawFrame(prefersReducedMotion ? 2.5 : (performance.now() - startTime) / 1000);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    handleResize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry?.isIntersecting ?? true;
      if (isIntersecting) {
        startAnimation();
      } else {
        stopAnimation();
      }
    });
    intersectionObserver.observe(canvas);

    const handleVisibility = () => {
      if (document.hidden) {
        stopAnimation();
      } else {
        startAnimation();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    startAnimation();

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (buffer) gl.deleteBuffer(buffer);
      if (vertShader) gl.deleteShader(vertShader);
      if (fragShader) gl.deleteShader(fragShader);
      if (program) gl.deleteProgram(program);
    };
  }, [memoizedProps]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`af-vapor-ribbons-canvas ${className}`}
      style={{
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
        imageRendering: 'auto',
        transform: 'translateZ(0)',
        willChange: 'transform',
        contain: 'strict',
        ...style,
      }}
    />
  );
};

export default VaporRibbons;
