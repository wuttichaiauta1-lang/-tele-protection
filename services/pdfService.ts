import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, InspectionStatus } from '../types';

// Helper to load font binary
const loadThaiFont = async (): Promise<string> => {
  try {
    // Fetch Sarabun font from Google Fonts raw repository or a reliable CDN
    const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf');
    const buffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Binary String for jsPDF
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary); // Return Base64
  } catch (error) {
    console.error("Error loading Thai font:", error);
    return '';
  }
};

export const generateInspectionReport = async (project: Project) => {
  const doc = new jsPDF();
  
  // 1. Load and Add Thai Font
  const fontBase64 = await loadThaiFont();
  if (fontBase64) {
      doc.addFileToVFS('Sarabun-Regular.ttf', fontBase64);
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
      doc.setFont('Sarabun');
  } else {
      console.warn("Could not load Thai font. Text may not render correctly.");
  }

  // 2. Header Information
  doc.setFontSize(18);
  doc.text('รายงานผลการตรวจสอบงานติดตั้ง (Installation Inspection Report)', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`โครงการ: ${project.name}`, 14, 30);
  doc.text(`สถานที่: ${project.siteName}`, 14, 36);
  doc.text(`ผู้รับเหมา: ${project.contractor}`, 14, 42);
  doc.text(`ประเภทอุปกรณ์: ${project.equipmentType}`, 14, 48);
  
  const today = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
  });
  doc.text(`วันที่พิมพ์รายงาน: ${today}`, 150, 30, { align: 'left' });
  doc.text(`สถานะโครงการ: ${project.status === 'Completed' ? 'เสร็จสมบูรณ์' : 'กำลังดำเนินการ'}`, 150, 36);
  doc.text(`ความคืบหน้า: ${project.progress}%`, 150, 42);

  // 3. Summary Statistics
  const totalItems = project.sections.reduce((acc, s) => acc + s.items.length, 0);
  const passedItems = project.sections.reduce((acc, s) => acc + s.items.filter(i => i.status === InspectionStatus.PASS).length, 0);
  const failedItems = project.sections.reduce((acc, s) => acc + s.items.filter(i => i.status === InspectionStatus.FAIL).length, 0);
  const naItems = project.sections.reduce((acc, s) => acc + s.items.filter(i => i.status === InspectionStatus.NA).length, 0);
  const pendingItems = totalItems - passedItems - failedItems - naItems;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 55, 196, 55);

  doc.text(`สรุปผล: ผ่าน (${passedItems}) | ไม่ผ่าน (${failedItems}) | N/A (${naItems}) | ยังไม่ตรวจ (${pendingItems})`, 14, 62);
  
  if (failedItems > 0) {
      doc.setTextColor(220, 53, 69); // Red color
      doc.text(`* มีรายการที่ต้องแก้ไข (Defect) จำนวน ${failedItems} รายการ โปรดดูรายละเอียดด้านล่าง`, 14, 68);
      doc.setTextColor(0, 0, 0); // Reset to black
  }

  let yPos = 75;

  // 4. Generate Tables for each Section
  project.sections.forEach((section) => {
    // Prepare table data
    const tableBody = section.items.map(item => {
        let statusText = '';
        switch (item.status) {
            case InspectionStatus.PASS: statusText = 'ผ่าน'; break;
            case InspectionStatus.FAIL: statusText = 'ไม่ผ่าน (แก้ไข)'; break;
            case InspectionStatus.NA: statusText = 'N/A'; break;
            default: statusText = 'รอตรวจ';
        }
        
        return [
            item.description,
            item.standardCriteria || '-', // New Column
            statusText,
            item.remark || '-'
        ];
    });

    // Add Section Title
    if (yPos > 270) {
        doc.addPage();
        yPos = 20;
    }
    
    // Use autoTable to generate the table
    autoTable(doc, {
        startY: yPos,
        head: [[section.title, 'มาตรฐาน/เกณฑ์', 'สถานะ', 'หมายเหตุ']],
        body: tableBody,
        styles: { 
            font: 'Sarabun', // Use the Thai font
            fontSize: 9,
            cellPadding: 3,
            valign: 'top'
        },
        headStyles: {
            fillColor: [41, 128, 185], // Blue header
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 70 }, // Description
            1: { cellWidth: 50 }, // Standard (New)
            2: { cellWidth: 25, halign: 'center' }, // Status
            3: { cellWidth: 'auto' } // Remark
        },
        // Highlight FAIL rows
        didParseCell: (data) => {
            if (data.section === 'body') {
                 const rawStatus = section.items[data.row.index].status;
                 if (rawStatus === InspectionStatus.FAIL) {
                     data.cell.styles.textColor = [220, 53, 69]; // Red text
                     data.cell.styles.fontStyle = 'bold';
                 } else if (rawStatus === InspectionStatus.PASS) {
                     data.cell.styles.textColor = [25, 135, 84]; // Green text
                 }
            }
        },
        margin: { top: 20 },
        theme: 'grid'
    });

    // Update yPos for next loop (autoTable stores final Y in lastAutoTable.finalY)
    yPos = (doc as any).lastAutoTable.finalY + 15; 
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`หน้า ${i} / ${pageCount} - TeleGuard Inspect System`, 196, 290, { align: 'right' });
  }

  // Save the PDF
  doc.save(`${project.name}_Report.pdf`);
};