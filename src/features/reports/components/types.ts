export type ReportFileType = "REPORT" | "PRESTART" | "SWMS";

export type ReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

export type SwmsWorker = {
  name: string;
  classification: string;
  employedBy: string;
  date: string;
};

export type ReportFormData = {
  // ── Shared ────────────────────────────────────────────────────────────────
  documentDate: string;
  preparedBy: string;
  reviewedBy: string;

  // ── General Report ────────────────────────────────────────────────────────
  crewNames: string;
  supervisorName: string;
  startTime: string;
  finishTime: string;
  weather: string;
  emergencyContact: string;
  reportSummary: string;
  workCompleted: string;
  incidents: string;
  materialsUsed: string;
  equipmentUsed: string;
  customerNotes: string;

  // ── Pre-Start OH&S and Site Inspection ────────────────────────────────────
  // Cover / summary
  preStartSiteLocation: string;       // "Site Location"
  preStartDateTime: string;           // date+time string shown on cover

  // Prestart Audit section
  preStartWorkType: string;               // "What type(s) of works are you performing?"
  preStartArea: string;                   // "What area will you be working?"
  preStartEquipmentType: string;          // Selected equipment option (TK Elevator | Otis | Liftronic | Other)
  preStartEquipmentOther: string;         // Free-text when "Other" is selected
  preStartVisualInspection: boolean | null; // Yes / No / N/A

  // Safety Audit section
  preStartPpeAppropriate: boolean | null;     // Yes / No / N/A
  preStartSiteInduction: boolean | null;      // Yes / No / N/A
  preStartMachineryGoodOrder: boolean | null; // Yes / No / N/A
  preStartPreMountChecks: boolean | null;     // Yes / No / N/A
  preStartReverseCheck: boolean | null;       // Yes / No / N/A
  preStartConcernsDamage: boolean | null;     // Yes (bad/red) / No (good/green) / N/A
  preStartBarricades: boolean | null;         // Yes / No / N/A
  preStartAnyConcerns: string;                // Free-text comments / concerns

  // Sign-off
  preStartWorkerNames: string;        // "Name of workers"
  preStartSupervisorName: string;     // Supervisor name for sign-off
  preStartSignature: string;          // Base64 data URL from signature canvas

  // Legacy (kept for backward compat)
  siteAccessConfirmed: boolean;
  isolationRequired: boolean;
  ppeChecked: boolean;
  toolsChecked: boolean;
  permitsConfirmed: boolean;
  hazardsIdentified: string;
  controlsInPlace: string;
  preStartNotes: string;

  // ── SWMS / JSEA ───────────────────────────────────────────────────────────
  // Part 1 – Project & Task Identification
  swmsClientName: string;             // Client name (e.g. "Dee Why Gran")
  swmsJobSiteAddress: string;         // Job site address
  swmsContactName: string;
  swmsContactTitle: string;
  swmsContactPhone: string;
  swmsContactMobile: string;
  swmsContactEmail: string;
  swmsInitiatedBy: string;
  swmsDate: string;                   // Date shown large on cover (dd/mm/yyyy)
  swmsNumber: string;                 // SWMS No.
  swmsRev: string;                    // Rev
  swmsRevDate: string;                // Rev Date
  swmsDescriptionOfWork: string;      // Description of Work to be Undertaken
  swmsSupervisorReview: string;       // Supervisor name
  swmsSupervisorDate: string;         // Supervisor review date (ISO)
  swmsManagementReview: string;       // Management name
  swmsManagementDate: string;         // Management review date (ISO)
  swmsWorkLocations: string;

  // Part 2 – Worker sign-off
  swmsWorkers: SwmsWorker[];          // Up to 10 workers

  // Legacy
  swmsScope: string;
  swmsHazards: string;
  swmsControls: string;
  swmsResidualRisk: string;
  swmsReviewNotes: string;
  signatures: string;
};

export type ReportDocument = {
  id: string;
  userId: string;
  createdByName: string;
  type: ReportFileType;
  title: string;
  status: ReportStatus;
  jobId: string | null;
  jobTitle: string;
  clientName: string;
  siteName: string;
  pdfPath: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  formData: ReportFormData;
};

export function createDefaultFormData(owner: string): ReportFormData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    // Shared
    documentDate: today,
    preparedBy: owner,
    reviewedBy: "",

    // General Report
    crewNames: owner,
    supervisorName: "",
    startTime: "",
    finishTime: "",
    weather: "",
    emergencyContact: "",
    reportSummary: "",
    workCompleted: "",
    incidents: "",
    materialsUsed: "",
    equipmentUsed: "",
    customerNotes: "",

    // Pre-Start
    preStartSiteLocation: "",
    preStartDateTime: today,
    preStartWorkType: "Escalator Cleaning",
    preStartArea: "",
    preStartEquipmentType: "",
    preStartEquipmentOther: "",
    preStartVisualInspection: null,
    preStartPpeAppropriate: null,
    preStartSiteInduction: null,
    preStartMachineryGoodOrder: null,
    preStartPreMountChecks: null,
    preStartReverseCheck: null,
    preStartConcernsDamage: null,
    preStartBarricades: null,
    preStartAnyConcerns: "",
    preStartWorkerNames: owner,
    preStartSupervisorName: owner,
    preStartSignature: "",

    // Legacy
    siteAccessConfirmed: false,
    isolationRequired: false,
    ppeChecked: false,
    toolsChecked: false,
    permitsConfirmed: false,
    hazardsIdentified: "",
    controlsInPlace: "",
    preStartNotes: "",

    // SWMS
    swmsClientName: "",
    swmsJobSiteAddress: "",
    swmsContactName: owner,
    swmsContactTitle: "Operator",
    swmsContactPhone: "",
    swmsContactMobile: "",
    swmsContactEmail: "",
    swmsInitiatedBy: owner,
    swmsDate: today,
    swmsNumber: "1",
    swmsRev: "1",
    swmsRevDate: "26.11.2025",
    swmsDescriptionOfWork: "",
    swmsSupervisorReview: "",
    swmsSupervisorDate: today,
    swmsManagementReview: "",
    swmsManagementDate: today,
    swmsWorkLocations: "",
    swmsWorkers: [
      { name: owner, classification: "Operator", employedBy: "SEC", date: today },
    ],

    // Legacy
    swmsScope: "",
    swmsHazards: "",
    swmsControls: "",
    swmsResidualRisk: "",
    swmsReviewNotes: "",
    signatures: "",
  };
}
