export enum InspectionStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
  NA = 'NA'
}

export interface ChecklistItem {
  id: string;
  description: string;
  standardCriteria?: string; // เกณฑ์มาตรฐานการติดตั้ง (เช่น ค่า Loss ต้อง < 0.5dB)
  referenceImage?: string;   // รูปตัวอย่างงานที่ถูกต้อง (URL or Base64)
  status: InspectionStatus;
  remark?: string;
  photo?: string; // รูปถ่ายหน้างานจริง (Evidence)
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface Project {
  id: string;
  name: string;
  contractor: string;
  equipmentType: string;
  siteName: string;
  dateCreated: string;
  status: 'Draft' | 'In Progress' | 'Completed';
  sections: ChecklistSection[];
  progress: number;
}

export interface AIResponseSection {
  title: string;
  items: {
    description: string;
    standard: string;
  }[];
}