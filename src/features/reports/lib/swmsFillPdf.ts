/**
 * swmsFillPdf.ts
 *
 * Loads the Statewide SWMS/JSEA template PDF and overlays typed text at the
 * exact coordinates of every blank field.  The original visual layout is
 * preserved byte-for-byte — only new text layers are added on top.
 *
 * Library choice: pdf-lib
 * ────────────────────────
 * • Works entirely in the browser (no server round-trip).
 * • Loads an existing PDF and draws text at arbitrary coordinates.
 * • Unlike jsPDF (which generates new PDFs), pdf-lib preserves the original
 *   artwork, fonts, images, and drawing paths.
 * • The two unnamed Signature AcroForm widgets already present in the PDF are
 *   left untouched; we only add new content streams.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FIELD_ZONES, WORKER_TABLE } from "./swmsFieldMap";

// ─── Public data shape ────────────────────────────────────────────────────────

export interface SwmsWorkerRow {
  name: string;
  classification: string;
  employedBy: string;
  date: string;  // ISO date string  e.g. "2026-01-15"
}

export interface SwmsFillData {
  // Page 1 – Part 1
  clientName:       string;
  jobSiteAddress:   string;
  contactName:      string;
  contactTitle:     string;
  contactPhone:     string;
  contactMobile:    string;
  contactEmail:     string;
  initiatedBy:      string;
  initiatedDate:    string;  // ISO date
  workLocations:    string;
  supervisorName:   string;
  supervisorDate:   string;  // ISO date
  managementName:   string;
  managementDate:   string;  // ISO date

  // Page 3 – Part 2 worker sign-off
  workers: SwmsWorkerRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Clamp text so it never exceeds maxWidth points at the given fontSize. */
function clamp(text: string, maxWidth: number, charWidthEst = 5.4): string {
  // Rough estimate: Helvetica at 9 pt ≈ 5.4 pt per char
  const maxChars = Math.floor(maxWidth / charWidthEst);
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

// ─── Core service ─────────────────────────────────────────────────────────────

/**
 * Fill the SWMS template PDF with the supplied data.
 *
 * @param data         - All field values to embed.
 * @param templateUrl  - URL of the template PDF (defaults to the bundled one).
 * @returns            - A Blob of the filled PDF ready for download or upload.
 */
export async function fillSwmsPdf(
  data: SwmsFillData,
  templateUrl = "/templates/swms-template.pdf",
): Promise<Blob> {
  // 1. Fetch template bytes
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load SWMS template: ${response.statusText}`);
  }
  const templateBytes = await response.arrayBuffer();

  // 2. Load into pdf-lib (ignoreCrypt handles the two AcroForm sig fields)
  const pdfDoc = await PDFDocument.load(templateBytes, {
    ignoreEncryption: true,
  });

  // 3. Embed the standard Helvetica font (no file embedding needed)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const BLACK = rgb(0, 0, 0);

  // ── Helper: draw a single text value at a named zone ──────────────────────
  function drawField(key: keyof typeof FIELD_ZONES, value: string) {
    if (!value) return;
    const zone = FIELD_ZONES[key];
    const page = pages[zone.page];
    if (!page) return;

    const fs = zone.fontSize ?? 9;
    const maxW = zone.maxWidth ?? 200;
    const text = clamp(value, maxW, fs * 0.6);

    page.drawText(text, {
      x: zone.x,
      y: zone.y,
      size: fs,
      font,
      color: BLACK,
      maxWidth: maxW,
    });
  }

  // ── Page 1: Project and Task Identification ────────────────────────────────
  drawField("clientName",       data.clientName);
  drawField("jobSiteAddress",   data.jobSiteAddress);
  drawField("contactName",      data.contactName);
  drawField("contactTitle",     data.contactTitle);
  drawField("contactPhone",     data.contactPhone);
  drawField("contactMobile",    data.contactMobile);
  drawField("contactEmail",     data.contactEmail);
  drawField("initiatedBy",      data.initiatedBy);
  drawField("initiatedDate",    fmtDate(data.initiatedDate));
  drawField("workLocations",    data.workLocations);
  drawField("supervisorName",   data.supervisorName);
  drawField("supervisorDate",   fmtDate(data.supervisorDate));
  drawField("managementName",   data.managementName);
  drawField("managementDate",   fmtDate(data.managementDate));

  // ── Page 3: Worker Sign-Off Table ─────────────────────────────────────────
  const workerPage = pages[WORKER_TABLE.page];
  if (workerPage) {
    const { col, maxWidth, fontSize, firstRowY, rowStep } = WORKER_TABLE;

    data.workers.slice(0, 10).forEach((w, i) => {
      const rowY = firstRowY - i * rowStep;

      const drawCell = (x: number, maxW: number, text: string, bold = false) => {
        if (!text) return;
        const f = bold ? fontBold : font;
        workerPage.drawText(clamp(text, maxW, fontSize * 0.6), {
          x,
          y: rowY,
          size: fontSize,
          font: f,
          color: BLACK,
          maxWidth: maxW,
        });
      };

      drawCell(col.number,         maxWidth.number,         String(i + 1), true);
      drawCell(col.name,           maxWidth.name,           w.name);
      drawCell(col.classification, maxWidth.classification, w.classification);
      drawCell(col.employedBy,     maxWidth.employedBy,     w.employedBy);
      drawCell(col.date,           maxWidth.date,           fmtDate(w.date));
    });
  }

  // 4. Serialise and return as Blob
  // useObjectStreams: false is critical — without it pdf-lib recompresses the
  // original content streams and corrupts them (zlib errors, blank pages).
  const filledBytes = await pdfDoc.save({ useObjectStreams: false });
  // pdf-lib returns Uint8Array — convert via ArrayBuffer to satisfy strict TS
  return new Blob([filledBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage upload
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../../../lib/supabase";

export interface UploadedSwms {
  path: string;       // storage path  e.g. "swms-documents/uuid.pdf"
  publicUrl: string;  // public download URL
}

/**
 * Upload a filled SWMS Blob to Supabase Storage.
 *
 * @param blob   - Output of fillSwmsPdf()
 * @param jobId  - Optional job UUID to embed in the filename for traceability
 */
export async function uploadSwmsPdf(
  blob: Blob,
  jobId?: string,
): Promise<UploadedSwms> {
  const filename = [
    "swms",
    jobId ?? "general",
    Date.now(),
  ].join("_") + ".pdf";

  const path = `swms-documents/${filename}`;

  const { error } = await supabase.storage
    .from("swms-documents")
    .upload(path, blob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("swms-documents")
    .getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

/**
 * Convenience: fill + upload in one call.
 * Also inserts a row into the swms_documents table.
 */
export async function generateAndSaveSwms(
  data: SwmsFillData,
  jobId?: string,
): Promise<UploadedSwms> {
  const blob    = await fillSwmsPdf(data);
  const result  = await uploadSwmsPdf(blob, jobId);

  // Record in database
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("swms_documents").insert({
    job_id:     jobId ?? null,
    storage_path: result.path,
    public_url:   result.publicUrl,
    created_by: user?.id ?? null,
  });

  return result;
}
