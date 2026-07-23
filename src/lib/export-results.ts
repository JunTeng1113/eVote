import { jsPDF } from "jspdf";
import {
  RESULT_PALETTE,
  formatPct,
  legendItemsPerColumn,
} from "@/lib/results-ranking";

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

export type PngExportRatio = "16:9" | "4:3" | "9:16" | "3:4";
export type PdfOrientation = "portrait" | "landscape";

type LayoutKind = "landscape" | "portrait" | "portraitTall";

const FONT =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", "Segoe UI", sans-serif';

/** 約 300 DPI 的高解析度基準寬高（可依內容加高） */
const PNG_BASE: Record<PngExportRatio, { width: number; height: number }> = {
  "16:9": { width: 3840, height: 2160 },
  "4:3": { width: 3200, height: 2400 },
  "9:16": { width: 2160, height: 3840 },
  "3:4": { width: 2400, height: 3200 },
};

const A4_PX = {
  portrait: { width: 2480, height: 3508 },
  landscape: { width: 3508, height: 2480 },
} as const;

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

function sortAllRows(items: ResultExportItem[]): ResultExportItem[] {
  return [...items].sort((a, b) => {
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}

function layoutKindForRatio(ratio: PngExportRatio): LayoutKind {
  if (ratio === "16:9" || ratio === "4:3") {
    return "landscape";
  }
  if (ratio === "9:16") {
    return "portraitTall";
  }
  return "portrait";
}

function exportColumnCount(n: number, layout: LayoutKind): number {
  const perCol = legendItemsPerColumn(n);
  const needed = Math.max(1, Math.ceil(n / perCol));
  if (layout === "landscape") {
    return Math.min(Math.max(needed, n > 12 ? 2 : 1), 5);
  }
  if (layout === "portraitTall") {
    return Math.min(Math.max(needed, 1), 3);
  }
  return Math.min(Math.max(needed, n > 16 ? 2 : 1), 4);
}

function itemLabel(item: ResultExportItem): string {
  return item.party.trim().length > 0
    ? `${item.name}（${item.party}）`
    : item.name;
}

function measureContentHeight(
  width: number,
  rows: ResultExportItem[],
  layout: LayoutKind,
): number {
  const scale = width / 1920;
  const pad = 72 * scale;
  const n = Math.max(rows.length, 1);
  const cols = exportColumnCount(rows.length, layout);
  const perCol = Math.ceil(n / cols);
  const rowH = Math.max(44 * scale, 52 * scale - Math.min(n, 80) * 0.15 * scale);

  const headerBlock = 320 * scale;
  if (layout === "landscape") {
    const pieBlock = 380 * scale;
    const listH = perCol * (rowH + 10 * scale);
    return pad * 2 + headerBlock + Math.max(pieBlock, listH) + 64 * scale;
  }

  const pieBlock =
    layout === "portraitTall" ? 420 * scale : 480 * scale;
  const listH = perCol * (rowH + 10 * scale);
  return pad * 2 + headerBlock + pieBlock + listH + 72 * scale;
}

function renderResultsCanvas(
  input: ResultExportInput,
  width: number,
  height: number,
  layout: LayoutKind,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  const rows = sortAllRows(input.items);
  const scale = width / 1920;
  const pad = 72 * scale;
  const total = Math.max(input.totalVotes, 1);
  const cols = exportColumnCount(rows.length, layout);
  const perCol = Math.max(1, Math.ceil(Math.max(rows.length, 1) / cols));
  const rowH = Math.max(
    40 * scale,
    Math.min(56 * scale, 54 * scale - Math.min(rows.length, 100) * 0.12 * scale),
  );

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#eef5f7");
  bg.addColorStop(0.45, "#f7fafb");
  bg.addColorStop(1, "#e8f1f3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.94)";
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
  ctx.font = `600 ${Math.round(34 * scale)}px ${FONT}`;
  const title =
    input.title.length > 42 ? `${input.title.slice(0, 42)}…` : input.title;
  ctx.fillText(title, contentLeft, y);

  y += 34 * scale;
  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(18 * scale)}px ${FONT}`;
  ctx.fillText(
    `${input.modeLabel}  ·  開票時間 ${input.talliedAt}  ·  共 ${rows.length} 個選項（完整結果）`,
    contentLeft,
    y,
  );

  y += 44 * scale;
  const statW = (contentWidth - 32 * scale) / 3;
  const stats = [
    { label: input.eligibleLabel, value: String(input.eligibleCount) },
    { label: "有效票數", value: String(input.totalVotes) },
    { label: "投票率", value: input.turnout },
  ];
  stats.forEach((stat, index) => {
    const x = contentLeft + index * (statW + 16 * scale);
    ctx.fillStyle = "rgba(11,79,108,0.06)";
    roundRect(ctx, x, y, statW, 84 * scale, 14 * scale);
    ctx.fill();
    ctx.fillStyle = "#4d6470";
    ctx.font = `400 ${Math.round(15 * scale)}px ${FONT}`;
    ctx.fillText(stat.label, x + 18 * scale, y + 28 * scale);
    ctx.fillStyle = "#0f1c24";
    ctx.font = `600 ${Math.round(30 * scale)}px ${FONT}`;
    ctx.fillText(stat.value, x + 18 * scale, y + 64 * scale);
  });

  y += 118 * scale;

  const pieR =
    (layout === "landscape"
      ? 150
      : layout === "portraitTall"
        ? 130
        : 155) * scale;

  let listLeft = contentLeft;
  let listWidth = contentWidth;
  let listTop = y;
  let pieCx = contentLeft + contentWidth / 2;
  let pieCy = y + pieR + 16 * scale;

  if (layout === "landscape") {
    pieCx = contentLeft + pieR + 24 * scale;
    pieCy = y + pieR + 12 * scale;
    listLeft = contentLeft + pieR * 2 + 72 * scale;
    listWidth = contentWidth - (pieR * 2 + 72 * scale);
    listTop = y;
  } else {
    listTop = pieCy + pieR + 40 * scale;
  }

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
  ctx.font = `600 ${Math.round(22 * scale)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(input.totalVotes), pieCx, pieCy - 4 * scale);
  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(13 * scale)}px ${FONT}`;
  ctx.fillText("總票數", pieCx, pieCy + 18 * scale);
  ctx.textAlign = "left";

  const colGap = 20 * scale;
  const colW = (listWidth - colGap * (cols - 1)) / cols;
  const nameMax =
    layout === "landscape"
      ? Math.max(10, Math.floor(22 - cols * 2))
      : Math.max(12, Math.floor(28 - cols * 3));

  rows.forEach((item, index) => {
    const col = Math.floor(index / perCol);
    const row = index % perCol;
    const x = listLeft + col * (colW + colGap);
    const rowY = listTop + row * (rowH + 10 * scale);
    const pct = Math.round((item.votes / total) * 1000) / 10;
    const color = RESULT_PALETTE[index % RESULT_PALETTE.length]!;

    ctx.fillStyle = color;
    roundRect(ctx, x, rowY + 6 * scale, 12 * scale, 12 * scale, 3 * scale);
    ctx.fill();

    ctx.fillStyle = "#4d6470";
    ctx.font = `500 ${Math.round(13 * scale)}px ${FONT}`;
    ctx.fillText(`#${index + 1}`, x + 18 * scale, rowY + 16 * scale);

    ctx.fillStyle = "#0f1c24";
    ctx.font = `500 ${Math.round(15 * scale)}px ${FONT}`;
    const label = itemLabel(item);
    const clipped =
      label.length > nameMax ? `${label.slice(0, nameMax)}…` : label;
    ctx.fillText(clipped, x + 52 * scale, rowY + 16 * scale);

    ctx.fillStyle = "#4d6470";
    ctx.font = `400 ${Math.round(13 * scale)}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `${item.votes}（${formatPct(pct)}）`,
      x + colW,
      rowY + 16 * scale,
    );
    ctx.textAlign = "left";

    const barY = rowY + 24 * scale;
    const barH = 8 * scale;
    const barLeft = x + 18 * scale;
    const barW = colW - 18 * scale;
    ctx.fillStyle = "rgba(11,79,108,0.08)";
    roundRect(ctx, barLeft, barY, barW, barH, 4 * scale);
    ctx.fill();
    ctx.fillStyle = "#1b7a6e";
    roundRect(
      ctx,
      barLeft,
      barY,
      Math.max(3 * scale, (barW * Math.min(pct, 100)) / 100),
      barH,
      4 * scale,
    );
    ctx.fill();
  });

  ctx.fillStyle = "#4d6470";
  ctx.font = `400 ${Math.round(14 * scale)}px ${FONT}`;
  ctx.fillText(
    "由 eVote 匯出 · 高解析度完整結果 · 僅供存檔與分享",
    contentLeft,
    height - pad - 24 * scale,
  );

  return canvas;
}

function buildCanvas(
  input: ResultExportInput,
  width: number,
  minHeight: number,
  layout: LayoutKind,
): HTMLCanvasElement {
  const rows = sortAllRows(input.items);
  const needed = measureContentHeight(width, rows, layout);
  const height = Math.max(minHeight, Math.ceil(needed));
  return renderResultsCanvas(input, width, height, layout);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("無法產生 PNG"));
        return;
      }
      resolve(result);
    }, "image/png");
  });
}

function addCanvasPagesToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageWidthMm: number,
  pageHeightMm: number,
) {
  const dataUrl = canvas.toDataURL("image/png");
  const imgWidth = pageWidthMm;
  const imgHeight = (canvas.height * pageWidthMm) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeightMm;

  while (heightLeft > 0.5) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeightMm;
  }
}

export async function exportResultsPdfA4(
  input: ResultExportInput,
  orientation: PdfOrientation = "portrait",
): Promise<void> {
  const size = A4_PX[orientation];
  const layout: LayoutKind =
    orientation === "landscape" ? "landscape" : "portrait";
  const canvas = buildCanvas(input, size.width, size.height, layout);
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });
  const pageW = orientation === "landscape" ? 297 : 210;
  const pageH = orientation === "landscape" ? 210 : 297;
  addCanvasPagesToPdf(pdf, canvas, pageW, pageH);
  const suffix = orientation === "landscape" ? "A4橫向" : "A4直向";
  pdf.save(`${safeFilename(input.title)}-開票結果-${suffix}.pdf`);
}

export async function exportResultsPng(
  input: ResultExportInput,
  ratio: PngExportRatio,
): Promise<void> {
  const base = PNG_BASE[ratio];
  const layout = layoutKindForRatio(ratio);
  const canvas = buildCanvas(input, base.width, base.height, layout);
  const blob = await canvasToPngBlob(canvas);
  const suffix = ratio.replace(":", "x");
  downloadBlob(blob, `${safeFilename(input.title)}-開票結果-${suffix}.png`);
}
