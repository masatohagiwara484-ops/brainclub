// A zero-dependency radar (spider) chart for the 3-axis Synapse profile.
// Pure inline SVG — no chart library, no canvas — so it scales crisply and adds
// ~0 KB of network cost. The filled polygon uses `--fx-accent` so it picks up
// the Zen/Arcade theme automatically.

import { useTranslation } from 'react-i18next';
import { AXES, type Axis, type SynapseProfile } from '../lib/synapse';

type Props = {
  profile: SynapseProfile;
  /** Radius of the chart in SVG units. Labels get extra room around it. */
  radius?: number;
  className?: string;
};

// memory at the top, logic lower-right, reflex lower-left (equilateral).
const ANGLES: Record<Axis, number> = { memory: -90, logic: 30, reflex: 150 };

function point(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export default function SynapseRadar({ profile, radius = 80, className }: Props) {
  const { t } = useTranslation();
  const R = radius;
  const W = 2 * R + 140; // generous horizontal room for axis labels
  const H = 2 * R + 70;
  const cx = W / 2;
  const cy = R + 34;
  const rings = [0.25, 0.5, 0.75, 1];

  const ringPoints = (rr: number) =>
    AXES.map((a) => point(cx, cy, R * rr, ANGLES[a]).join(',')).join(' ');
  const dataPoints = AXES.map((a) =>
    point(cx, cy, R * (Math.max(0, Math.min(100, profile[a])) / 100), ANGLES[a]).join(','),
  ).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={t('synapse.title')}
      className={className}
      style={{ overflow: 'visible', maxWidth: '100%' }}
    >
      {/* grid rings */}
      {rings.map((rr, i) => (
        <polygon key={i} points={ringPoints(rr)} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {/* spokes */}
      {AXES.map((a) => {
        const [x, y] = point(cx, cy, R, ANGLES[a]);
        return <line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      {/* data polygon */}
      <polygon
        className="fx-pop"
        points={dataPoints}
        fill="var(--fx-accent, #6366f1)"
        fillOpacity={0.25}
        stroke="var(--fx-accent, #6366f1)"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {/* vertex dots */}
      {AXES.map((a) => {
        const [x, y] = point(cx, cy, R * (Math.max(0, Math.min(100, profile[a])) / 100), ANGLES[a]);
        return <circle key={a} cx={x} cy={y} r={3} fill="var(--fx-accent, #6366f1)" />;
      })}
      {/* axis labels + values */}
      {AXES.map((a) => {
        const [lx, ly] = point(cx, cy, R + 16, ANGLES[a]);
        const anchor = a === 'memory' ? 'middle' : lx < cx ? 'end' : 'start';
        return (
          <g key={a}>
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fontWeight={700} className="fill-slate-600">
              {t(`synapse.${a}`)}
            </text>
            <text x={lx} y={ly + 14} textAnchor={anchor} dominantBaseline="middle" fontSize={11} className="fill-slate-400 tabular-nums">
              {Math.round(profile[a])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
