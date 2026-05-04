import { jsPDF } from "jspdf";
import type { ReportDocument } from "../components/types";

// ─── Colour palette ──────────────────────────────────────────────────────────
const BLUE = [0, 84, 166] as const;       // Statewide brand blue
const DARK = [30, 41, 59] as const;       // slate-800
const MID = [100, 116, 139] as const;     // slate-500
const LIGHT = [241, 245, 249] as const;   // slate-100
const WHITE = [255, 255, 255] as const;
const GREEN = [34, 197, 94] as const;     // emerald-500
const RED_C = [239, 68, 68] as const;     // red-500
const AMBER = [245, 158, 11] as const;    // amber-500
const BORDER = [203, 213, 225] as const;  // slate-300

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rgb(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function fillRgb(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function strokeRgb(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function fmt(date: string) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(String(text || ""), maxWidth) as string[];
}

// ─── Public entry point ──────────────────────────────────────────────────────
export function buildReportPdf(document: ReportDocument): Blob {
  if (document.type === "PRESTART") return buildPreStartPdf(document);
  if (document.type === "SWMS") return buildSwmsPdf(document);
  return buildGeneralReportPdf(document);
}

// ─── Tri-state helper: true=Yes false=No null/undefined/"N/A"=N/A ─────────────
function tri(val: boolean | null | undefined | string): string {
  if (val === null || val === undefined || val === "N/A") return "N/A";
  if (val === true) return "Yes";
  if (val === false) return "No";
  return String(val);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-START OH&S AND SITE INSPECTION  —  Figma redesign
// ═══════════════════════════════════════════════════════════════════════════════
function buildPreStartPdf(doc: ReportDocument): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fd  = doc.formData;

  // ── Design tokens ───────────────────────────────────────────────────────────
  const W = 210, H = 297, M = 14;
  const cW = W - M * 2; // 182 mm content width

  const HDR_BLUE  = [43, 60, 200]   as const; // royal blue header
  const SEC_DARK  = [28, 36, 52]    as const; // dark navy section headers
  const PAGE_BG   = [240, 242, 248] as const; // light gray page background
  const ACCENT_B  = [59, 130, 246]  as const; // blue left-border on info items
  const G_PILL    = [34, 197, 94]   as const; // green YES pill
  const R_PILL    = [239, 68, 68]   as const; // red NO pill
  const SHADOW_C  = [210, 215, 228] as const; // card drop shadow
  const DIVIDER_C = [226, 232, 240] as const; // row divider line
  const T_DARK    = [17, 24, 39]    as const; // near-black text
  const T_GRAY    = [107, 114, 128] as const; // gray label / answer text
  const WHITE3    = [255, 255, 255] as const;

  // ── Report ID  e.g. SEC-2026-0504-001 ──────────────────────────────────────
  const rawDate = fd.documentDate || new Date().toISOString().slice(0, 10);
  const dObj    = new Date(rawDate + "T12:00:00");
  const rID     = `SEC-${dObj.getFullYear()}-`
                + `${String(dObj.getMonth() + 1).padStart(2, "0")}`
                + `${String(dObj.getDate()).padStart(2, "0")}-001`;

  // ── Page state ──────────────────────────────────────────────────────────────
  let y       = 0;
  let pageNum = 0;
  const footerDone = new Set<number>();

  function renderFooter() {
    if (footerDone.has(pageNum)) return;
    footerDone.add(pageNum);
    // Divider line
    strokeRgb(pdf, DIVIDER_C);
    pdf.setLineWidth(0.2);
    pdf.line(M, H - 14, W - M, H - 14);
    // Centre text
    rgb(pdf, T_GRAY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(
      "Statewide Escalator Cleaning Pty Ltd  ·  Pre-Start Safety Report",
      W / 2, H - 8, { align: "center" },
    );
    // Page number on the right
    pdf.text(`Page ${pageNum}`, W - M, H - 8, { align: "right" });
  }

  function ensureSpace(needed: number) {
    if (y + needed > H - 22) {
      renderFooter();
      startPage(false);
    }
  }

  function startPage(isFirst: boolean) {
    if (pageNum > 0) pdf.addPage();
    pageNum++;

    // Page background
    fillRgb(pdf, PAGE_BG);
    pdf.rect(0, 0, W, H, "F");

    if (isFirst) {
      // ── Big blue header ─────────────────────────────────────────────────────
      const hH = 40;
      fillRgb(pdf, HDR_BLUE);
      pdf.rect(0, 0, W, hH, "F");

      // Company name
      rgb(pdf, WHITE3);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("STATEWIDE", M, 17);
      pdf.setFontSize(9);
      pdf.text("ESCALATOR CLEANING", M, 26);

      // Report ID frosted pill
      const pW = 66, pH = 22, pX = W - M - pW, pY = (hH - pH) / 2;
      fillRgb(pdf, [62, 80, 218] as const);
      pdf.roundedRect(pX, pY, pW, pH, 3, 3, "F");
      strokeRgb(pdf, [100, 120, 240] as const);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(pX, pY, pW, pH, 3, 3, "S");
      rgb(pdf, [170, 190, 255] as const);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.text("REPORT ID", pX + pW / 2, pY + 7.5, { align: "center" });
      rgb(pdf, WHITE3);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.text(rID, pX + pW / 2, pY + 17, { align: "center" });

      y = hH + 8;
    } else {
      // ── Continuation mini-header ────────────────────────────────────────────
      fillRgb(pdf, HDR_BLUE);
      pdf.rect(0, 0, W, 12, "F");
      rgb(pdf, WHITE3);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("Statewide Escalator Cleaning", M, 8.5);
      pdf.setFont("helvetica", "normal");
      pdf.text("Pre-Start Safety Report", W - M, 8.5, { align: "right" });
      y = 18;
    }
  }

  // ── Drawing helpers ─────────────────────────────────────────────────────────

  /** White rounded card with subtle drop shadow */
  function card(cx: number, cy: number, cw: number, ch: number) {
    fillRgb(pdf, SHADOW_C);
    pdf.roundedRect(cx + 0.8, cy + 1, cw, ch, 4, 4, "F");
    fillRgb(pdf, WHITE3);
    pdf.roundedRect(cx, cy, cw, ch, 4, 4, "F");
  }

  /** Dark navy section header bar — rounded on top only */
  function sectionHeader(cx: number, cy: number, cw: number, label: string) {
    fillRgb(pdf, SEC_DARK);
    pdf.roundedRect(cx, cy, cw, 12, 4, 4, "F");
    pdf.rect(cx, cy + 6, cw, 6, "F"); // flatten bottom corners
    rgb(pdf, WHITE3);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(label, cx + 8, cy + 8.5);
  }

  /** Calculate how many lines a question wraps to and the resulting row height */
  function measure(question: string): { lines: string[]; h: number } {
    pdf.setFontSize(8.5);
    const lines = splitText(pdf, question, cW * 0.62);
    return { lines, h: Math.max(15, lines.length * 5.4 + 6) };
  }

  /** Single question/answer row inside a card */
  function qRow(
    cx: number, cy: number, cw: number,
    lines: string[], h: number,
    answer: string, isYesNo: boolean, isGood: boolean,
    showDivider: boolean,
  ) {
    if (showDivider) {
      strokeRgb(pdf, DIVIDER_C);
      pdf.setLineWidth(0.3);
      pdf.line(cx + 6, cy, cx + cw - 6, cy);
    }

    // Question text — vertically centred
    rgb(pdf, T_DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const textY = cy + (h - (lines.length - 1) * 5.4) / 2;
    pdf.text(lines, cx + 8, textY);

    // Answer — pill for YES/NO, plain text otherwise
    if (isYesNo && answer !== "N/A") {
      const col = isGood ? G_PILL : R_PILL;
      const pW = 24, pH = 9;
      const pX = cx + cw - 10 - pW;
      const pY = cy + (h - pH) / 2;
      fillRgb(pdf, col);
      pdf.roundedRect(pX, pY, pW, pH, 2.5, 2.5, "F");
      rgb(pdf, WHITE3);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text(answer.toUpperCase(), pX + pW / 2, pY + 6.3, { align: "center" });
    } else {
      rgb(pdf, T_GRAY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text(answer, cx + cw - 10, cy + h / 2 + 1.5, { align: "right" });
    }
  }

  // ── BEGIN RENDER ────────────────────────────────────────────────────────────
  startPage(true);

  // ── 1. Info card ─────────────────────────────────────────────────────────────
  const INFO_H = 52;
  ensureSpace(INFO_H + 6);
  card(M, y, cW, INFO_H);

  rgb(pdf, T_DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Pre-Start OH&S and Site Inspection", M + 8, y + 14);

  const dateTimeLine = fd.documentDate
    ? `${fmt(fd.documentDate)}${fd.startTime ? " " + fd.startTime + " AEST" : ""}`
    : "—";
  const itemW = (cW - 16) / 3;
  const infoY = y + 28;

  [
    { label: "Site Location", value: fd.preStartSiteLocation || "—" },
    { label: "Date",          value: dateTimeLine },
    { label: "Prepared by",   value: fd.preparedBy || "—" },
  ].forEach((item, i) => {
    const ix = M + 8 + i * itemW;
    // Blue left bar — 1.5 mm wide
    fillRgb(pdf, ACCENT_B);
    pdf.rect(ix, infoY, 1.5, 16, "F");
    // Label (small gray)
    rgb(pdf, T_GRAY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(item.label, ix + 4.5, infoY + 5.5);
    // Value (bold dark)
    rgb(pdf, T_DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const vl = splitText(pdf, item.value, itemW - 10);
    pdf.text(vl[0] ?? item.value, ix + 4.5, infoY + 13.5);
  });

  y += INFO_H + 12;

  // ── 2. Prestart Audit card ───────────────────────────────────────────────────
  type QItem = { q: string; a: string; isYesNo: boolean; isGood: boolean };

  const prestartQ: QItem[] = [
    { q: "What type of works are you performing?",
      a: fd.preStartWorkType || "—", isYesNo: false, isGood: true },
    { q: "What area will you be working?",
      a: fd.preStartArea || "—", isYesNo: false, isGood: true },
    { q: "What type of equipment are you working on?",
      a: fd.preStartEquipmentType === "Other"
          ? (fd.preStartEquipmentOther || "Other")
          : (fd.preStartEquipmentType || "—"),
      isYesNo: false, isGood: true },
    { q: "Have you completed a visual inspection prior to any works being carried out?",
      a: tri(fd.preStartVisualInspection as boolean | null),
      isYesNo: true, isGood: fd.preStartVisualInspection !== false },
  ];

  const prestartM = prestartQ.map(q => ({ ...q, ...measure(q.q) }));
  const prestartH = 12 + prestartM.reduce((s, r) => s + r.h, 0) + 4;

  ensureSpace(prestartH);
  card(M, y, cW, prestartH);
  sectionHeader(M, y, cW, "PRESTART AUDIT");

  let rY = y + 12;
  prestartM.forEach((row, i) => {
    qRow(M, rY, cW, row.lines, row.h, row.a, row.isYesNo, row.isGood, i > 0);
    rY += row.h;
  });
  y += prestartH + 6;

  // ── 3. Safety Audit card ─────────────────────────────────────────────────────
  const safetyQ: QItem[] = [
    { q: "Do you have the appropriate PPE to undertake the works?",
      a: tri(fd.preStartPpeAppropriate as boolean | null),
      isYesNo: true, isGood: fd.preStartPpeAppropriate !== false },
    { q: "Have you received a site induction?",
      a: tri(fd.preStartSiteInduction as boolean | null),
      isYesNo: true, isGood: fd.preStartSiteInduction !== false },
    { q: "Have you checked if our machinery is in good working order?",
      a: tri(fd.preStartMachineryGoodOrder as boolean | null),
      isYesNo: true, isGood: fd.preStartMachineryGoodOrder !== false },
    { q: "Have you completed your checks before mounting the machines on the escalator/travelator?",
      a: tri(fd.preStartPreMountChecks as boolean | null),
      isYesNo: true, isGood: fd.preStartPreMountChecks !== false },
    { q: "Have you checked if the escalator/travelator drives in reverse prior to starting works?",
      a: tri(fd.preStartReverseCheck as boolean | null),
      isYesNo: true, isGood: fd.preStartReverseCheck !== false },
    { q: "Is there any damage or concerns on the escalator/travelator?",
      a: tri(fd.preStartConcernsDamage as boolean | null),
      isYesNo: true, isGood: fd.preStartConcernsDamage !== true },
    { q: "Have you used maintenance barricades to block off the escalator/travelator?",
      a: tri(fd.preStartBarricades as boolean | null),
      isYesNo: true, isGood: fd.preStartBarricades !== false },
  ];

  const safetyM = safetyQ.map(q => ({ ...q, ...measure(q.q) }));
  const safetyH = 12 + safetyM.reduce((s, r) => s + r.h, 0) + 4;

  ensureSpace(safetyH);
  card(M, y, cW, safetyH);
  sectionHeader(M, y, cW, "SAFETY AUDIT");

  rY = y + 12;
  safetyM.forEach((row, i) => {
    qRow(M, rY, cW, row.lines, row.h, row.a, row.isYesNo, row.isGood, i > 0);
    rY += row.h;
  });
  y += safetyH + 6;

  // ── 4. Comments card (only if filled) ────────────────────────────────────────
  if (fd.preStartAnyConcerns) {
    pdf.setFontSize(8.5);
    const cLines = splitText(pdf, String(fd.preStartAnyConcerns), cW - 20);
    const commH = 12 + cLines.length * 5.5 + 10;
    ensureSpace(commH);
    card(M, y, cW, commH);
    sectionHeader(M, y, cW, "COMMENTS");
    rgb(pdf, T_DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(cLines, M + 8, y + 21);
    y += commH + 6;
  }

  // ── 5. Signature card ────────────────────────────────────────────────────────
  const SIG_H = 48;
  ensureSpace(SIG_H);
  card(M, y, cW, SIG_H);

  rgb(pdf, T_DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Supervisor Signature", M + 8, y + 14);

  // Signature box
  const sbX = M + 8, sbY = y + 20, sbW = 58, sbH = 22;
  fillRgb(pdf, PAGE_BG);
  pdf.roundedRect(sbX, sbY, sbW, sbH, 3, 3, "F");
  strokeRgb(pdf, DIVIDER_C);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(sbX, sbY, sbW, sbH, 3, 3, "S");

  const sigData = fd.preStartSignature as string | undefined;
  if (sigData && sigData.startsWith("data:image")) {
    // Render the actual drawn signature inside the box
    try {
      pdf.addImage(sigData, "PNG", sbX + 2, sbY + 2, sbW - 4, sbH - 4);
    } catch (_) {
      // Fallback placeholder if image fails
      rgb(pdf, T_GRAY);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.text("[Signature]", sbX + sbW / 2, sbY + sbH / 2 + 2.5, { align: "center" });
    }
  } else {
    rgb(pdf, T_GRAY);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.text("[Signature]", sbX + sbW / 2, sbY + sbH / 2 + 2.5, { align: "center" });
  }

  // Name + date to the right of box
  const siX = sbX + sbW + 10;
  rgb(pdf, T_DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(fd.preStartWorkerNames || fd.preparedBy || "—", siX, sbY + 9);
  rgb(pdf, T_GRAY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const sigDate = fd.documentDate
    ? `${fmt(fd.documentDate)}${fd.startTime ? " " + fd.startTime + " AEST" : ""}`
    : "—";
  pdf.text(sigDate, siX, sbY + 18);

  y += SIG_H + 10;

  // ── Footer on last page ──────────────────────────────────────────────────────
  renderFooter();

  return pdf.output("blob");
}

// ── Cover row helper ──────────────────────────────────────────────────────────
function coverRow(pdf: jsPDF, x: number, y: number, w: number, pairs: [string, string][]) {
  const cellW = w / pairs.length;
  fillRgb(pdf, LIGHT);
  pdf.rect(x, y, w, 10, "F");
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pairs.forEach(([label, value], i) => {
    const cx = x + i * cellW;
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text(label, cx + 2, y + 4.5);
    rgb(pdf, MID);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(value, cx + cellW - 2, y + 7, { align: "right" });
    if (i > 0) pdf.line(cx, y, cx, y + 10);
  });
  pdf.rect(x, y, w, 10, "S");
}

function metaRow(pdf: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, 8, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(label, x + 2, y + 5.5);
  rgb(pdf, MID);
  pdf.setFont("helvetica", "normal");
  pdf.text(value, x + w - 2, y + 5.5, { align: "right" });
}

function pageHeader(pdf: jsPDF, W: number, margin: number) {
  fillRgb(pdf, BLUE);
  pdf.rect(0, 0, W, 10, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("safetyculture.com", margin, 6.5);
  pdf.setFontSize(7);
  pdf.text("Powered by SafetyCulture", W - margin, 6.5, { align: "right" });
}

function preStartPageHeader(pdf: jsPDF, W: number, margin: number) {
  fillRgb(pdf, BLUE);
  pdf.rect(0, 0, W, 10, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("Statewide Escalator Cleaning", margin, 6.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("Pre-Start Safety Report", W - margin, 6.5, { align: "right" });
}

function auditSection(pdf: jsPDF, x: number, y: number, w: number, label: string, score: string) {
  fillRgb(pdf, DARK);
  pdf.rect(x, y, w, 9, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(label, x + 2, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(score, x + w - 2, y + 6, { align: "right" });
}

function auditTextRow(pdf: jsPDF, x: number, y: number, w: number, question: string, answer: string): number {
  const qLines = splitText(pdf, question, w * 0.6);
  const rowH = Math.max(10, qLines.length * 5 + 4);
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, rowH, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(qLines, x + 2, y + 5);
  rgb(pdf, MID);
  pdf.setFont("helvetica", "normal");
  pdf.text(answer, x + w - 2, y + 5, { align: "right" });
  return y + rowH;
}

function auditGreenRow(pdf: jsPDF, x: number, y: number, w: number, question: string, answer: string, isGreen = true): number {
  const qLines = splitText(pdf, question, w * 0.62);
  const rowH = Math.max(10, qLines.length * 5 + 4);
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, rowH, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(qLines, x + 2, y + 5);

  const badgeW = 26;
  const badgeX = x + w - badgeW - 1;
  const badgeY = y + (rowH - 8) / 2;

  // N/A = neutral grey badge
  const badgeColor = answer === "N/A" ? MID : (isGreen ? GREEN : RED_C);
  fillRgb(pdf, badgeColor);
  pdf.roundedRect(badgeX, badgeY, badgeW, 8, 1, 1, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(answer, badgeX + badgeW / 2, badgeY + 5.5, { align: "center" });
  return y + rowH;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWMS / JSEA
// ═══════════════════════════════════════════════════════════════════════════════
function buildSwmsPdf(doc: ReportDocument): Blob {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fd = doc.formData;
  const W = 297;
  const H = 210;
  const margin = 12;
  const colW = W - margin * 2;

  // ── Page 1: Cover / Part 1 ─────────────────────────────────────────────────
  swmsHeader(pdf, W, margin);
  let y = 42;

  // Title
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Job Safety and Environmental Analysis (JSEA) and Safe Work Method Statement (SWMS)", W / 2, y, { align: "center" });
  y += 6;
  pdf.text("Statewide Escalator Cleaning Pty Ltd", W / 2, y, { align: "center" });
  y += 8;

  // Part 1 header
  partHeader(pdf, margin, y, colW, "Part 1: Project and Task Identification");
  y += 8;

  // Process note
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, colW, 18, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bolditalic");
  pdf.setFontSize(7.5);
  const processText = "Process Initiators of SWMSs are responsible for consulting the Project Supervisor, Quality WHS Manager or other persons directly in charge of the work and other personnel involved in the execution of the task (as appropriate) for input into the SWMS. Other persons may be consulted for technical advice or review of the SWMS to see that proposed measures are effective and workable. The task is to be broken up into steps. For each step, the safety hazards are identified. For each of the hazards identified, corrective action, precautions, equipment are identified to reduce the hazard. All involved in the task must review and sign this SWMS form.";
  const processLines = splitText(pdf, processText, colW - 4);
  pdf.text(processLines, margin + 2, y + 4);
  y += 22;

  // Client & Job Site
  twoColRow(pdf, margin, y, colW, "Client:", fd.swmsClientName || "", "Job Site:", fd.swmsJobSiteAddress || "", 12);
  y += 8;

  // Contact table
  const contactHeaders = ["Contact Name", "Job Title", "Phone", "Mobile", "Email"];
  const contactVals = [
    fd.swmsContactName || "",
    fd.swmsContactTitle || "",
    fd.swmsContactPhone || "",
    fd.swmsContactMobile || "",
    fd.swmsContactEmail || "",
  ];
  tableRow(pdf, margin, y, colW, contactHeaders, contactVals, 8, true);
  y += 8;
  const contactData = [contactVals];
  tableDataRows(pdf, margin, y, colW, [20, 20, 15, 15, 30], contactData, 7);
  y += 8;

  // SWMS meta block
  const leftW = colW * 0.22;
  const midW = colW * 0.26;
  const _rightW = colW - leftW - midW; void _rightW;

  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, colW, 28, "S");

  // SWMS Initiated By
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, leftW, 14, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("SWMS Initiated By", margin + 2, y + 5);
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(fd.swmsInitiatedBy || "", margin + 2, y + 11);

  // Date (large)
  const dateX = margin + leftW;
  strokeRgb(pdf, BORDER);
  pdf.line(dateX, y, dateX, y + 28);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  rgb(pdf, DARK);
  pdf.text("Date:", dateX + 2, y + 5);
  pdf.setFontSize(18);
  const displayDate = fd.documentDate ? fmt(fd.documentDate).replace(/\//g, "/") : "";
  pdf.text(displayDate, dateX + 2, y + 14);

  // SWMS No / Rev
  const rightX = margin + leftW + midW;
  strokeRgb(pdf, BORDER);
  pdf.line(rightX, y, rightX, y + 28);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  rgb(pdf, DARK);
  pdf.text(`SWMS No. ${fd.swmsNumber || "1"}`, rightX + 2, y + 5);
  pdf.text(`Rev: ${fd.swmsRev || "1"}`, rightX + 30, y + 5);
  pdf.text(`Rev Date: ${fd.swmsRevDate || ""}`, rightX + 50, y + 5);

  y += 14;
  // Supervisor Review row
  pdf.line(margin, y, margin + colW, y);
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, leftW, 14, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Supervisor Review", margin + 2, y + 5);
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(fd.swmsSupervisorReview || "", margin + 2, y + 11);

  const dateX2 = margin + leftW;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Date:", dateX2 + 2, y + 5);

  // Work Locations
  pdf.text("Work Locations/ Areas:", rightX + 2, y + 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(fd.swmsWorkLocations || "", rightX + 2, y + 11);

  y += 14;
  // Management Review row
  pdf.line(margin, y, margin + colW, y);
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, leftW, 14, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Management Review", margin + 2, y + 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(fd.swmsManagementReview || "", margin + 2, y + 11);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Date:", dateX2 + 2, y + 5);

  swmsFooter(pdf, W, H, margin, 1);

  // ── Page 2: Description + Hierarchy of Controls ────────────────────────────
  pdf.addPage();
  swmsHeader(pdf, W, margin);
  y = 42;

  // Description of Work
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, colW, 10, "S");
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, 75, 10, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Description of Work to be Undertaken:", margin + 2, y + 6.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("Escalator Cleaning", margin + 78, y + 6.5);
  y += 12;

  // Hierarchy table
  const hierHeaders = ["LEVEL", "CONTROL", "DEFINITION"];
  const hierRows = [
    ["Level 1", "Elimination", "Controlling the Hazard at source"],
    ["Level 2", "Substitution", "Replacing one substance or Activity with a less hazardous one"],
    ["", "Isolation", "Separating the hazard from the person"],
    ["", "Engineering", "Guards on machinery"],
    ["Level 3", "Administration", "Implementing policies and procedures for safe work practices"],
    ["", "Personal Protective Equipment", "Use of safety glasses, gloves, high visibility vest."],
  ];

  const hw = colW / 3;
  tableRow(pdf, margin, y, colW, hierHeaders, [], 8, true);
  y += 8;
  hierRows.forEach((row) => {
    const rowH = 7;
    if (row[1] === "Substitution" || row[0] === "Level 2") {
      // no special handling needed
    }
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, colW, rowH, "S");
    pdf.line(margin + hw, y, margin + hw, y + rowH);
    pdf.line(margin + hw * 2, y, margin + hw * 2, y + rowH);
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const col1Lines = splitText(pdf, row[0], hw - 4);
    const col2Lines = splitText(pdf, row[1], hw - 4);
    const col3Lines = splitText(pdf, row[2], hw - 4);
    pdf.text(col1Lines, margin + 2, y + 4.5);
    pdf.text(col2Lines, margin + hw + 2, y + 4.5);
    pdf.text(col3Lines, margin + hw * 2 + 2, y + 4.5);
    y += rowH;
  });

  // Hierarchy of Controls diagram (text-based)
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  rgb(pdf, DARK);
  pdf.text("Hierarchy of Controls", W / 2, y, { align: "center" });
  y += 8;

  const levels = [
    { text: "Eliminate the hazard", color: [21, 128, 61] as const, w: 100 },
    { text: "Substitute the hazard", color: [22, 163, 74] as const, w: 85 },
    { text: "Isolate the hazard", color: [34, 197, 94] as const, w: 70 },
    { text: "Use engineering controls", color: [234, 179, 8] as const, w: 55 },
    { text: "Use administrative controls", color: [249, 115, 22] as const, w: 40 },
    { text: "Use PPE", color: [239, 68, 68] as const, w: 25 },
  ];

  const pyramidCx = W / 2 - 10;
  levels.forEach((lev, i) => {
    const bw = lev.w;
    const bx = pyramidCx - bw / 2;
    fillRgb(pdf, lev.color);
    pdf.rect(bx, y + i * 9, bw, 8, "F");
    rgb(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(lev.text, pyramidCx, y + i * 9 + 5.5, { align: "center" });
  });

  // Effectiveness arrow
  const arrowX = pyramidCx + 57;
  fillRgb(pdf, [34, 197, 94]);
  pdf.rect(arrowX, y, 5, 50, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  const effText = "E\nf\nf\ne\nc\nt\ni\nv\ne\nn\ne\ns\ns";
  effText.split("\n").forEach((ch, i) => {
    pdf.text(ch, arrowX + 2.5, y + 3 + i * 3.8, { align: "center" });
  });

  swmsFooter(pdf, W, H, margin, 2);

  // ── Page 3: Part 2 – Worker Qualifications & Sign-Off ─────────────────────
  pdf.addPage();
  swmsHeader(pdf, W, margin);
  y = 42;

  partHeader(pdf, margin, y, colW, "Part 2: Worker Qualifications and Induction Record");
  y += 8;

  // Qualifications table
  const qualHeaders = [
    "Personal Qualifications and Experience Required To Carry Out the Works:",
    "Duties and Responsibilities of Personnel Completing the Task:",
    "Formal or Specialised Training or Licenses Required to Complete Work or Operate Specific Equipment:",
  ];
  const qw = colW / 3;
  tableRow(pdf, margin, y, colW, qualHeaders, [], 8, true);
  y += 12;

  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, y, colW, 28, "S");
  pdf.line(margin + qw, y, margin + qw, y + 28);
  pdf.line(margin + qw * 2, y, margin + qw * 2, y + 28);

  rgb(pdf, DARK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  const q1 = splitText(pdf, "Demonstrated competency in cleaning procedures and use of cleaning products and machinery.", qw - 4);
  const q2Lines = [
    "Adherence to company's and the site's WH&S policies and procedures",
    "Maintain adequate house-keeping on site",
    "Reporting of any injuries / incidents to the Project Supervisor",
    "Operate safely and perform daily pre-shift inspections",
  ];
  const q3 = splitText(pdf, "Competency in the Safe Operating Procedure of the selected machinery", qw - 4);
  pdf.text(q1, margin + 2, y + 5);
  q2Lines.forEach((line, i) => {
    pdf.text(`• ${line}`, margin + qw + 2, y + 5 + i * 5.5);
  });
  pdf.text(q3, margin + qw * 2 + 2, y + 5);
  y += 32;

  // SWMS Sign Off table
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, colW, 14, "F");
  strokeRgb(pdf, BORDER);
  pdf.rect(margin, y, colW, 14, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("SWMS Sign Off – Your signature below indicates that you have been consulted in development of", W / 2, y + 5, { align: "center" });
  pdf.text("the SWMS and accept and will implement the requirements of the SWMS and control measures", W / 2, y + 10, { align: "center" });
  y += 14;

  // Sign-off table header
  const signCols = [8, 45, 35, 40, 55, 30];
  const signHeaders = ["No.", "Name", "Classification", "Employed By", "Signature", "Date"];
  let sx = margin;
  signHeaders.forEach((h, i) => {
    const cw = (colW * signCols[i]) / signCols.reduce((a, b) => a + b, 0);
    fillRgb(pdf, LIGHT);
    pdf.rect(sx, y, cw, 8, "F");
    strokeRgb(pdf, BORDER);
    pdf.rect(sx, y, cw, 8, "S");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(h, sx + 1.5, y + 5);
    sx += cw;
  });
  y += 8;

  const workers = fd.swmsWorkers ?? [];
  for (let i = 0; i < 10; i++) {
    const worker = workers[i];
    const rowH = 8;
    sx = margin;
    const totalW = signCols.reduce((a, b) => a + b, 0);
    signCols.forEach((cRaw, ci) => {
      const cw = (colW * cRaw) / totalW;
      strokeRgb(pdf, BORDER);
      pdf.setLineWidth(0.2);
      pdf.rect(sx, y, cw, rowH, "S");
      rgb(pdf, DARK);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      let cellText = "";
      if (worker) {
        if (ci === 0) cellText = String(i + 1);
        else if (ci === 1) cellText = worker.name;
        else if (ci === 2) cellText = worker.classification;
        else if (ci === 3) cellText = worker.employedBy;
        else if (ci === 4) cellText = ""; // signature
        else if (ci === 5) cellText = worker.date ? fmt(worker.date) : "";
      } else if (ci === 0) {
        cellText = String(i + 1);
      }
      if (cellText) pdf.text(cellText, sx + 1.5, y + 5.5);
      sx += cw;
    });
    y += rowH;
  }

  swmsFooter(pdf, W, H, margin, 3);

  // ── Pages 4-10: Part 3 – Hazard Analysis Table ────────────────────────────
  const hazardData = getHazardData();
  const groups = groupHazardRows(hazardData, 14);
  groups.forEach((rows, pageIndex) => {
    pdf.addPage();
    swmsHeader(pdf, W, margin);
    y = 42;
    if (pageIndex === 0) {
      partHeader(pdf, margin, y, colW, "Part 3: Hazard Analysis, Control and Legislation Worksheet");
      y += 8;
    }
    y = renderHazardTable(pdf, margin, y, colW, rows, pageIndex === 0);
    swmsFooter(pdf, W, H, margin, 4 + pageIndex);
  });

  const nextPage = 4 + groups.length;

  // ── Risk Calculator page ───────────────────────────────────────────────────
  pdf.addPage();
  swmsHeader(pdf, W, margin);
  y = 42;
  renderRiskCalculator(pdf, margin, y, colW);
  swmsFooter(pdf, W, H, margin, nextPage);

  // ── Part 4: Site modifications (blank) ────────────────────────────────────
  pdf.addPage();
  swmsHeader(pdf, W, margin);
  y = 42;

  partHeader(pdf, margin, y, colW, "Part 4: Hazard Analysis, Control and Legislation Worksheet - Site modifications, additions or alterations");
  y += 8;
  y = renderHazardTable(pdf, margin, y, colW, [], true, true);

  // Reference section
  y += 4;
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, colW, 9, "S");
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, colW * 0.4, 9, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Reference and Detail Applicable Sections of:", margin + 2, y + 6);
  pdf.setFont("helvetica", "normal");
  const refs = ["Legislation", "Codes of Practice", "Manufacturer or Supplier  Recommendations"];
  const refX = margin + colW * 0.4 + 4;
  refs.forEach((ref, i) => {
    const rx = refX + i * 60;
    // Checkbox
    pdf.rect(rx, y + 2, 4, 4, "S");
    fillRgb(pdf, DARK);
    pdf.rect(rx + 0.5, y + 2.5, 3, 3, "F");
    rgb(pdf, DARK);
    pdf.text(ref, rx + 6, y + 6);
  });
  y += 11;

  // Legislation refs
  const legalRefs = [
    "Work Health and Safety Regulations 2017 under the Work Health and Safety Act 2011",
    "Hazardous Manual Tasks Code of Practice",
    "Managing Electrical Risks in the Workplace Code of Practice",
  ];
  legalRefs.forEach((ref) => {
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, colW, 7, "S");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(ref, margin + 2, y + 5);
    y += 7;
  });

  swmsFooter(pdf, W, H, margin, nextPage + 1);

  // ── Last page: Equipment + PPE ─────────────────────────────────────────────
  pdf.addPage();
  swmsHeader(pdf, W, margin);
  y = 42;

  // Equipment table
  const halfW = colW / 2;
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, colW, 9, "S");
  pdf.line(margin + halfW, y, margin + halfW, y + 9);
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, halfW, 9, "F");
  fillRgb(pdf, LIGHT);
  pdf.rect(margin + halfW, y, halfW, 9, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Equipment to be used for task:", margin + 2, y + 6);
  pdf.text("Equipment and Area Safety Inspections:", margin + halfW + 2, y + 6);
  y += 9;

  const equipLeft = ["Escalator and/or Travelator Machines", "Safety Data Sheet", "", ""];
  const equipRight = ["Electrical cords to be tested and tagged and current", "Machinery Pre Operational Checks", "Escalator Cleaner", ""];

  equipLeft.forEach((eq, i) => {
    const rowH = 7;
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, colW, rowH, "S");
    pdf.line(margin + halfW, y, margin + halfW, y + rowH);
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    if (eq) pdf.text(eq, margin + 2, y + 5);
    if (equipRight[i]) pdf.text(equipRight[i], margin + halfW + 2, y + 5);
    y += rowH;
  });
  y += 4;

  // PPE section
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, colW, 32, "S");
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, 42, 32, "F");
  pdf.line(margin + 42, y, margin + 42, y + 32);
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  const ppeLabel = splitText(pdf, "Mandatory Personal Protection Equipment (PPE) to carry out the activity; Long pants, long sleeved shirt, safety glasses, steel capped boots, high visibility vest, gloves, hearing protection.", 38);
  pdf.text(ppeLabel, margin + 1, y + 5);

  // PPE icons (circles as placeholder)
  const ppeColors: Array<readonly [number, number, number]> = [
    [59, 130, 246], [59, 130, 246], [59, 130, 246], [59, 130, 246],
    [59, 130, 246], [59, 130, 246], [59, 130, 246],
  ];
  const ppeLabels = ["PPE\nSafety", "Coverall", "Glasses", "Boots", "Hi-Vis", "Gloves", "Hearing"];
  ppeColors.forEach((c, i) => {
    const cx = margin + 48 + i * 30;
    const cy = y + 16;
    fillRgb(pdf, c);
    pdf.circle(cx, cy, 10, "F");
    rgb(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    const pLines = ppeLabels[i].split("\n");
    pLines.forEach((pl, pi) => {
      pdf.text(pl, cx, cy - 1 + pi * 4, { align: "center" });
    });
  });

  y += 36;

  // Safety signage & electrical tagging
  const sigW = halfW - 2;
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, y, sigW, 28, "S");
  pdf.line(margin + 30, y, margin + 30, y + 28);
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, y, 30, 28, "F");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  const sigLabel = splitText(pdf, "Required safety signage to carry out the activity; to be placed at both the top and bottom of the escalator/ travelator landings.", 26);
  pdf.text(sigLabel, margin + 1, y + 5);
  // Caution barrier placeholder
  fillRgb(pdf, [234, 179, 8]);
  pdf.rect(margin + 33, y + 4, 18, 18, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.text("CAUTION", margin + 42, y + 10, { align: "center" });
  pdf.text("TRI-PANEL", margin + 42, y + 14, { align: "center" });
  pdf.text("BARRIER", margin + 42, y + 18, { align: "center" });
  rgb(pdf, MID);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Caution Tri-Panel Barrier", margin + 42, y + 25, { align: "center" });

  // Electrical tagging
  const tagX = margin + halfW + 2;
  strokeRgb(pdf, BORDER);
  pdf.rect(tagX, y, sigW, 28, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("ELECTRICAL TAGGING COLOURS:", tagX + 2, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);

  fillRgb(pdf, RED_C);
  pdf.rect(tagX + 2, y + 10, 3, 3, "F");
  rgb(pdf, DARK);
  pdf.text("RED - December to February", tagX + 7, y + 13);

  fillRgb(pdf, GREEN);
  pdf.rect(tagX + 2, y + 16, 3, 3, "F");
  rgb(pdf, DARK);
  pdf.text("GREEN - March to May", tagX + 7, y + 19);

  fillRgb(pdf, [59, 130, 246]);
  pdf.rect(tagX + 2, y + 22, 3, 3, "F");
  rgb(pdf, DARK);
  pdf.text("BLUE - June to August", tagX + 7, y + 25);

  fillRgb(pdf, AMBER);
  pdf.rect(tagX + 70, y + 10, 3, 3, "F");
  rgb(pdf, DARK);
  pdf.text("YELLOW - September to November", tagX + 75, y + 13);

  swmsFooter(pdf, W, H, margin, nextPage + 2);

  return pdf.output("blob");
}

// ─── SWMS helpers ─────────────────────────────────────────────────────────────
function swmsHeader(pdf: jsPDF, W: number, margin: number) {
  // Logo area
  fillRgb(pdf, LIGHT);
  pdf.rect(margin, 8, 48, 22, "F");
  rgb(pdf, BLUE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("STATEWIDE", margin + 2, 16);
  pdf.setFontSize(7);
  rgb(pdf, MID);
  pdf.text("ESCALATOR CLEANING", margin + 2, 22);

  // Right header box
  const rightX = W - margin - 90;
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.4);
  pdf.rect(rightX, 8, 90, 22, "S");
  pdf.line(rightX, 18, rightX + 90, 18);
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("Job Safety and Environmental Analysis (JSEA) and", rightX + 2, 13);
  pdf.text("Safe Work Method Statement (SWMS)", rightX + 2, 18.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("Statewide Escalator Cleaning Pty Ltd", rightX + 2, 25);

  // Separator line
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 32, W - margin, 32);
}

function swmsFooter(pdf: jsPDF, W: number, H: number, margin: number, pageNum: number) {
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.line(margin, H - 14, W - margin, H - 14);
  rgb(pdf, MID);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Statewide Escalator Cleaning Pty Ltd_JSEA&SWMS", margin, H - 10);
  pdf.text("The information contained in this document is confidential and may not be disclosed to any party that is not a party to this document.", W / 2, H - 5, { align: "center" });

  // Page number badge
  fillRgb(pdf, DARK);
  pdf.roundedRect(W - margin - 10, H - 14, 10, 10, 1, 1, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(String(pageNum), W - margin - 5, H - 7.5, { align: "center" });
}

function partHeader(pdf: jsPDF, x: number, y: number, w: number, text: string) {
  fillRgb(pdf, LIGHT);
  pdf.rect(x, y, w, 8, "F");
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, w, 8, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(text, x + 2, y + 5.5);
}

function tableRow(pdf: jsPDF, x: number, y: number, w: number, headers: string[], _values: string[], fontSize: number, isHeader: boolean) {
  fillRgb(pdf, isHeader ? LIGHT : WHITE);
  pdf.rect(x, y, w, 9, "F");
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, 9, "S");
  const colW = w / headers.length;
  headers.forEach((h, i) => {
    const cx = x + i * colW;
    if (i > 0) pdf.line(cx, y, cx, y + 9);
    rgb(pdf, DARK);
    pdf.setFont("helvetica", isHeader ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    const lines = splitText(pdf, h, colW - 4);
    pdf.text(lines, cx + 2, y + 5.5);
  });
}

function tableDataRows(pdf: jsPDF, x: number, y: number, _w: number, _colWidths: number[], rows: string[][], fontSize: number) {
  rows.forEach((row) => {
    let cx = x;
    row.forEach((cell) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      rgb(pdf, DARK);
      pdf.text(cell, cx + 2, y + 5);
      cx += 40;
    });
    y += 7;
  });
}

function twoColRow(pdf: jsPDF, x: number, y: number, w: number, l1: string, v1: string, l2: string, v2: string, h: number) {
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, w, h, "S");
  pdf.line(x + w / 2, y, x + w / 2, y + h);
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(l1, x + 2, y + h / 2 + 1.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(v1, x + 20, y + h / 2 + 1.5);
  pdf.setFont("helvetica", "bold");
  pdf.text(l2, x + w / 2 + 2, y + h / 2 + 1.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(v2, x + w / 2 + 20, y + h / 2 + 1.5);
}

// ─── Hazard table data (static from the SWMS template) ───────────────────────
type HazardRow = {
  step: string;
  sectionTitle?: string;
  processStep: string;
  hazard: string;
  riskRating: string;
  controlMeasure: string;
  newRisk: string;
  actionBy: string;
};

function getHazardData(): HazardRow[] {
  return [
    { step: "1", sectionTitle: "Site Orientation/ Induction", processStep: "", hazard: "", riskRating: "", controlMeasure: "", newRisk: "", actionBy: "" },
    { step: "1.1", processStep: "Report to clients reception; Sign in", hazard: "Entering restricted areas", riskRating: "HIGH", controlMeasure: "Follow posted signs and go directly to reception", newRisk: "LOW", actionBy: "All" },
    { step: "1.2", processStep: "Undertake a site inspection", hazard: "Unfamiliarity with emergency procedures", riskRating: "HIGH", controlMeasure: "Listen and ensure you obtain information and site emergency and evacuation procedures", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Unawareness of site-specific hazards", riskRating: "HIGH", controlMeasure: "Listen and ensure you obtain information about any and all site hazards", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Unawareness of restricted areas", riskRating: "HIGH", controlMeasure: "Listen and ensure you obtain information about any restricted areas", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Unawareness of other operations or hazardous activities being undertaken on site", riskRating: "MEDIUM", controlMeasure: "Listen and ensure you obtain information about any other activities being undertaken on site", newRisk: "LOW", actionBy: "All" },
    { step: "1.3", processStep: "Establish working zone", hazard: "Public entering area. Aggression. Trips or slips.", riskRating: "MEDIUM", controlMeasure: "Set up safety barricades at both ends of the escalator or moving walkway.", newRisk: "LOW", actionBy: "All" },
    { step: "2", sectionTitle: "Inspection and use of Machinery for Escalator and Travelator", processStep: "", hazard: "", riskRating: "", controlMeasure: "", newRisk: "", actionBy: "" },
    { step: "2.1", processStep: "Collect machine from vehicle and take to the designated location", hazard: "Muscle strain", riskRating: "MEDIUM", controlMeasure: "Ensure correct manual handling procedures", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "", riskRating: "", controlMeasure: "Ensure adequate personnel is utilised to distribute the load", newRisk: "LOW", actionBy: "Operator" },
    { step: "", processStep: "", hazard: "General Public", riskRating: "MEDIUM", controlMeasure: "Isolate the escalator/travelator by placing barriers at both the top and bottom of the escalator/travelator", newRisk: "LOW", actionBy: "Operator" },
    { step: "2.2", processStep: "Perform pre-operational inspection on the machinery", hazard: "Faulty equipment machine failure", riskRating: "MEDIUM", controlMeasure: "Do not operate unit that has faulty parts or equipment. If a problem is found, contact supervisor to initiate repairs of any damage or abnormalities", newRisk: "", actionBy: "" },
    { step: "", processStep: "", hazard: "Crushing injuries", riskRating: "", controlMeasure: "Ensure Operating labels undamaged and legible", newRisk: "LOW", actionBy: "Operator" },
    { step: "", processStep: "", hazard: "", riskRating: "", controlMeasure: "Check all safety devices", newRisk: "LOW", actionBy: "Operator" },
    { step: "3", sectionTitle: "Clean the Escalator and/or Travelator", processStep: "", hazard: "", riskRating: "", controlMeasure: "", newRisk: "", actionBy: "" },
    { step: "3.0", processStep: "Plug in machinery", hazard: "Electroconduction\nElectric shock", riskRating: "EXTREME", controlMeasure: "Ensure machinery is functional, tested, tagged and current", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "", riskRating: "", controlMeasure: "Check electrical lead for cracks, fraying or exposed wires", newRisk: "LOW", actionBy: "Operator" },
    { step: "", processStep: "", hazard: "", riskRating: "", controlMeasure: "Use RCD protection", newRisk: "LOW", actionBy: "Operator" },
    { step: "3.1", processStep: "Isolate / Shutdown the escalator or moving walkway", hazard: "Entrapment by moving parts", riskRating: "EXTREME", controlMeasure: "Ensure no jewellery or loose clothing is worn when working near the escalator", newRisk: "MEDIUM", actionBy: "All" },
    { step: "3.2", processStep: "Load machine onto escalator", hazard: "Muscle strain", riskRating: "HIGH", controlMeasure: "Two-person lift", newRisk: "MEDIUM", actionBy: "All" },
    { step: "3.3", processStep: "Turn on escalator to raise one full step", hazard: "Crushing by cleaning machine", riskRating: "HIGH", controlMeasure: "Activate legs and automatic wheel lock", newRisk: "MEDIUM", actionBy: "All" },
    { step: "3.4", processStep: "Operate the machinery", hazard: "Muscle strain", riskRating: "HIGH", controlMeasure: "Do not over reach", newRisk: "LOW", actionBy: "Operator" },
    { step: "", processStep: "", hazard: "Electric shock", riskRating: "MEDIUM", controlMeasure: "Ensure machinery is functional, tested, tagged and current", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Personal injury", riskRating: "HIGH", controlMeasure: "Ensure that you have received training in safe use of the machinery", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Property damage", riskRating: "HIGH", controlMeasure: "Ensure that you have received training in safe use of the machinery", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Use of escalator cleaning product", riskRating: "HIGH", controlMeasure: "Use in accordance with Safety Data Sheet. Use in a well ventilated area.", newRisk: "LOW", actionBy: "All" },
    { step: "3.5", processStep: "Turn off the machinery", hazard: "Electrocution", riskRating: "EXTREME", controlMeasure: "Do not remove plug by jerking or tugging electrical leads", newRisk: "LOW", actionBy: "Operator" },
    { step: "3.6", processStep: "Reverse escalator to return cleaning machine to the ground", hazard: "Crushing", riskRating: "HIGH", controlMeasure: "Activate legs and automatic wheel lock\nFollow operational procedures", newRisk: "MEDIUM", actionBy: "All" },
    { step: "3.7", processStep: "Clean the machinery", hazard: "Personal Injury", riskRating: "LOW", controlMeasure: "Ensure unit is unplugged before cleaning", newRisk: "LOW", actionBy: "Operator" },
    { step: "4", sectionTitle: "Escalator & Moving Walk Demarcation Painting", processStep: "", hazard: "", riskRating: "", controlMeasure: "", newRisk: "", actionBy: "" },
    { step: "4.1", processStep: "Isolate escalator/moving walk when setting up", hazard: "Entrapment", riskRating: "HIGH", controlMeasure: "Ensure escalator does not operate while setting up", newRisk: "MEDIUM", actionBy: "All" },
    { step: "4.2", processStep: "Prepare working area for paint", hazard: "Exposure to paint and fumes", riskRating: "LOW", controlMeasure: "Follow storage and usage in accordance with Safety Data Sheet (SDS)", newRisk: "LOW", actionBy: "All" },
    { step: "4.3", processStep: "Prepare template for spray painting new demarcation lines", hazard: "Muscle strain from bending and twisting", riskRating: "LOW", controlMeasure: "Follow manual handling guidelines", newRisk: "LOW", actionBy: "All" },
    { step: "4.4", processStep: "Paint new demarcation lines", hazard: "Muscle strain from bending and twisting.\nKnee strain from kneeling.\nExposure to paint or fumes", riskRating: "LOW", controlMeasure: "Follow manual handling guidelines.\nWear knee pads for comfort\nFollow storage and usage in accordance with Safety Data Sheet (SDS).", newRisk: "LOW", actionBy: "All" },
    { step: "4.5", processStep: "Rotate Escalator / MW until complete", hazard: "Entrapment by moving parts", riskRating: "EXTREME", controlMeasure: "Ensure no jewellery or loose clothing is worn when working near the escalator.\nEnsure fingers are clear when operating escalator/MW", newRisk: "MEDIUM", actionBy: "All" },
    { step: "5", sectionTitle: "Pack up and Return to Service", processStep: "", hazard: "", riskRating: "", controlMeasure: "", newRisk: "", actionBy: "" },
    { step: "3.5", processStep: "Perform post-operational inspection on the machinery", hazard: "Faulty equipment machine failure", riskRating: "MEDIUM", controlMeasure: "Do not operate unit that has faulty parts or equipment. If a problem is found, contact supervisor to initiate repairs of any damage or abnormalities\nEnsure Operating labels undamaged and legible\nCheck all safety devices", newRisk: "LOW", actionBy: "Operator" },
    { step: "", processStep: "", hazard: "", riskRating: "EXTREME", controlMeasure: "Check electrical lead for cracks, fraying or exposed wires\nUse RCD protection", newRisk: "LOW", actionBy: "Operator" },
    { step: "3.6", processStep: "Return escalator/travelator to service", hazard: "Personal injury", riskRating: "HIGH", controlMeasure: "Ensure that you have received training in safe use of the escalator/travelator", newRisk: "LOW", actionBy: "All" },
    { step: "", processStep: "", hazard: "Property damage", riskRating: "HIGH", controlMeasure: "Ensure that you have received training in safe use of the escalator/travelator", newRisk: "LOW", actionBy: "All" },
    { step: "3.7", processStep: "Take machine and equipment to vehicle", hazard: "Muscle strain", riskRating: "MEDIUM", controlMeasure: "Ensure correct manual handling procedures\nEnsure adequate personnel is utilised to distribute the load", newRisk: "LOW", actionBy: "All" },
    { step: "3.8", processStep: "Report to clients reception; Sign out", hazard: "Exiting job site", riskRating: "HIGH", controlMeasure: "Follow posted signs and go directly to designated location of vehicle", newRisk: "LOW", actionBy: "All" },
  ];
}

function groupHazardRows(rows: HazardRow[], rowsPerPage: number): HazardRow[][] {
  const groups: HazardRow[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    groups.push(rows.slice(i, i + rowsPerPage));
  }
  return groups.length > 0 ? groups : [[]];
}

function getRiskColor(rating: string): readonly [number, number, number] {
  switch (rating.toUpperCase()) {
    case "EXTREME": return RED_C;
    case "HIGH": return [249, 115, 22];
    case "MEDIUM": return AMBER;
    case "LOW": return GREEN;
    default: return LIGHT;
  }
}

function renderHazardTable(pdf: jsPDF, x: number, y: number, w: number, rows: HazardRow[], showHeader: boolean, emptyRows = false): number {
  // Table header spans
  const cols = {
    step: 10,
    processStep: 38,
    hazard: 38,
    riskRating: 16,
    controlMeasure: 52,
    newRisk: 16,
    actionBy: 20,
  };
  const totalCols = Object.values(cols).reduce((a, b) => a + b, 0);
  const scale = w / totalCols;
  const cw = {
    step: cols.step * scale,
    processStep: cols.processStep * scale,
    hazard: cols.hazard * scale,
    riskRating: cols.riskRating * scale,
    controlMeasure: cols.controlMeasure * scale,
    newRisk: cols.newRisk * scale,
    actionBy: cols.actionBy * scale,
  };

  if (showHeader) {
    // Super-headers
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.3);
    fillRgb(pdf, LIGHT);
    const jsea_w = cw.step + cw.processStep + cw.hazard + cw.riskRating;
    const swms_w = cw.controlMeasure + cw.newRisk + cw.actionBy;
    pdf.rect(x, y, jsea_w, 8, "FD");
    pdf.rect(x + jsea_w, y, swms_w, 8, "FD");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("Job Safety and Environment Analysis (JSEA)", x + jsea_w / 2, y + 5.5, { align: "center" });
    pdf.text("Work Method Statement (SWMS)", x + jsea_w + swms_w / 2, y + 5.5, { align: "center" });
    y += 8;

    // Sub-headers
    const subHeaders = [
      { label: "Step\nNo.", w: cw.step },
      { label: "Process Steps\nList the steps needed to do the job in sequence to be done.", w: cw.processStep },
      { label: "Potential Hazard(s)\nAgainst each step list potential hazards that could cause injury when the job is done.", w: cw.hazard },
      { label: "Risk\nRating", w: cw.riskRating },
      { label: "Hazard Control Measures\nFor each hazard, identify controls measures to eliminate or minimise the risk of injury.", w: cw.controlMeasure },
      { label: "New Risk\nRating", w: cw.newRisk },
      { label: "Action By", w: cw.actionBy },
    ];
    let hx = x;
    subHeaders.forEach((sh) => {
      fillRgb(pdf, LIGHT);
      pdf.rect(hx, y, sh.w, 14, "FD");
      rgb(pdf, DARK);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      const lines = splitText(pdf, sh.label, sh.w - 3);
      pdf.text(lines, hx + 1.5, y + 4.5);
      hx += sh.w;
    });
    y += 14;
  }

  if (emptyRows) {
    for (let i = 0; i < 6; i++) {
      const rowH = 12;
      strokeRgb(pdf, BORDER);
      pdf.setLineWidth(0.2);
      let rx = x;
      Object.values(cw).forEach((cWidth) => {
        pdf.rect(rx, y, cWidth, rowH, "S");
        rx += cWidth;
      });
      y += rowH;
    }
    return y;
  }

  rows.forEach((row) => {
    if (row.sectionTitle) {
      // Section header row
      const rowH = 7;
      fillRgb(pdf, LIGHT);
      pdf.rect(x, y, w, rowH, "F");
      strokeRgb(pdf, BORDER);
      pdf.rect(x, y, w, rowH, "S");
      rgb(pdf, DARK);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(`${row.step}  ${row.sectionTitle}`, x + 2, y + 5);
      y += rowH;
      return;
    }

    const lines = {
      processStep: splitText(pdf, row.processStep, cw.processStep - 3),
      hazard: splitText(pdf, row.hazard, cw.hazard - 3),
      control: splitText(pdf, row.controlMeasure, cw.controlMeasure - 3),
    };
    const maxLines = Math.max(lines.processStep.length, lines.hazard.length, lines.control.length, 1);
    const rowH = Math.max(8, maxLines * 4.5 + 3);

    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);

    let rx = x;
    const colWidths = Object.values(cw);
    colWidths.forEach((cWidth) => {
      pdf.rect(rx, y, cWidth, rowH, "S");
      rx += cWidth;
    });

    rgb(pdf, DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);

    let rx2 = x;
    // step
    if (row.step) pdf.text(row.step, rx2 + 1.5, y + 5);
    rx2 += cw.step;
    // processStep
    pdf.text(lines.processStep, rx2 + 1.5, y + 5);
    rx2 += cw.processStep;
    // hazard
    pdf.text(lines.hazard, rx2 + 1.5, y + 5);
    rx2 += cw.hazard;
    // riskRating
    if (row.riskRating) {
      const rColor = getRiskColor(row.riskRating);
      fillRgb(pdf, rColor);
      pdf.rect(rx2 + 1, y + 1, cw.riskRating - 2, rowH - 2, "F");
      rgb(pdf, WHITE);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.text(row.riskRating, rx2 + cw.riskRating / 2, y + rowH / 2 + 1, { align: "center" });
      pdf.setFont("helvetica", "normal");
    }
    rx2 += cw.riskRating;
    // controlMeasure
    rgb(pdf, DARK);
    pdf.text(lines.control, rx2 + 1.5, y + 5);
    rx2 += cw.controlMeasure;
    // newRisk
    if (row.newRisk) {
      const nColor = getRiskColor(row.newRisk);
      fillRgb(pdf, nColor);
      pdf.rect(rx2 + 1, y + 1, cw.newRisk - 2, rowH - 2, "F");
      rgb(pdf, WHITE);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.text(row.newRisk, rx2 + cw.newRisk / 2, y + rowH / 2 + 1, { align: "center" });
      pdf.setFont("helvetica", "normal");
    }
    rx2 += cw.newRisk;
    // actionBy
    rgb(pdf, DARK);
    pdf.setFontSize(7.5);
    if (row.actionBy) pdf.text(row.actionBy, rx2 + 1.5, y + 5);

    y += rowH;
  });
  return y;
}

function renderRiskCalculator(pdf: jsPDF, x: number, y: number, w: number) {
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);

  // Title
  fillRgb(pdf, LIGHT);
  const titleH = 7;
  pdf.rect(x, y, w * 0.42, titleH, "F");
  strokeRgb(pdf, BORDER);
  pdf.rect(x, y, w * 0.42, titleH, "S");
  pdf.text("RISK CALCULATOR", x + 2, y + 5);

  const likeW = w * 0.38;
  const likeX = x + w * 0.22;
  pdf.rect(likeX, y, likeW, titleH, "S");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Likelihood of an incident occurring", likeX + likeW / 2, y + 5, { align: "center" });

  const levelX = likeX + likeW;
  const levelW = w - (levelX - x);
  pdf.rect(levelX, y, levelW, titleH, "S");
  pdf.text("Risk level and control actions required", levelX + levelW / 2, y + 5, { align: "center" });

  y += titleH;

  // Sub-headers
  const conW = w * 0.22;
  const likeHeaders = ["Almost Certain", "Likely", "Possible", "Unlikely", "Rare"];
  const riskHeaders = ["Risk Level", "Action required to control risk"];
  const likeCW = likeW / 5;
  const riskW = levelW / 2;

  // Consequence header
  fillRgb(pdf, LIGHT);
  pdf.rect(x, y, conW, 10, "FD");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("Consequence of an incident", x + conW / 2, y + 7, { align: "center" });

  likeHeaders.forEach((h, i) => {
    const lx = likeX + i * likeCW;
    fillRgb(pdf, LIGHT);
    pdf.rect(lx, y, likeCW, 10, "FD");
    rgb(pdf, DARK);
    pdf.setFontSize(7);
    pdf.text(splitText(pdf, h, likeCW - 2), lx + 1, y + 4);
  });

  riskHeaders.forEach((h, i) => {
    const rx = levelX + i * riskW;
    fillRgb(pdf, LIGHT);
    pdf.rect(rx, y, riskW, 10, "FD");
    rgb(pdf, DARK);
    pdf.setFontSize(7);
    pdf.text(h, rx + riskW / 2, y + 7, { align: "center" });
  });
  y += 10;

  // Matrix data
  type Cell = { text: string; color: readonly [number, number, number] };
  const matrix: { consequence: string; cells: Cell[]; riskLevel: { label: string; bg: readonly [number,number,number] }; action: string; actionNote: string }[] = [
    {
      consequence: "Catastrophic 5\nDeath/permanent disability or illness. Permanent/long-term environmental impact on eco-system, major remediation required.",
      cells: [
        { text: "EXTREME", color: RED_C }, { text: "EXTREME", color: RED_C }, { text: "HIGH", color: [249,115,22] },
        { text: "HIGH", color: [249,115,22] }, { text: "MEDIUM", color: AMBER },
      ],
      riskLevel: { label: "Extreme", bg: RED_C },
      action: "Unacceptable",
      actionNote: "Must be given immediate senior management attention.",
    },
    {
      consequence: "Major 2\nSerious injury or long-term health. Serious medium-term environmental effects.",
      cells: [
        { text: "EXTREME", color: RED_C }, { text: "HIGH", color: [249,115,22] }, { text: "HIGH", color: [249,115,22] },
        { text: "MEDIUM", color: AMBER }, { text: "MEDIUM", color: AMBER },
      ],
      riskLevel: { label: "High", bg: [249,115,22] },
      action: "Active Management",
      actionNote: "Must have considerable management to reduce to as low as reasonably practicable (ALARP)",
    },
    {
      consequence: "Moderate 3\nMedical attention and several days off work. Moderate short-term effects but not affecting eco-system.",
      cells: [
        { text: "HIGH", color: [249,115,22] }, { text: "HIGH", color: [249,115,22] }, { text: "MEDIUM", color: AMBER },
        { text: "MEDIUM", color: AMBER }, { text: "LOW", color: GREEN },
      ],
      riskLevel: { label: "Medium", bg: AMBER },
      action: "Tolerable",
      actionNote: "Risks should be managed and monitored to reduce to as low as reasonably practicable (ALARP)",
    },
    {
      consequence: "Minor 2\nFirst aid treatment required. Minor effects on biological or physical environment.",
      cells: [
        { text: "HIGH", color: [249,115,22] }, { text: "MEDIUM", color: AMBER }, { text: "MEDIUM", color: AMBER },
        { text: "LOW", color: GREEN }, { text: "LOW", color: GREEN },
      ],
      riskLevel: { label: "Low", bg: GREEN },
      action: "No Action Required",
      actionNote: "Manage and monitor with normal operational management practices",
    },
    {
      consequence: "Insignificant 1\nInsignificant health & safety. Limited damage to minimal area of low significance.",
      cells: [
        { text: "MEDIUM", color: AMBER }, { text: "MEDIUM", color: AMBER }, { text: "LOW", color: GREEN },
        { text: "LOW", color: GREEN }, { text: "LOW", color: GREEN },
      ],
      riskLevel: { label: "", bg: WHITE },
      action: "",
      actionNote: "",
    },
  ];

  matrix.forEach((row) => {
    const rowH = 16;
    // Consequence
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, conW, rowH, "S");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    const conLines = splitText(pdf, row.consequence, conW - 3);
    pdf.text(conLines, x + 1.5, y + 4);

    // Likelihood cells
    row.cells.forEach((cell, i) => {
      const lx = likeX + i * likeCW;
      fillRgb(pdf, cell.color);
      pdf.rect(lx, y, likeCW, rowH, "F");
      strokeRgb(pdf, BORDER);
      pdf.rect(lx, y, likeCW, rowH, "S");
      rgb(pdf, WHITE);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text(cell.text, lx + likeCW / 2, y + rowH / 2 + 1, { align: "center" });
    });

    // Risk level
    if (row.riskLevel.label) {
      fillRgb(pdf, row.riskLevel.bg);
      pdf.rect(levelX, y, riskW, rowH, "F");
      strokeRgb(pdf, BORDER);
      pdf.rect(levelX, y, riskW, rowH, "S");
      rgb(pdf, WHITE);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(row.riskLevel.label, levelX + riskW / 2, y + rowH / 2 + 2, { align: "center" });
    } else {
      strokeRgb(pdf, BORDER);
      pdf.rect(levelX, y, riskW, rowH, "S");
    }

    // Action
    strokeRgb(pdf, BORDER);
    pdf.rect(levelX + riskW, y, riskW, rowH, "S");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    if (row.action) pdf.text(row.action, levelX + riskW + 1.5, y + 5);
    pdf.setFont("helvetica", "normal");
    const actionLines = splitText(pdf, row.actionNote, riskW - 3);
    pdf.text(actionLines, levelX + riskW + 1.5, y + 9);

    y += rowH;
  });

  // Footer note
  y += 2;
  strokeRgb(pdf, BORDER);
  pdf.rect(x, y, w, 8, "S");
  rgb(pdf, DARK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(
    "Hierarchy of risk controls (in order of preference): 1 Elimination (most effective) → 2 Substitution → 3 Isolation → 4 Engineering means → 5 Administrative controls → 6 PPE (least effective)",
    x + 2, y + 5,
  );
}

// ─── Footer helper ────────────────────────────────────────────────────────────
function addFooter(pdf: jsPDF, W: number, margin: number, text: string, pageNum: number) {
  strokeRgb(pdf, BORDER);
  pdf.setLineWidth(0.2);
  pdf.line(margin, 282, W - margin, 282);
  rgb(pdf, MID);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(text, margin, 287);
  fillRgb(pdf, DARK);
  pdf.roundedRect(W - margin - 10, 280, 10, 10, 1, 1, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(String(pageNum), W - margin - 5, 287, { align: "center" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERAL REPORT
// ═══════════════════════════════════════════════════════════════════════════════
function buildGeneralReportPdf(doc: ReportDocument): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fd = doc.formData;
  const W = 210;
  const margin = 14;
  const colW = W - margin * 2;
  let y = 20;

  // Header
  fillRgb(pdf, BLUE);
  pdf.rect(0, 0, W, 14, "F");
  rgb(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Statewide Escalator Cleaning Pty Ltd", margin, 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Service Report", W - margin, 9, { align: "right" });
  y = 22;

  rgb(pdf, DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(doc.title || "Service Report", margin, y + 6);
  y += 14;

  const fields: [string, string][] = [
    ["Date", fmt(fd.documentDate)],
    ["Client", doc.clientName || "-"],
    ["Site", doc.siteName || "-"],
    ["Prepared By", fd.preparedBy || "-"],
    ["Crew", fd.crewNames || "-"],
    ["Start Time", fd.startTime || "-"],
    ["Finish Time", fd.finishTime || "-"],
    ["Weather", fd.weather || "-"],
    ["Emergency Contact", fd.emergencyContact || "-"],
  ];

  fields.forEach(([label, value]) => {
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, colW, 8, "S");
    fillRgb(pdf, LIGHT);
    pdf.rect(margin, y, 52, 8, "F");
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text(label, margin + 2, y + 5.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, margin + 55, y + 5.5);
    y += 8;
  });

  const textFields: [string, string][] = [
    ["Summary", fd.reportSummary],
    ["Work Completed", fd.workCompleted],
    ["Incidents / Variations", fd.incidents],
    ["Materials Used", fd.materialsUsed],
    ["Equipment Used", fd.equipmentUsed],
    ["Customer Notes", fd.customerNotes],
  ];

  textFields.forEach(([label, value]) => {
    if (!value) return;
    y += 4;
    rgb(pdf, DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(label, margin, y);
    y += 5;
    const lines = splitText(pdf, value, colW);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    strokeRgb(pdf, BORDER);
    pdf.setLineWidth(0.2);
    const blockH = lines.length * 5 + 4;
    pdf.rect(margin, y, colW, blockH, "S");
    rgb(pdf, DARK);
    pdf.text(lines, margin + 2, y + 5);
    y += blockH;
  });

  return pdf.output("blob");
}
