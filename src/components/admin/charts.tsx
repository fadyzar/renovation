// Lightweight SVG chart components — no external dependencies

interface BarPoint { label: string; value: number }
interface LinePoint { label: string; value: number }
interface DonutSegment { label: string; value: number; color: string }

// ─── Bar Chart ────────────────────────────────────────────────────────────────

export function BarChart({ data, height = 160, color = '#3b82f6', formatValue = (v: number) => `$${v.toLocaleString()}` }: {
  data: BarPoint[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barAreaH = height - 32;
  const w = 100 / data.length;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1="0" y1={barAreaH * (1 - p)} x2="100" y2={barAreaH * (1 - p)}
            stroke="#374151" strokeWidth="0.3" strokeDasharray="1,1" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const barH = (d.value / max) * barAreaH;
          const x = i * w + w * 0.15;
          const bw = w * 0.7;
          const y = barAreaH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={barH} fill={color} rx="1" opacity="0.9" />
              <rect x={x} y={y} width={bw} height={Math.min(4, barH)} fill={color} rx="1" opacity="1" />
            </g>
          );
        })}
      </svg>
      {/* Labels */}
      <div className="absolute bottom-0 left-0 right-0 flex">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-xs text-gray-500 truncate">{d.label}</p>
          </div>
        ))}
      </div>
      {/* Hover values — shown as title tooltip on the bar */}
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

export function LineChart({ data, height = 120, color = '#3b82f6' }: {
  data: LinePoint[];
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  const pad = 8;
  const W = 100, H = height - 20;

  const pts = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((d.value - min) / range) * (H - pad * 2),
  }));

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace('#','')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
        <p className="text-xs text-gray-600">{data[0]?.label}</p>
        <p className="text-xs text-gray-600">{data[data.length - 1]?.label}</p>
      </div>
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

export function DonutChart({ segments, size = 120 }: {
  segments: DonutSegment[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return null;

  const cx = size / 2, cy = size / 2;
  const r = size * 0.4, ir = size * 0.25;
  let angle = -Math.PI / 2;

  function arc(start: number, end: number, outerR: number, innerR: number) {
    const x1 = cx + outerR * Math.cos(start), y1 = cy + outerR * Math.sin(start);
    const x2 = cx + outerR * Math.cos(end),   y2 = cy + outerR * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(start), iy1 = cy + innerR * Math.sin(start);
    const ix2 = cx + innerR * Math.cos(end),   iy2 = cy + innerR * Math.sin(end);
    const large = (end - start) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {segments.filter(s => s.value > 0).map((s, i) => {
        const sweep = (s.value / total) * 2 * Math.PI;
        const d = arc(angle, angle + sweep - 0.02, r, ir);
        angle += sweep;
        return <path key={i} d={d} fill={s.color} />;
      })}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.14} fill="white" fontWeight="600">
        {total}
      </text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({ data, color = '#3b82f6', width = 80, height = 32 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
