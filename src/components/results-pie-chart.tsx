type Slice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

const PALETTE = [
  "#0b4f6c",
  "#1b7a6e",
  "#d97706",
  "#4d6470",
  "#0f766e",
  "#b45309",
  "#155e75",
  "#3f6212",
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function ResultsPieChart({
  items,
}: {
  items: Array<{ id: string; label: string; value: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">尚無票數可繪製圖表</p>
    );
  }

  const slices: Slice[] = items.map((item, index) => ({
    ...item,
    color: PALETTE[index % PALETTE.length]!,
  }));

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 96;
  let cursor = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="投票結果圓餅圖"
        className="shrink-0"
      >
        {slices.map((slice) => {
          if (slice.value <= 0) {
            return null;
          }
          const angle = (slice.value / total) * 360;
          const startAngle = cursor;
          const endAngle = cursor + angle;
          cursor = endAngle;
          if (angle >= 359.999) {
            return (
              <circle
                key={slice.id}
                cx={cx}
                cy={cy}
                r={r}
                fill={slice.color}
              />
            );
          }
          return (
            <path
              key={slice.id}
              d={describeSlice(cx, cy, r, startAngle, endAngle)}
              fill={slice.color}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={42} fill="var(--card)" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-[var(--foreground)] text-sm font-semibold"
          style={{ fontSize: 14 }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="fill-[var(--muted-foreground)]"
          style={{ fontSize: 11 }}
        >
          總票數
        </text>
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((slice) => {
          const pct = Math.round((slice.value / total) * 100);
          return (
            <li key={slice.id} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="shrink-0 text-[var(--muted-foreground)]">
                {slice.value}（{pct}%）
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
