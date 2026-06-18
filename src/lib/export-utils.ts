import {
  AlignmentType, BorderStyle, Document, HeadingLevel,
  ImageRun, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Todo } from '@/components/task-calendar';
import {
  WorkLog, calcHours, formatHours, formatThaiDate,
  getWorkTypeFullLabel, getWorkTypeMainCode,
} from './worklog-types';

/* ─── helpers ─────────────────────────────────────────────── */

const STATUS_TH: Record<string, string> = {
  pending:     'ยังไม่เริ่ม',
  in_progress: 'กำลังทำ',
  completed:   'เสร็จสิ้น',
};

function thaiDateNow() {
  return new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' น.';
}

function fmtDeadline(s?: string) {
  if (!s) return 'ไม่ระบุ';
  return new Date(s).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' น.';
}

/* Fetch image and return docx-ready data (null = skip) */
async function fetchImageData(url: string): Promise<{
  data: ArrayBuffer; width: number; height: number; type: 'jpg' | 'png' | 'gif';
} | null> {
  try {
    const [resp, dims] = await Promise.all([
      fetch(url).then(r => r.arrayBuffer()),
      new Promise<{ w: number; h: number }>(resolve => {
        const img = new window.Image();
        img.onload  = () => resolve({ w: img.naturalWidth,  h: img.naturalHeight });
        img.onerror = () => resolve({ w: 480, h: 270 });
        img.src = url;
      }),
    ]);
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    const type = ext === 'png' ? 'png' : ext === 'gif' ? 'gif' : 'jpg';
    const maxW  = 460;
    const scale = dims.w > maxW ? maxW / dims.w : 1;
    return { data: resp, width: Math.round(dims.w * scale), height: Math.round(dims.h * scale), type };
  } catch { return null; }
}

/* ─── docx building blocks ────────────────────────────────── */

const CORAL = 'ED6956';
const LIGHT = 'FFF5F4';
const GREY  = 'F1F5F9';

function makeHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 36, color: CORAL, font: 'Tahoma' })],
  });
}

function makeSubtitle(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text, size: 22, color: '64748B', font: 'Tahoma' })],
  });
}

function makeSectionRule() {
  return new Paragraph({
    spacing: { before: 240, after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
    children: [],
  });
}

function makeLabel(label: string, value: string, bold = false) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: '475569', font: 'Tahoma' }),
      new TextRun({ text: value, bold, size: 20, color: '1E293B', font: 'Tahoma' }),
    ],
  });
}

function makeBody(text: string) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, color: '374151', font: 'Tahoma' })],
  });
}

function makeItemHeader(n: number, title: string) {
  return new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [
      new TextRun({ text: `${n}.  `, bold: true, size: 26, color: CORAL, font: 'Tahoma' }),
      new TextRun({ text: title, bold: true, size: 26, color: '1E293B', font: 'Tahoma' }),
    ],
  });
}

function makeSummaryTable(rows: [string, string][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    rows: [
      new TableRow({
        children: rows.map(([label, value]) =>
          new TableCell({
            width: { size: Math.floor(100 / rows.length), type: WidthType.PERCENTAGE },
            shading: { fill: LIGHT, type: ShadingType.CLEAR },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 4, color: CORAL },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: CORAL },
              left:   { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right:  { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: value, bold: true, size: 28, color: CORAL, font: 'Tahoma' })
              ]}),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: label, size: 18, color: '64748B', font: 'Tahoma' })
              ]}),
            ],
          })
        ),
      }),
    ],
  });
}

/* ═══════════════════════════════════════════════════════════
   TODO EXPORTS
═══════════════════════════════════════════════════════════ */

export async function exportTodoToWord(todos: Todo[], withImages: boolean) {
  const total      = todos.length;
  const pending    = todos.filter(t => t.status === 'pending').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const completed  = todos.filter(t => t.status === 'completed').length;

  const children: (Paragraph | Table)[] = [
    makeHeading('Taskly — รายการงาน TodoList'),
    makeSubtitle(`สร้างเมื่อ ${thaiDateNow()}`),
    makeSummaryTable([
      ['ทั้งหมด',     String(total)],
      ['ยังไม่เริ่ม',  String(pending)],
      ['กำลังทำ',     String(inProgress)],
      ['เสร็จสิ้น',   String(completed)],
    ]),
    makeSectionRule(),
  ];

  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    children.push(makeItemHeader(i + 1, t.title));
    children.push(makeLabel('สถานะ',       STATUS_TH[t.status] ?? t.status));
    children.push(makeLabel('ประเภท',      t.category || 'General'));
    children.push(makeLabel('วันที่บันทึก', t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่ระบุ'));
    if (t.start_time) children.push(makeLabel('เวลาเริ่มต้น', t.start_time.slice(0, 5) + ' น.'));
    children.push(makeLabel('กำหนดส่ง',   fmtDeadline(t.deadline)));
    if (t.description?.trim()) {
      children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: 'รายละเอียด:', bold: true, size: 20, color: '475569', font: 'Tahoma' })] }));
      for (const line of t.description.split('\n'))
        children.push(makeBody(`   ${line}`));
    }

    if (withImages && t.images?.length) {
      children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `รูปภาพ (${t.images.length} รูป)`, bold: true, size: 20, color: '475569', font: 'Tahoma' })] }));
      for (const url of t.images) {
        const img = await fetchImageData(url);
        if (img) {
          children.push(new Paragraph({
            spacing: { before: 80, after: 80 },
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: img.type })],
          }));
        }
      }
    }

    if (i < todos.length - 1) children.push(makeSectionRule());
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `TodoList_${withImages ? 'withImages_' : ''}${new Date().toISOString().slice(0, 10)}.docx`);
}

export function exportTodoToExcel(todos: Todo[]) {
  const header = ['ลำดับ', 'ชื่องาน', 'รายละเอียด', 'สถานะ', 'ประเภท', 'วันที่บันทึก', 'เวลาเริ่มต้น', 'กำหนดส่ง', 'จำนวนรูปภาพ'];
  const rows = todos.map((t, i) => [
    i + 1,
    t.title,
    t.description || '',
    STATUS_TH[t.status] ?? t.status,
    t.category || 'General',
    t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('th-TH') : '',
    t.start_time ? t.start_time.slice(0, 5) : '',
    t.deadline ? new Date(t.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    t.images?.length ?? 0,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  /* column widths */
  ws['!cols'] = [
    { wch: 6 }, { wch: 36 }, { wch: 40 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'TodoList');
  XLSX.writeFile(wb, `TodoList_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════
   WORKLOG EXPORTS
═══════════════════════════════════════════════════════════ */

const MAIN_LABEL: Record<string, string> = {
  '1': 'การเรียนการสอน',
  '3': 'บริการวิชาการ',
  '4': 'ภาระงานอื่น ๆ',
};

export async function exportWorklogToWord(logs: WorkLog[], period: string, withImages: boolean) {
  const totalHours = logs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0);
  const uniqueDays = new Set(logs.map(l => l.work_date)).size;

  const children: (Paragraph | Table)[] = [
    makeHeading('Taskly — รายงานภาระงาน'),
    makeSubtitle(`ช่วงเวลา: ${period}`),
    makeSubtitle(`สร้างเมื่อ ${thaiDateNow()}`),
    makeSummaryTable([
      ['จำนวนรายการ',   String(logs.length)],
      ['ชั่วโมงรวม',    formatHours(totalHours)],
      ['วันปฏิบัติงาน', `${uniqueDays} วัน`],
    ]),
    makeSectionRule(),
  ];

  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    const hours    = calcHours(l.start_time, l.end_time, l.exclude_lunch);
    const mainCode = getWorkTypeMainCode(l.work_type_code);
    const fullLabel = getWorkTypeFullLabel(l);

    children.push(makeItemHeader(i + 1, l.title));
    children.push(makeLabel('วันที่ปฏิบัติงาน', formatThaiDate(l.work_date)));
    children.push(makeLabel('ประเภทงาน',       `${l.work_type_code} – ${fullLabel}`));
    children.push(makeLabel('หมวดงาน',         MAIN_LABEL[mainCode] ?? mainCode));
    if (l.work_type_role) children.push(makeLabel('ฐานะ/บทบาท', l.work_type_role));
    children.push(makeLabel('เวลา',            `${l.start_time.slice(0, 5)} – ${l.end_time.slice(0, 5)} น.`));
    children.push(makeLabel('ชั่วโมงรวม',      `${formatHours(hours)}${l.exclude_lunch ? ' (หักพักเที่ยง 1 ชม.)' : ''}`));
    if (l.description?.trim()) {
      children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: 'รายละเอียด:', bold: true, size: 20, color: '475569', font: 'Tahoma' })] }));
      for (const line of l.description.split('\n'))
        children.push(makeBody(`   ${line}`));
    }

    if (withImages && l.images?.length) {
      children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `รูปภาพ (${l.images.length} รูป)`, bold: true, size: 20, color: '475569', font: 'Tahoma' })] }));
      for (const url of l.images) {
        const img = await fetchImageData(url);
        if (img) {
          children.push(new Paragraph({
            spacing: { before: 80, after: 80 },
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: img.type })],
          }));
        }
      }
    }

    if (i < logs.length - 1) children.push(makeSectionRule());
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ภาระงาน_${withImages ? 'withImages_' : ''}${new Date().toISOString().slice(0, 10)}.docx`);
}

export function exportWorklogToExcel(logs: WorkLog[], period: string) {
  const header = [
    'ลำดับ', 'วันที่', 'ชื่องาน', 'รหัสประเภท', 'หมวดงาน', 'ประเภทงานละเอียด',
    'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ชั่วโมง', 'หักพักเที่ยง', 'รายละเอียด', 'จำนวนรูปภาพ',
  ];

  const rows = logs.map((l, i) => {
    const hours    = calcHours(l.start_time, l.end_time, l.exclude_lunch);
    const mainCode = getWorkTypeMainCode(l.work_type_code);
    const fullLabel = getWorkTypeFullLabel(l);
    return [
      i + 1,
      formatThaiDate(l.work_date),
      l.title,
      l.work_type_code,
      MAIN_LABEL[mainCode] ?? mainCode,
      fullLabel,
      l.start_time.slice(0, 5),
      l.end_time.slice(0, 5),
      Math.round(hours * 100) / 100,
      l.exclude_lunch ? 'ใช่' : 'ไม่',
      l.description || '',
      l.images?.length ?? 0,
    ];
  });

  /* summary sheet */
  const summaryHeader = ['ช่วงเวลา', 'จำนวนรายการ', 'ชั่วโมงรวม', 'วันปฏิบัติงาน'];
  const totalHours = logs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0);
  const uniqueDays = new Set(logs.map(l => l.work_date)).size;
  const summaryRow  = [period, logs.length, Math.round(totalHours * 100) / 100, uniqueDays];

  const wb = XLSX.utils.book_new();

  /* detail sheet */
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 40 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'รายการภาระงาน');

  /* summary sheet */
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeader, summaryRow]);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุป');

  XLSX.writeFile(wb, `ภาระงาน_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
