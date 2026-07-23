import {
  RESULT_PALETTE,
  preparePieItems,
  formatPct,
  legendItemsPerColumn,
  type PieChartMode,
} from "@/lib/results-ranking";

type Slice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

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
  mode = "all",
  topN = 8,
  showLegend = true,
  /** 圖例額外顯示 0 票選項（圓餅仍只畫有票切片） */
  includeZeroInLegend = false,
}: {
  items: Array<{ id: string; label: string; value: number }>;
  mode?: PieChartMode;
  topN?: number;
  showLegend?: boolean;
  includeZeroInLegend?: boolean;
}) {
  const prepared = preparePieItems(items, mode, topN);
  const total = prepared.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">尚無票數可繪製圖表</p>
    );
  }

  const colorById = new Map<string, string>();
  let colorIndex = 0;
  for (const item of prepared) {
    if (item.value <= 0) {
      continue;
    }
    colorById.set(
      item.id,
      RESULT_PALETTE[colorIndex % RESULT_PALETTE.length]!,
    );
    colorIndex += 1;
  }

  const pieSlices: Slice[] = prepared
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      color: colorById.get(item.id) ?? RESULT_PALETTE[0]!,
    }));

  const legendItems: Slice[] = (
    includeZeroInLegend ? prepared : prepared.filter((item) => item.value > 0)
  ).map((item) => ({
    ...item,
    color:
      item.value > 0
        ? (colorById.get(item.id) ?? RESULT_PALETTE[0]!)
        : "rgba(77,100,112,0.35)",
  }));

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 96;
  let cursor = 0;

  const perColumn = legendItemsPerColumn(legendItems.length);
  const columnCount = Math.max(1, Math.ceil(legendItems.length / perColumn));

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="投票結果圓餅圖"
        className="shrink-0"
      >
        {pieSlices.map((slice) => {
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
      {showLegend ? (
        <ul
          className="w-full gap-x-4 gap-y-2 text-sm"
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(${perColumn}, minmax(0, auto))`,
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
          {legendItems.map((slice) => {
            const pct = Math.round((slice.value / total) * 1000) / 10;
            return (
              <li key={slice.id} className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span className="shrink-0 text-[var(--muted-foreground)]">
                  {slice.value}（{formatPct(pct)}）
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
