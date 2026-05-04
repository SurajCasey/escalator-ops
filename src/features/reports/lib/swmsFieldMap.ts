/**
 * swmsFieldMap.ts  — v2 (new JSEA & SWMS template)
 *
 * Pixel-accurate coordinates for overlaying text onto the new
 * Statewide Escalator Cleaning SWMS/JSEA template PDF (13 pages, A4 landscape).
 *
 * HOW COORDINATES WORK
 * ─────────────────────
 * Template is A4 landscape = 841.89 × 595.30 pt.
 * pdf-lib uses bottom-left as origin — Y increases upward.
 *
 * Derived with PyMuPDF (fitz) word positions from the LibreOffice-converted PDF.
 * fontSize: 9 pt to match template body text.
 */

export const PAGE_HEIGHT = 595.30; // pt  (A4 landscape)
export const PAGE_WIDTH  = 841.89; // pt

/** Convert a PyMuPDF y-bottom coordinate to a pdf-lib baseline y. */
export function toLibY(pyMuPdfYBottom: number): number {
  return PAGE_HEIGHT - pyMuPdfYBottom;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared field zone type
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldZone {
  page: number;  // 0-indexed
  x: number;
  y: number;     // pdf-lib baseline (from bottom)
  maxWidth?: number;
  fontSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 (index 0)  —  Part 1: Project and Task Identification
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout (PyMuPDF top-y → pdf-lib libY):
//   "Client:"          y_top=261.5  → libY ≈ 322
//   "Job Site:"        y_top=275.4  → libY ≈ 308
//   Contact header row y_top=289.4  → libY ≈ 292
//   Contact data row   (blank cells after header, first row ≈ y_top=303)
//   "SWMS Initiated By" header y=359.1 ; "Michael Lakiss" data y=372.6 → libY ≈ 211
//   "Supervisor Review" y=400.0 ; data (blank) y≈413 → libY ≈ 168
//   "Management Review" y=440.8 ; data (blank) y≈454 → libY ≈ 128
// ─────────────────────────────────────────────────────────────────────────────

export const FIELD_ZONES: Record<string, FieldZone> = {
  // ── Client / Site ──────────────────────────────────────────────────────────
  clientName: {
    page: 0,
    x: 115,
    y: toLibY(275.4),   // baseline of "Client:" row
    maxWidth: 490,
    fontSize: 9,
  },
  jobSiteAddress: {
    page: 0,
    x: 120,
    y: toLibY(289.4),   // baseline of "Job Site:" row
    maxWidth: 480,
    fontSize: 9,
  },

  // ── Contact details (first data row below header at y=289.4) ──────────────
  contactName: {
    page: 0,
    x: 80,
    y: toLibY(316),     // first data row baseline ≈ y=303-316
    maxWidth: 130,
    fontSize: 9,
  },
  contactTitle: {
    page: 0,
    x: 220,
    y: toLibY(316),
    maxWidth: 130,
    fontSize: 9,
  },
  contactPhone: {
    page: 0,
    x: 360,
    y: toLibY(316),
    maxWidth: 130,
    fontSize: 9,
  },
  contactMobile: {
    page: 0,
    x: 500,
    y: toLibY(316),
    maxWidth: 130,
    fontSize: 9,
  },
  contactEmail: {
    page: 0,
    x: 640,
    y: toLibY(316),
    maxWidth: 155,
    fontSize: 9,
  },

  // ── SWMS Initiated By (white-out "Michael Lakiss" then draw ours) ──────────
  initiatedBy: {
    page: 0,
    x: 80,
    y: toLibY(386),     // data row below "SWMS Initiated By" header
    maxWidth: 190,
    fontSize: 9,
  },
  initiatedDate: {
    page: 0,
    x: 310,
    y: toLibY(386),     // same data row, "Date:" value
    maxWidth: 110,
    fontSize: 9,
  },

  // ── Supervisor Review ──────────────────────────────────────────────────────
  supervisorName: {
    page: 0,
    x: 80,
    y: toLibY(427),     // data row below "Supervisor Review" header
    maxWidth: 190,
    fontSize: 9,
  },
  supervisorDate: {
    page: 0,
    x: 310,
    y: toLibY(427),
    maxWidth: 110,
    fontSize: 9,
  },
  workLocations: {
    page: 0,
    x: 540,
    y: toLibY(427),
    maxWidth: 240,
    fontSize: 9,
  },

  // ── Management Review ──────────────────────────────────────────────────────
  managementName: {
    page: 0,
    x: 80,
    y: toLibY(468),     // data row below "Management Review" header
    maxWidth: 190,
    fontSize: 9,
  },
  managementDate: {
    page: 0,
    x: 310,
    y: toLibY(468),
    maxWidth: 110,
    fontSize: 9,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2 (index 1)  —  Description of Work to be Undertaken
  // ─────────────────────────────────────────────────────────────────────────
  // Label "Description of Work to be Undertaken:" is in left cell (x=78-249).
  // Blank data cell is to the right (x≈253-795), same row y=115.4-143.
  descriptionOfWork: {
    page: 1,
    x: 253,
    y: toLibY(133),     // first line of description data cell
    maxWidth: 540,
    fontSize: 9,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 (index 2)  —  Part 2: Worker Sign-Off Table
// ─────────────────────────────────────────────────────────────────────────────
//
// Header row (labels): y=318.5
//   No.            x=77.8
//   Name           x=112.9
//   Classification x=245.3
//   Employed By    x=377.8
//   Signature      x=510.2  ← left blank (drawn by worker, not filled)
//   Date           x=642.7
//
// Data rows 1-10 starting at y_top=340.7, step≈14.7 pt
//   libY_row_n = PAGE_HEIGHT - (340.7 + 12 + n*14.7)   (12 = approx baseline offset)
// ─────────────────────────────────────────────────────────────────────────────

export const WORKER_TABLE = {
  page: 2,              // 0-indexed (page 3)

  /** pdf-lib y for row 1 baseline (PyMuPDF y_bottom ≈ 352.7) */
  firstRowY: PAGE_HEIGHT - 352.7,
  /** pt per row */
  rowStep: 14.7,

  col: {
    number:         78,
    name:           113,
    classification: 245,
    employedBy:     378,
    // signature column is not text-filled
    date:           643,
  },
  maxWidth: {
    number:         15,
    name:           126,
    classification: 126,
    employedBy:     126,
    date:           80,
  },
  fontSize: 8.5,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// White-out zones
// Areas that have pre-printed placeholder text we must cover before overlaying.
// Coordinates are pdf-lib (x, y = bottom-left corner of rect, from page bottom).
// ─────────────────────────────────────────────────────────────────────────────

export interface WhiteOutZone {
  page: number;
  x: number;
  y: number;        // pdf-lib bottom-left of rectangle
  width: number;
  height: number;
}

export const WHITE_OUT_ZONES: WhiteOutZone[] = [
  {
    // "Michael Lakiss" — SWMS Initiated By pre-printed name on page 1
    page: 0,
    x: 78,
    y: toLibY(386) - 2,   // 2pt below baseline
    width: 200,
    height: 14,
  },
];
