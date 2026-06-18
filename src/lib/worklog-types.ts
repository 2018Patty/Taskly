export interface WorkLog {
  id: string;
  user_id: string;
  work_date: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  exclude_lunch: boolean;
  work_type_code: string;
  work_type_role: string | null;
  images: string[];
  created_at: string;
}

export type WorkLogFormData = Omit<WorkLog, 'id' | 'user_id' | 'created_at'>;

export const WORK_TYPES = [
  {
    mainCode: '1',
    mainLabel: 'การเรียนการสอน',
    subs: [
      { code: '1.1', label: 'การเรียนการสอน', hasRole: false },
    ],
  },
  {
    mainCode: '3',
    mainLabel: 'บริการวิชาการ',
    subs: [
      { code: '3.1.1', label: 'วิทยากรภายในองค์กร',                                          hasRole: false },
      { code: '3.1.2', label: 'วิทยากรภายนอกองค์กร',                                         hasRole: false },
      { code: '3.27',  label: 'ภาระงานบริการวิชาการ',                                         hasRole: false },
      { code: '3.24',  label: 'การให้บริการวิชาการที่ทำในลักษณะ Consultant',                  hasRole: false },
      { code: '3.25',  label: 'การออกให้บริการชุมชน, พัฒนาชุมชน',                             hasRole: false },
      { code: '3.5',   label: 'ประชุมในฐานกรรมการแต่งตั้งจากหน่วยงานภายนอก',                  hasRole: false },
    ],
  },
  {
    mainCode: '4',
    mainLabel: 'ภาระงานอื่น ๆ',
    subs: [
      { code: '4.4.1', label: 'เข้าร่วมประชุม/ปฏิบัติงานภายในวิทยาเขต ในฐานะ', hasRole: true  },
      { code: '4.8',   label: 'งานอื่น ๆ',                                       hasRole: false },
    ],
  },
] as const;

export type WorkTypeSub = {
  code: string;
  label: string;
  hasRole: boolean;
};

export function calcHours(startTime: string, endTime: string, excludeLunch = false): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  let diffMins = endMins - startMins;
  if (diffMins <= 0) return 0;

  if (excludeLunch) {
    const lunchStart = 12 * 60;
    const lunchEnd   = 13 * 60;
    if (startMins < lunchEnd && endMins > lunchStart) {
      diffMins -= Math.min(endMins, lunchEnd) - Math.max(startMins, lunchStart);
    }
  }

  return diffMins > 0 ? parseFloat((diffMins / 60).toFixed(2)) : 0;
}

export function formatHours(hours: number): string {
  if (hours <= 0) return '0 ชม.';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} น.`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} น.`;
}

export function getWorkTypeSub(code: string): WorkTypeSub | null {
  for (const group of WORK_TYPES) {
    for (const sub of group.subs) {
      if (sub.code === code) return sub as WorkTypeSub;
    }
  }
  return null;
}

export function getWorkTypeMainCode(code: string): string {
  return code.split('.')[0];
}

export function getWorkTypeFullLabel(log: WorkLog): string {
  const sub = getWorkTypeSub(log.work_type_code);
  if (!sub) return log.work_type_code;
  if (sub.hasRole && log.work_type_role) return `${sub.label}${log.work_type_role}`;
  return sub.label;
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
}
