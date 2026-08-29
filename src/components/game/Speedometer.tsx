import { useEffect, useRef } from "react";

type SpeedometerProps = {
  speed: number;
  gear: number;
  rpm: number;
  nitro: number;
  tyres: number;
};

export function Speedometer({ speed, gear, rpm, nitro, tyres }: SpeedometerProps) {
  const needleRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const speedTextRef = useRef<SVGTextElement>(null);
  const gearTextRef = useRef<SVGTextElement>(null);
  const nitroArcRef = useRef<SVGPathElement>(null);

  const currentRpmRef = useRef(rpm);
  const targetRpmRef = useRef(rpm);
  const currentSpeedRef = useRef(speed);
  const targetSpeedRef = useRef(speed);
  const currentNitroRef = useRef(nitro);
  const targetNitroRef = useRef(nitro);
  const targetGearRef = useRef(gear);

  useEffect(() => {
    targetRpmRef.current = rpm;
    targetSpeedRef.current = speed;
    targetGearRef.current = gear;
    targetNitroRef.current = nitro;
  }, [rpm, speed, gear, nitro]);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth RPM needle interpolation
      const rpmBlend = 1 - Math.exp(-24 * dt);
      currentRpmRef.current += (targetRpmRef.current - currentRpmRef.current) * rpmBlend;
      if (Math.abs(currentRpmRef.current - targetRpmRef.current) < 0.02 && targetRpmRef.current === 0) {
        currentRpmRef.current = 0;
      }

      const speedBlend = 1 - Math.exp(-24 * dt);
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * speedBlend;

      const nitroBlend = 1 - Math.exp(-18 * dt);
      currentNitroRef.current += (targetNitroRef.current - currentNitroRef.current) * nitroBlend;

      const clampedRpm = Math.max(0, Math.min(10, currentRpmRef.current));
      // Dial geometry: unrotated needle points straight UP (12 o'clock / 5 RPM).
      // 0 RPM is at 7:30 (-135deg from UP), 10 RPM is at 4:30 (+135deg from UP).
      const needleAngle = -135 + (clampedRpm / 10) * 270;

      if (needleRef.current) {
        needleRef.current.setAttribute("transform", `rotate(${needleAngle.toFixed(2)} 160 160)`);
      }

      // Dynamic trail behind needle when revving high
      if (trailRef.current) {
        const trailAngle = Math.max(-135, needleAngle - 18);
        const rad1 = ((trailAngle - 90) * Math.PI) / 180;
        const rad2 = ((needleAngle - 90) * Math.PI) / 180;
        const x1 = 160 + 104 * Math.cos(rad1);
        const y1 = 160 + 104 * Math.sin(rad1);
        const x2 = 160 + 104 * Math.cos(rad2);
        const y2 = 160 + 104 * Math.sin(rad2);
        const path = `M 160 160 L ${x1.toFixed(1)} ${y1.toFixed(1)} A 104 104 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
        trailRef.current.setAttribute("d", path);
        trailRef.current.setAttribute("opacity", (Math.min(1, clampedRpm / 8) * 0.45).toFixed(2));
      }

      if (speedTextRef.current) {
        speedTextRef.current.textContent = Math.round(currentSpeedRef.current).toString();
      }

      if (gearTextRef.current) {
        const g = targetGearRef.current;
        gearTextRef.current.textContent = g === -1 ? "R" : g === 0 ? "N" : g.toString();
      }

      // Nitro bar on the RIGHT just outside dial: drains top-to-bottom
      if (nitroArcRef.current) {
        const fullLength = Math.PI * 148; // ~464.96px
        const activeLength = fullLength * Math.max(0, Math.min(1, currentNitroRef.current));
        nitroArcRef.current.setAttribute(
          "stroke-dasharray",
          `${activeLength.toFixed(2)} ${fullLength.toFixed(2)}`
        );
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Dial ticks and numbers: 0 to 10
  // Track radius is R = 120, tick inner radius is 107, numbers are safely placed at R = 88
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angleDeg = 135 + (i / 10) * 270;
    const rad = (angleDeg * Math.PI) / 180;
    const isRedline = i >= 7;
    // Major tick mark coordinates (13px tick from track inward)
    const x1 = 160 + 120 * Math.cos(rad);
    const y1 = 160 + 120 * Math.sin(rad);
    const x2 = 160 + 107 * Math.cos(rad);
    const y2 = 160 + 107 * Math.sin(rad);
    // Number coordinates (inside ticks with plenty of clear margin)
    const nx = 160 + 88 * Math.cos(rad);
    const ny = 160 + 88 * Math.sin(rad);
    return { i, x1, y1, x2, y2, nx, ny, isRedline };
  });

  // Minor half-ticks (between numbers, 7px tick from track inward)
  const minorTicks = Array.from({ length: 10 }, (_, i) => {
    const angleDeg = 135 + ((i + 0.5) / 10) * 270;
    const rad = (angleDeg * Math.PI) / 180;
    const isRedline = i >= 6;
    const x1 = 160 + 120 * Math.cos(rad);
    const y1 = 160 + 120 * Math.sin(rad);
    const x2 = 160 + 113 * Math.cos(rad);
    const y2 = 160 + 113 * Math.sin(rad);
    return { i, x1, y1, x2, y2, isRedline };
  });

  const tyrePct = Math.round(tyres * 100);
  const tyreColor =
    tyrePct >= 60 ? "#43d675" : tyrePct >= 30 ? "#ffd23f" : "#ff4d5e";

  return (
    <div className="pointer-events-none flex flex-col items-center select-none">
      <div className="relative w-[34vh] h-[34vh] max-w-[280px] max-h-[280px] min-w-[210px] min-h-[210px] aspect-square">
        <svg
          viewBox="0 0 320 320"
          className="h-full w-full drop-shadow-[0_12px_32px_rgba(0,0,0,0.85)]"
        >
          <defs>
            {/* Deep background vignette */}
            <radialGradient id="gauge-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#121822" />
              <stop offset="70%" stopColor="#0a0e14" />
              <stop offset="100%" stopColor="#05070a" />
            </radialGradient>

            {/* Glowing Nitro Cyan/Green gradient */}
            <linearGradient id="nitro-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f5a0" />
              <stop offset="70%" stopColor="#00e5bf" />
              <stop offset="100%" stopColor="#00c8ff" />
            </linearGradient>

            {/* Redline back-glow */}
            <radialGradient id="redline-glow" cx="80%" cy="50%" r="45%">
              <stop offset="0%" stopColor="rgba(255, 59, 48, 0.45)" />
              <stop offset="60%" stopColor="rgba(255, 59, 48, 0.15)" />
              <stop offset="100%" stopColor="rgba(255, 59, 48, 0)" />
            </radialGradient>

            {/* Needle fluorescent glow filter */}
            <filter id="needle-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Nitro arc glow filter */}
            <filter id="nitro-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main Dial Body Circle */}
          <circle cx="160" cy="160" r="132" fill="url(#gauge-bg)" stroke="#1a212c" strokeWidth="2.5" />
          <circle cx="160" cy="160" r="130" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

          {/* Redline Sector Glowing Background Zone (from 6.5 to 10 RPM) */}
          <path
            d="M 160 160 L 237.93 68.74 A 120 120 0 0 1 244.85 244.85 Z"
            fill="url(#redline-glow)"
          />

          {/* Outer Nitro Tank Arc (Right Side: just outside dial, curving from top 12 o'clock to bottom 6 o'clock) */}
          {/* Background track along outer right side */}
          <path
            d="M 160 308 A 148 148 0 0 0 160 12"
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active Glowing Nitro Arc (drains top-to-bottom) */}
          <path
            ref={nitroArcRef}
            d="M 160 308 A 148 148 0 0 0 160 12"
            fill="none"
            stroke="url(#nitro-glow-grad)"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 148}`}
            filter="url(#nitro-glow)"
          />

          {/* Nitro Segment Divider Notches along the right arc (4 segments at -45deg, 0deg, +45deg) */}
          {[-45, 0, 45].map((angleDeg, idx) => {
            const rad = (angleDeg * Math.PI) / 180;
            const x1 = 160 + 142 * Math.cos(rad);
            const y1 = 160 + 142 * Math.sin(rad);
            const x2 = 160 + 154 * Math.cos(rad);
            const y2 = 160 + 154 * Math.sin(rad);
            return (
              <line
                key={`nitro-notch-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#05070a"
                strokeWidth="2.5"
              />
            );
          })}

          {/* Nitro Diamond Star Accent at bottom right */}
          <path
            d="M 282 282 L 286 286 L 282 290 L 278 286 Z"
            fill="rgba(0, 245, 160, 0.45)"
          />

          {/* Inner Dial Main Track Arc (Perfect Circle at R = 120, well outside the numbers at R = 88) */}
          {/* White Arc (0 to 6.5 RPM) */}
          <path
            d="M 75.15 244.85 A 120 120 0 0 1 237.93 68.74"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Redline Glowing Arc (6.5 to 10 RPM) */}
          <path
            d="M 237.93 68.74 A 120 120 0 0 1 244.85 244.85"
            fill="none"
            stroke="#ff3b30"
            strokeWidth="4.5"
            strokeLinecap="round"
            filter="drop-shadow(0 0 6px #ff3b30)"
          />

          {/* Minor Ticks (at R = 120 to 113) */}
          {minorTicks.map((t) => (
            <line
              key={`minor-${t.i}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isRedline ? "#ff3b30" : "rgba(255,255,255,0.4)"}
              strokeWidth="1.5"
            />
          ))}

          {/* Major Ticks (at R = 120 to 107) & Numbers (at R = 88) */}
          {ticks.map((t) => (
            <g key={`tick-${t.i}`}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isRedline ? "#ff3b30" : "#ffffff"}
                strokeWidth={t.isRedline ? "3" : "2.5"}
                strokeLinecap="round"
              />
              <text
                x={t.nx}
                y={t.ny + 6}
                textAnchor="middle"
                fontSize={t.i === 10 ? "16" : "18"}
                fontWeight="800"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill={t.isRedline ? "#ff4d5e" : "#ffffff"}
                className="select-none"
                style={t.isRedline ? { filter: "drop-shadow(0 0 4px rgba(255,59,48,0.6))" } : undefined}
              >
                {t.i}
              </text>
            </g>
          ))}

          {/* Red Speed Trail / Motion Blur Wedge */}
          <path ref={trailRef} fill="url(#redline-glow)" opacity="0" />

          {/* Luminous Red Needle (Center at 160 160) */}
          <g ref={needleRef} transform="rotate(-135 160 160)">
            {/* Soft Red Flare Trail */}
            <path
              d="M 160 160 L 152 160 L 159 52 L 161 52 L 168 160 Z"
              fill="rgba(255, 59, 48, 0.25)"
            />
            {/* Main Red Needle */}
            <polygon
              points="158,160 160,50 162,160 160,178"
              fill="#ff3838"
              filter="url(#needle-glow)"
            />
            {/* Needle Bright Center Core Line */}
            <line
              x1="160"
              y1="170"
              x2="160"
              y2="52"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>

          {/* Semi-transparent Circular Red Hub at Center */}
          <circle
            cx="160"
            cy="160"
            r="16"
            fill="rgba(255, 59, 48, 0.35)"
            stroke="#ff3838"
            strokeWidth="1.8"
          />
          <circle cx="160" cy="160" r="6" fill="#1c222c" stroke="#ff3838" strokeWidth="1.5" />

          {/* Digital LCD Box (Gear & Speed) */}
          <g transform="translate(110, 204)">
            {/* LCD Panel Background */}
            <rect
              x="0"
              y="0"
              width="96"
              height="35"
              rx="5"
              fill="#b0c8c3"
              stroke="#68827d"
              strokeWidth="1.8"
              filter="drop-shadow(0 2px 5px rgba(0,0,0,0.6))"
            />
            {/* LCD Subtle Inner Texture */}
            <rect
              x="2"
              y="2"
              width="92"
              height="31"
              rx="3"
              fill="none"
              stroke="rgba(0,0,0,0.15)"
              strokeWidth="1"
            />

            {/* Gear Compartment (Left) */}
            <text
              ref={gearTextRef}
              x="19"
              y="26"
              textAnchor="middle"
              fontSize="23"
              fontWeight="900"
              fontFamily="Courier New, monospace, monospace"
              fill="#182d2a"
              className="select-none"
              letterSpacing="-1"
            >
              1
            </text>

            {/* Vertical Divider Line */}
            <line x1="36" y1="5" x2="36" y2="30" stroke="#75938d" strokeWidth="2" />

            {/* Speed Compartment (Right) */}
            <text
              ref={speedTextRef}
              x="65"
              y="26"
              textAnchor="middle"
              fontSize="23"
              fontWeight="900"
              fontFamily="Courier New, monospace, monospace"
              fill="#182d2a"
              className="select-none"
              letterSpacing="0"
            >
              0
            </text>
          </g>

          {/* "Km/h" Label beside LCD Box */}
          <text
            x="214"
            y="233"
            fontSize="14"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#ffffff"
            className="select-none"
          >
            Km/h
          </text>
        </svg>
      </div>

      {/* Tire Condition Badge near Speedometer */}
      <div className="mt-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-0.5 shadow-md backdrop-blur-md">
        <span className="text-xs">🛞</span>
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">Tires</span>
        <span
          className="text-xs font-black tabular-nums"
          style={{ color: tyreColor }}
        >
          {tyrePct}%
        </span>
      </div>
    </div>
  );
}
