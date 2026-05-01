/**
 * swmsFieldMap.ts
 *
 * Pixel-accurate coordinates for overlaying text onto the Statewide
 * Escalator Cleaning SWMS/JSEA template PDF.
 *
 * HOW COORDINATES WORK
 * ─────────────────────
 * The template is A4 landscape = 841.92 × 595.32 pt (PDF points).
 * pdf-lib uses the bottom-left corner as origin (0, 0) — Y increases upward.
 *
 * These values were derived by running PyMuPDF over the actual PDF and
 * observing where existing pre-filled text ("Suraj Khatri", "Esc 1 & 2")
 * already sits, then mapping every blank zone to match.
 *
 * fontSize: all field data uses 9 pt to match the template body text.
 * maxWidth: maximum horizontal span before text should be clipped/truncated.
 */

export const PAGE_HEIGHT = 595.32; // pt  (A4 landscape)
export const PAGE_WIDTH  = 841.92; // pt

/** Convert a PyMuPDF y-bottom coordinate to a pdf-lib baseline y. */
export function toLibY(pyMuPdfYBottom: number): number {
  return PAGE_HEIGHT - pyMuPdfYBottom;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1  —  Part 1: Project and Task Identification
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldZone {
  page: number;  // 0-indexed
  x: number;
  y: number;     // pdf-lib baseline (from bottom)
  maxWidth?: number;
  fontSize?: number;
}

/**
 * Single-value field zones.
 * Key names match the SwmsFillData interface in swmsFillPdf.ts.
 */
export const FIELD_ZONES: Record<string, FieldZone> = {
  // ── Client / Site row ───────────────────────────────────────────────────
  // Label "Client:" ends at x≈110, row y-center ≈ 268 pt from top
  clientName: {
    page: 0,
    x: 115,
    y: toLibY(274),   // 274 = y-bottom of label row
    maxWidth: 290,
    fontSize: 9,
  },
  // Label "Job Site:" ends at x≈118
  jobSiteAddress: {
    page: 0,
    x: 125,
    y: toLibY(288),
    maxWidth: 290,
    fontSize: 9,
  },

  // ── Contact details (data row below header labels at y=291-302) ─────────
  contactName: {
    page: 0,
    x: 78,
    y: toLibY(316),   // row just below header at 302
    maxWidth: 133,
    fontSize: 9,
  },
  contactTitle: {
    page: 0,
    x: 217,
    y: toLibY(316),
    maxWidth: 133,
    fontSize: 9,
  },
  contactPhone: {
    page: 0,
    x: 357,
    y: toLibY(316),
    maxWidth: 133,
    fontSize: 9,
  },
  contactMobile: {
    page: 0,
    x: 497,
    y: toLibY(316),
    maxWidth: 133,
    fontSize: 9,
  },
  contactEmail: {
    page: 0,
    x: 637,
    y: toLibY(316),
    maxWidth: 195,
    fontSize: 9,
  },

  // ── SWMS meta block ──────────────────────────────────────────────────────
  // "SWMS Initiated By" — existing "Suraj Khatri" is at y-top≈383.7
  initiatedBy: {
    page: 0,
    x: 78,
    y: toLibY(392.7),  // observed y-bottom from PyMuPDF
    maxWidth: 195,
    fontSize: 9,
  },
  // "Date:" label at y=374-385; fill to the right at x≈315
  initiatedDate: {
    page: 0,
    x: 315,
    y: toLibY(385),
    maxWidth: 110,
    fontSize: 9,
  },

  // ── Supervisor Review row (y=402-413) ───────────────────────────────────
  supervisorName: {
    page: 0,
    x: 78,
    y: toLibY(426),
    maxWidth: 195,
    fontSize: 9,
  },
  // "Date:" at y=415-426, x=283
  supervisorDate: {
    page: 0,
    x: 315,
    y: toLibY(426),
    maxWidth: 110,
    fontSize: 9,
  },
  // "Work Locations/Areas:" label at x=432, y=402-413
  // Existing "Esc 1 & 2" at y-bottom≈434.6, x≈431.6
  workLocations: {
    page: 0,
    x: 432,
    y: toLibY(434.6),
    maxWidth: 300,
    fontSize: 9,
  },

  // ── Management Review row (y=442-453) ───────────────────────────────────
  managementName: {
    page: 0,
    x: 78,
    y: toLibY(467),
    maxWidth: 195,
    fontSize: 9,
  },
  managementDate: {
    page: 0,
    x: 315,
    y: toLibY(467),
    maxWidth: 110,
    fontSize: 9,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3  —  Part 2: Worker Sign-Off Table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Column x-positions for the worker sign-off table (all on page 3).
 * Derived from header label positions:
 *   No.            x≈78  (narrow, col width ≈ 20 pt)
 *   Name           x≈100
 *   Classification x≈250
 *   Employed By    x≈380
 *   Signature      x≈510  ← left blank (no text fill)
 *   Date           x≈645
 */
export const WORKER_TABLE = {
  page: 2,          // 0-indexed (page 3)
  firstRowY: 344,   // pdf-lib y of row-1 baseline (PyMuPDF y≈251)
  rowStep: 19.5,    // pt per row

  col: {
    number:         78,
    name:           100,
    classification: 250,
    employedBy:     380,
    date:           645,
  },
  maxWidth: {
    number:         15,
    name:           144,
    classification: 124,
    employedBy:     124,
    date:           80,
  },
  fontSize: 8.5,
} as const;
