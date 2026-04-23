export type ReportFileType = "REPORT" | "PRESTART" | "SWMS";

export type ReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

export type ReportFormData = {
  documentDate: string;
  preparedBy: string;
  reviewedBy: string;
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
  siteAccessConfirmed: boolean;
  isolationRequired: boolean;
  ppeChecked: boolean;
  toolsChecked: boolean;
  permitsConfirmed: boolean;
  hazardsIdentified: string;
  controlsInPlace: string;
  preStartNotes: string;
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
  return {
    documentDate: new Date().toISOString().slice(0, 10),
    preparedBy: owner,
    reviewedBy: "",
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
    siteAccessConfirmed: false,
    isolationRequired: false,
    ppeChecked: false,
    toolsChecked: false,
    permitsConfirmed: false,
    hazardsIdentified: "",
    controlsInPlace: "",
    preStartNotes: "",
    swmsScope: "",
    swmsHazards: "",
    swmsControls: "",
    swmsResidualRisk: "",
    swmsReviewNotes: "",
    signatures: "",
  };
}
