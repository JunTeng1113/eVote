import { jsPDF } from "jspdf";
import { RESULT_PALETTE, formatPct } from "@/lib/results-ranking";

export type ResultExportItem = {
  id: string;
  name: string;
  party: string;
  votes: number;
};

export type ResultExportInput = {
  title: string;
  modeLabel: string;
  talliedAt: string;
  eligibleLabel: string;
  eligibleCount: number;
  totalVotes: number;
  turnout: string;
  items: ResultExportItem[];
};

const EXPORT_TOP_N = 12;

const FONT =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", "Segoe UI", sans-serif';

function safeFilename(title: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 40);
  return base.length > 0 ? base : "開票結果";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawPieSlice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: string,
) {
  if (endAngle - startAngle >= 359.999) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  const start = ((startAngle - 90) * Math.PI) / 180;
  const end = ((endAngle - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start, end, false);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function prepareExportRows(input: ResultExportInput): {
  rows: Array<ResultExportItem & { isOther?: boolean }>;
  totalOptions: number;
} {
  const sorted = [...input.items].sort((a, b) => {
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    return a.name.localeCompare(b.name, "zh-Hant");
  });
  const totalOptions = sorted.length;
  if (sorted.length <= EXPORT_TOP_N) {
    return { rows: sorted, totalOptions };
  }
  const head = sorted.slice(0, EXPORT_TOP_N);
  const rest = sorted.slice(EXPORT_TOP_N);
  const otherVotes = rest.reduce((sum, item) => sum + item.votes, 0);
  return {
    rows: [
      ...head,
      {
        id: "__other__",
        name: `其餘合計（${rest.length} 個選項）`,
        party: "",
        votes: otherVotes,
        isOther: true,
      },
    ],
    totalOptions,
  };
}

function renderResultsCanvas(
  input: ResultExportInput,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  const { rows, totalOptions } = prepareExportRows(input);
  const scale = width / 1920;
  const pad = 72 * scale;
  const total = Math.max(input.totalVotes, 1);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#eef5f7");
  bg.addColorStop(0.45, "#f7fafb");
  bg.addColorStop(1, "#e8f1f3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 28 * scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,28,36,0.12)";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  let y = pad + 56 * scale;
  const contentLeft = pad + 48 * scale;
  const contentWidth = width - pad * 2 - 96 * scale;

  ctx.fillStyle = "#0b4f6c";
  ctx.font = `600 ${Math.round(42 * scale)}px ${FONT}`;
  ctx.fillText("eVote 開票結果", contentLeft, y);

  y += 52 * scale;
  ctx.fillStyle = "#0f1c24";
  ctx.font = `600 ${Math.round(36 * scale)}px ${FONT}`;
  const title =
    input.title.length > 36 ? `${input.title.slice(0, 36)}…` : input.title;
  ctx.fillText(title, contentLeft, y);

  y += 34 * scale;
  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(20 * scale)}px ${FONT}`;
  const meta =
    totalOptions > EXPORT_TOP_N
      ? `${input.modeLabel}  ·  開票時間 ${input.talliedAt}  ·  共 ${totalOptions} 個選項（顯示前 ${EXPORT_TOP_N}）`
      : `${input.modeLabel}  ·  開票時間 ${input.talliedAt}`;
  ctx.fillText(meta, contentLeft, y);

  y += 48 * scale;
  const statW = (contentWidth - 32 * scale) / 3;
  const stats = [
    { label: input.eligibleLabel, value: String(input.eligibleCount) },
    { label: "有效票數", value: String(input.totalVotes) },
    { label: "投票率", value: input.turnout },
  ];
  stats.forEach((stat, index) => {
    const x = contentLeft + index * (statW + 16 * scale);
    ctx.fillStyle = "rgba(11,79,108,0.06)";
    roundRect(ctx, x, y, statW, 88 * scale, 14 * scale);
    ctx.fill();
    ctx.fillStyle = "#4d6470";
    ctx.font = `400 ${Math.round(16 * scale)}px ${FONT}`;
    ctx.fillText(stat.label, x + 18 * scale, y + 30 * scale);
    ctx.fillStyle = "#0f1c24";
    ctx.font = `600 ${Math.round(32 * scale)}px ${FONT}`;
    ctx.fillText(stat.value, x + 18 * scale, y + 68 * scale);
  });

  y += 130 * scale;

  const portrait = height / width > 1.2;
  const pieR = (portrait ? 160 : 130) * scale;
  const pieCx = portrait
    ? contentLeft + contentWidth / 2
    : contentLeft + 180 * scale;
  const pieCy = y + pieR + 20 * scale;
  let cursor = 0;
  rows.forEach((item, index) => {
    if (item.votes <= 0) {
      return;
    }
    const angle = (item.votes / total) * 360;
    drawPieSlice(
      ctx,
      pieCx,
      pieCy,
      pieR,
      cursor,
      cursor + angle,
      RESULT_PALETTE[index % RESULT_PALETTE.length]!,
    );
    cursor += angle;
  });
  ctx.beginPath();
  ctx.arc(pieCx, pieCy, pieR * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#0f1c24";
  ctx.font = `600 ${Math.round(24 * scale)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(input.totalVotes), pieCx, pieCy - 4 * scale);
  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(14 * scale)}px ${FONT}`;
  ctx.fillText("總票數", pieCx, pieCy + 20 * scale);
  ctx.textAlign = "left";

  const listLeft = portrait ? contentLeft : contentLeft + 380 * scale;
  const listWidth = portrait ? contentWidth : contentWidth - 380 * scale;
  let rowY = portrait ? pieCy + pieR + 48 * scale : y;
  const available = height - pad - 48 * scale - rowY - 24 * scale;
  const rowH = Math.min(
    56 * scale,
    available / Math.max(rows.length, 1) - 12 * scale,
  );

  rows.forEach((item, index) => {
    const pct = Math.round((item.votes / total) * 1000) / 10;
    const color = RESULT_PALETTE[index % RESULT_PALETTE.length]!;
    ctx.fillStyle = color;
    roundRect(
      ctx,
      listLeft,
      rowY + 8 * scale,
      16 * scale,
      16 * scale,
      4 * scale,
    );
    ctx.fill();

    ctx.fillStyle = "#0f1c24";
    ctx.font = `500 ${Math.round(20 * scale)}px ${FONT}`;
    const label =
      item.party.trim().length > 0
        ? `${item.name}（${item.party}）`
        : item.name;
    const clipped = label.length > 28 ? `${label.slice(0, 28)}…` : label;
    ctx.fillText(clipped, listLeft + 28 * scale, rowY + 22 * scale);

    ctx.fillStyle = "#4d6470";
    ctx.font = `400 ${Math.round(18 * scale)}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `${item.votes} 票（${formatPct(pct)}）`,
      listLeft + listWidth,
      rowY + 22 * scale,
    );
    ctx.textAlign = "left";

    const barY = rowY + 32 * scale;
    const barH = 10 * scale;
    ctx.fillStyle = "rgba(11,79,108,0.08)";
    roundRect(
      ctx,
      listLeft + 28 * scale,
      barY,
      listWidth - 28 * scale,
      barH,
      6 * scale,
    );
    ctx.fill();
    ctx.fillStyle = "#1b7a6e";
    roundRect(
      ctx,
      listLeft + 28 * scale,
      barY,
      Math.max(
        4 * scale,
        ((listWidth - 28 * scale) * Math.min(pct, 100)) / 100,
      ),
      barH,
      6 * scale,
    );
    ctx.fill();

    rowY += rowH + 12 * scale;
  });

  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(16 * scale)}px ${FONT}`;
  ctx.fillText(
    "由 eVote 匯出 · 僅供存檔與分享",
    contentLeft,
    height - pad - 28 * scale,
  );

  return canvas;
}

export async function exportResultsPdfA4(
  input: ResultExportInput,
): Promise<void> {
  const width = 1240;
  const height = 1754;
  const canvas = renderResultsCanvas(input, width, height);
  const dataUrl = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297);
  pdf.save(`${safeFilename(input.title)}-開票結果-A4.pdf`);
}

export async function exportResultsPng(
  input: ResultExportInput,
  ratio: "16:9" | "4:3",
): Promise<void> {
  const size =
    ratio === "16:9"
      ? { width: 1920, height: 1080 }
      : { width: 1600, height: 1200 };
  const canvas = renderResultsCanvas(input, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) {
    throw new Error("無法產生 PNG");
  }
  const suffix = ratio === "16:9" ? "16x9" : "4x3";
  downloadBlob(blob, `${safeFilename(input.title)}-開票結果-${suffix}.png`);
}
