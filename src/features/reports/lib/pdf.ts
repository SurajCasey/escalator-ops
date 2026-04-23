import type { ReportDocument } from "../components/types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const TOP = 792;
const FONT_SIZE = 11;
const LEADING = 15;
const MAX_CHARS = 88;

export function buildReportPdf(document: ReportDocument) {
  const lines = buildLines(document);
  const pages = paginate(lines, 46);
  const objects: string[] = [];

  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (const pageLines of pages) {
    const content = buildContentStream(pageLines);
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    contentIds.push(contentId);
    pageIds.push(0);
  }

  const pagesId = addObject("<< /Type /Pages /Kids [] /Count 0 >>");

  for (let index = 0; index < contentIds.length; index += 1) {
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`,
    );
    pageIds[index] = pageId;
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefPosition = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function buildLines(document: ReportDocument) {
  const data = document.formData;
  const sections: Array<[string, string | boolean | null | undefined]> = [
    ["Document Type", humanizeType(document.type)],
    ["Title", document.title],
    ["Status", document.status],
    ["Date", data.documentDate],
    ["Prepared By", data.preparedBy],
    ["Reviewed By", data.reviewedBy],
    ["Related Job", document.jobTitle],
    ["Client", document.clientName],
    ["Site", document.siteName],
    ["Crew Names", data.crewNames],
    ["Supervisor", data.supervisorName],
    ["Start Time", data.startTime],
    ["Finish Time", data.finishTime],
    ["Weather", data.weather],
    ["Emergency Contact", data.emergencyContact],
    ["Site Access Confirmed", yesNo(data.siteAccessConfirmed)],
    ["Isolation Required", yesNo(data.isolationRequired)],
    ["PPE Checked", yesNo(data.ppeChecked)],
    ["Tools Checked", yesNo(data.toolsChecked)],
    ["Permits Confirmed", yesNo(data.permitsConfirmed)],
    ["Summary", data.reportSummary],
    ["Work Completed", data.workCompleted],
    ["Incidents", data.incidents],
    ["Materials Used", data.materialsUsed],
    ["Equipment Used", data.equipmentUsed],
    ["Customer Notes", data.customerNotes],
    ["Hazards Identified", data.hazardsIdentified],
    ["Controls In Place", data.controlsInPlace],
    ["Pre-start Notes", data.preStartNotes],
    ["SWMS Scope", data.swmsScope],
    ["SWMS Hazards", data.swmsHazards],
    ["SWMS Controls", data.swmsControls],
    ["Residual Risk", data.swmsResidualRisk],
    ["SWMS Review Notes", data.swmsReviewNotes],
    ["Acknowledged By", data.signatures],
  ];

  const lines = ["Statewide Escalator Cleaning", "Compliance Document", ""];
  for (const [label, raw] of sections) {
    const value = normalizeValue(raw);
    const wrapped = wrap(`${label}: ${value}`, MAX_CHARS);
    lines.push(...wrapped, "");
  }
  return lines;
}

function buildContentStream(lines: string[]) {
  const commands = ["BT", `/F1 ${FONT_SIZE} Tf`, `${LEFT} ${TOP} Td`];
  let first = true;
  for (const line of lines) {
    const escaped = escapePdfText(line);
    if (first) {
      commands.push(`(${escaped}) Tj`);
      first = false;
    } else {
      commands.push(`0 -${LEADING} Td`);
      commands.push(`(${escaped}) Tj`);
    }
  }
  commands.push("ET");
  return commands.join("\n");
}

function paginate(lines: string[], linesPerPage: number) {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages.length > 0 ? pages : [["No content"]];
}

function wrap(value: string, maxChars: number) {
  const result: string[] = [];
  for (const paragraph of value.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        if (current) result.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

function normalizeValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return yesNo(value);
  return String(value ?? "").trim() || "-";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function humanizeType(value: ReportDocument["type"]) {
  if (value === "PRESTART") return "Pre-start";
  if (value === "SWMS") return "SWMS";
  return "Report";
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
