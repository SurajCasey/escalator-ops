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
  preStartWorkType: string;           // "What type(s) of works are you performing?"
  preStartArea: string;               // "What area will you be working?"
  preStartEquipmentType: string;      // "What type of equipment are you working on?"
  preStartVisualInspection: boolean;  // "Have you completed a visual safety inspection…?"

  // Safety Audit section
  preStartPpeAppropriate: boolean;    // "Do you have the appropriate PPE…?"
  preStartSiteInduction: boolean;     // "Have you received a site induction?"
  preStartMachineryGoodOrder: boolean;// "Have you checked if our machinery is in good working order?"
  preStartPreMountChecks: boolean;    // "Have you completed your checks before mounting…?"
  preStartReverseCheck: boolean;      // "Have you checked if the escalator drives in reverse…?"
  preStartConcernsDamage: boolean;    // "Is there any concerns or damaged…?" (Yes = flagged)
  preStartPhotos: boolean;            // "Do you have any photos on the equipment…?"
  preStartBarricades: boolean;        // "Have you used the maintenance barricades…?"
  preStartAnyConcerns: boolean;       // "Do you have any concerns or comments?" (Yes = flagged)

  // Sign-off
  preStartWorkerNames: string;        // "Name of workers"
  preStartSupervisorName: string;     // Supervisor name for sign-off

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
  swmsSupervisorReview: string;
  swmsManagementReview: string;
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
    preStartVisualInspection: false,
    preStartPpeAppropriate: false,
    preStartSiteInduction: false,
    preStartMachineryGoodOrder: false,
    preStartPreMountChecks: false,
    preStartReverseCheck: false,
    preStartConcernsDamage: false,
    preStartPhotos: false,
    preStartBarricades: false,
    preStartAnyConcerns: false,
    preStartWorkerNames: owner,
    preStartSupervisorName: owner,

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
    swmsSupervisorReview: "",
    swmsManagementReview: "",
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
