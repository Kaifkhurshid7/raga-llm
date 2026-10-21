import type { CSSProperties } from "react";

/**
 * Decorative line drawing of a tanpura with leafy sprigs, for the home screen.
 * Pure SVG in the theme's accent colour; carries no information, so it is hidden from
 * assistive technology.
 */

interface Sprig {
  /** Start, control and end points of the stem (a quadratic curve). */
  from: [number, number];
  control: [number, number];
  to: [number, number];
  leaves: number;
  size: number;
  /** Which side the first leaf grows on. */
  side?: 1 | -1;
}

const SPRIGS: Sprig[] = [
  { from: [34, 505], control: [-14, 400], to: [26, 262], leaves: 7, size: 24 },
  { from: [92, 318], control: [38, 232], to: [86, 112], leaves: 6, size: 21, side: -1 },
  { from: [262, 525], control: [344, 452], to: [312, 346], leaves: 6, size: 21 },
  { from: [214, 62], control: [190, 28], to: [236, 8], leaves: 3, size: 15, side: -1 },
];

function quad(t: number, [x0, y0]: [number, number], [cx, cy]: [number, number], [x1, y1]: [number, number]) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
    // Direction of travel along the stem, in degrees.
    angle:
      (Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx)) * 180) /
      Math.PI,
  };
}

/** A pointed leaf lying along the negative y axis, `size` long. */
const leafPath = (size: number) => {
  const w = size * 0.32;
  return `M0 0 C ${w} ${-size * 0.3} ${w} ${-size * 0.75} 0 ${-size} C ${-w} ${-size * 0.75} ${-w} ${-size * 0.3} 0 0 Z`;
};

function SprigDrawing({ sprig }: { sprig: Sprig }) {
  const { from, control, to, leaves, size, side = 1 } = sprig;
  const leaf = leafPath(size);
  const items = Array.from({ length: leaves }, (_, i) => {
    const t = (i + 1) / (leaves + 1);
    const p = quad(t, from, control, to);
    const dir = i % 2 === 0 ? side : (-side as 1 | -1);
    return { ...p, rotate: p.angle + dir * 42 + 90, scale: 1 - t * 0.28 };
  });
  const tip = quad(1, from, control, to);

  return (
    <g>
      <path d={`M${from[0]} ${from[1]} Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`} />
      {items.map((l, i) => (
        <path
          key={i}
          d={leaf}
          transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rotate.toFixed(1)}) scale(${l.scale.toFixed(2)})`}
          className="fill-accent-soft"
        />
      ))}
      <path
        d={leaf}
        transform={`translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${(tip.angle + 90).toFixed(1)}) scale(0.7)`}
        className="fill-accent-soft"
      />
    </g>
  );
}

const FRETS = [-150, -128, -106, -84, -62, -40, -18, 4, 26];

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function HomeIllustration({ className = "", style }: Props) {
  return (
    <div data-testid="home-illustration" aria-hidden="true" className={className} style={style}>
      <svg
        viewBox="0 0 360 540"
        preserveAspectRatio="xMaxYMid meet"
        className="h-full w-full text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Soft disc behind the instrument */}
        <circle cx="214" cy="178" r="112" className="fill-accent-soft" stroke="none" opacity="0.65" />

        {/* Ground line */}
        <path d="M18 522 C 90 512, 190 530, 340 514" opacity="0.5" />
        <path d="M60 532 C 130 524, 230 538, 320 526" opacity="0.3" />

        <g opacity="0.78">
          {SPRIGS.map((s, i) => (
            <SprigDrawing key={i} sprig={s} />
          ))}
        </g>

        {/* The instrument, drawn upright then leaned */}
        <g transform="translate(186 288) rotate(26)" opacity="0.9">
          {/* Gourd and soundboard */}
          <ellipse cx="0" cy="132" rx="76" ry="86" className="fill-page" />
          <ellipse cx="0" cy="132" rx="63" ry="73" />
          <ellipse cx="0" cy="132" rx="52" ry="61" strokeDasharray="1 5" />
          <circle cx="0" cy="150" r="13" />
          <circle cx="0" cy="150" r="7" strokeDasharray="1 3" />
          {/* Petal rosette on the soundboard */}
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-12" rx="4.5" ry="11" transform={`translate(0 150) rotate(${i * 45})`} opacity="0.75" />
          ))}
          <path d="M-20 76 Q0 66 20 76" />
          <path d="M-14 214 L-14 226 L14 226 L14 214" />

          {/* Neck */}
          <path d="M-12 66 L-10 -182 L10 -182 L12 66" className="fill-page" />
          <path d="M0 66 L0 -182" opacity="0.45" />
          {FRETS.map((y) => (
            <path key={y} d={`M-10.5 ${y} L10.5 ${y}`} opacity="0.7" />
          ))}

          {/* Head and tuning pegs */}
          <path d="M-12 -182 L-15 -214 Q-16 -230 0 -232 Q16 -230 15 -214 L12 -182 Z" className="fill-page" />
          <circle cx="0" cy="-240" r="7" className="fill-page" />
          <path d="M-15 -206 L-30 -210 M-14 -194 L-29 -196 M15 -206 L30 -210 M14 -194 L29 -196" />
          <circle cx="-31" cy="-210" r="3" />
          <circle cx="-30" cy="-196" r="3" />
          <circle cx="31" cy="-210" r="3" />
          <circle cx="30" cy="-196" r="3" />

          {/* Strings and bridge */}
          <path d="M-5 -182 L-6 118 M-1.7 -182 L-2 118 M1.7 -182 L2 118 M5 -182 L6 118" strokeWidth="0.8" opacity="0.8" />
          <path d="M-22 118 L22 118 L22 124 L-22 124 Z" className="fill-page" />
        </g>
      </svg>
    </div>
  );
}
