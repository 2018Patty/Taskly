'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import {
  LogOut, Sun, Moon, Plus, Grid, ClipboardList, BarChart3,
  Sparkles, User, Layers, Upload, Trash2, Edit2, CalendarDays, Wand2, X, Check,
  CalendarClock, Settings2,
} from 'lucide-react';

/* ── Types ── */
type ParsedEntry = {
  course_code: string;
  course_name: string;
  section: string | null;
  credits: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
};

export type TimetableEntry = {
  id: string;
  user_id: string;
  semester: string;
  course_code: string;
  course_name: string;
  section: string | null;
  credits: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  color: string;
  weeks: number[];
  created_at: string;
};

/* ── Constants ── */
const TIME_START = 8 * 60;
const TIME_END = 17 * 60;
const TOTAL_MIN = TIME_END - TIME_START;
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const LANE_H = 54;
const TOTAL_WEEKS = 18;
const ALL_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

function isTaughtInWeek(entry: TimetableEntry, w: number): boolean {
  return entry.weeks?.includes(w) ?? false;
}

/* ── Schedule helpers ── */
type ScheduleRow = { week: number; date: Date; entry: TimetableEntry };

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function calcDate(startISO: string, week: number, dayOfWeek: number): Date {
  const base = new Date(startISO);
  const d = new Date(base);
  // week 1 = start of semester, week -1 = 1 week before, week -2 = 2 weeks before
  const weekOffset = week > 0 ? week - 1 : week;
  d.setDate(base.getDate() + weekOffset * 7 + (dayOfWeek - 1));
  return d;
}

function fmtDateShort(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
}

function weekDateRange(startISO: string, week: number): string {
  const mon = calcDate(startISO, week, 1);
  const fri = calcDate(startISO, week, 5);
  const yr  = mon.getFullYear();
  if (mon.getMonth() === fri.getMonth()) {
    return `${mon.getDate()}–${fri.getDate()} ${THAI_MONTHS[mon.getMonth()]} ${yr}`;
  }
  return `${mon.getDate()} ${THAI_MONTHS[mon.getMonth()]}–${fri.getDate()} ${THAI_MONTHS[fri.getMonth()]} ${yr}`;
}

const DAYS = [
  { key: 1, th: 'จันทร์',    en: 'Monday' },
  { key: 2, th: 'อังคาร',    en: 'Tuesday' },
  { key: 3, th: 'พุธ',       en: 'Wednesday' },
  { key: 4, th: 'พฤหัสบดี',  en: 'Thursday' },
  { key: 5, th: 'ศุกร์',     en: 'Friday' },
];

const SEMESTERS = ['1/2026','2/2026','1/2025','2/2025','1/2024','2/2024'];

const COLORS: Record<string, { light: string; text: string; dot: string }> = {
  sky:    { light: 'bg-sky-100 border-sky-300',    text: 'text-sky-800',    dot: 'bg-sky-400' },
  teal:   { light: 'bg-teal-100 border-teal-300',  text: 'text-teal-800',   dot: 'bg-teal-400' },
  amber:  { light: 'bg-amber-100 border-amber-300', text: 'text-amber-800',  dot: 'bg-amber-400' },
  rose:   { light: 'bg-rose-100 border-rose-300',   text: 'text-rose-800',   dot: 'bg-rose-400' },
  violet: { light: 'bg-violet-100 border-violet-300', text: 'text-violet-800', dot: 'bg-violet-400' },
  green:  { light: 'bg-green-100 border-green-300', text: 'text-green-800',  dot: 'bg-green-400' },
  indigo: { light: 'bg-indigo-100 border-indigo-300', text: 'text-indigo-800', dot: 'bg-indigo-400' },
  orange: { light: 'bg-orange-100 border-orange-300', text: 'text-orange-800', dot: 'bg-orange-400' },
};
const COLOR_KEYS = Object.keys(COLORS);

/* ── Helpers ── */
function timeToMin(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function assignLanes(entries: TimetableEntry[]): Array<TimetableEntry & { lane: number }> {
  const sorted = [...entries]
    .filter(e => e.start_time && e.end_time)
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
  const laneEnds: number[] = [];
  return sorted.map(entry => {
    const startMin = timeToMin(entry.start_time);
    const endMin = timeToMin(entry.end_time);
    let lane = laneEnds.findIndex(end => end <= startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(endMin); }
    else laneEnds[lane] = endMin;
    return { ...entry, lane };
  });
}

/* ── Component ── */
export default function TimetablePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [semester, setSemester] = useState('1/2026');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[] | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [semesterStart, setSemesterStart] = useState<string>('');
  const [semesterPreWeeks, setSemesterPreWeeks] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester', semester)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) {
      setDbError(true);
    } else {
      setDbError(false);
      setEntries(data ?? []);
    }
    setLoading(false);
  }, [user, semester]);

  useEffect(() => { if (user) fetchEntries(); }, [user, fetchEntries]);

  useEffect(() => {
    if (!user) return;
    const key = `timetable_ref_${semester}_${user.id}`;
    setRefImage(localStorage.getItem(key));
    setSemesterStart(localStorage.getItem(`timetable_start_${semester}_${user.id}`) || '');
    setSemesterPreWeeks(Number(localStorage.getItem(`timetable_pre_${semester}_${user.id}`)) || 0);
  }, [semester, user]);

  const handleSemesterStartChange = (val: string) => {
    setSemesterStart(val);
    if (!user) return;
    const key = `timetable_start_${semester}_${user.id}`;
    if (val) localStorage.setItem(key, val);
    else localStorage.removeItem(key);
  };

  const handleSemesterPreWeeksChange = (val: number) => {
    setSemesterPreWeeks(val);
    if (!user) return;
    const key = `timetable_pre_${semester}_${user.id}`;
    if (val > 0) localStorage.setItem(key, String(val));
    else localStorage.removeItem(key);
  };

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `timetable/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('todo-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('todo-images').getPublicUrl(path);
      setRefImage(data.publicUrl);
      localStorage.setItem(`timetable_ref_${semester}_${user.id}`, data.publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeRefImg = () => {
    if (!user) return;
    setRefImage(null);
    localStorage.removeItem(`timetable_ref_${semester}_${user.id}`);
  };

  const handleAutoParse = async () => {
    if (!refImage) return;
    setParsing(true);
    try {
      const res = await fetch('/api/parse-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: refImage }),
      });
      const { entries } = await res.json();
      setParsedEntries(entries ?? []);
    } catch (err) {
      console.error('Parse error:', err);
      setParsedEntries([]);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveParsed = async () => {
    if (!parsedEntries || !user) return;
    const total = parsedEntries.length;
    setSaveProgress({ done: 0, total });
    for (let i = 0; i < parsedEntries.length; i++) {
      const e = parsedEntries[i];
      await supabase.from('timetable_entries').insert({
        user_id: user.id,
        semester,
        course_code: e.course_code,
        course_name: e.course_name,
        section: e.section ?? null,
        credits: e.credits ?? null,
        day_of_week: e.day_of_week ?? null,
        start_time: e.start_time ?? null,
        end_time: e.end_time ?? null,
        room: e.room ?? null,
        color: COLOR_KEYS[i % COLOR_KEYS.length],
        weeks: ALL_WEEKS,
      });
      setSaveProgress({ done: i + 1, total });
    }
    setParsedEntries(null);
    setSaveProgress(null);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return;
    await supabase.from('timetable_entries').delete().eq('id', id);
    fetchEntries();
  };

  /* Color map: course_code → color (from DB entry or auto-assigned) */
  const courseCodes = Array.from(new Set(entries.map(e => e.course_code))).sort();
  const colorMap: Record<string, string> = {};
  courseCodes.forEach((code, i) => {
    const entry = entries.find(e => e.course_code === code);
    colorMap[code] = entry?.color && COLORS[entry.color] ? entry.color : COLOR_KEYS[i % COLOR_KEYS.length];
  });

  const byDay = DAYS.reduce<Record<number, TimetableEntry[]>>((acc, d) => {
    acc[d.key] = entries.filter(e => e.day_of_week === d.key);
    return acc;
  }, {});
  const unspecified = entries.filter(e => !e.day_of_week);

  /* ── Schedule computation ── */
  const schedule = useMemo<ScheduleRow[]>(() => {
    if (!semesterStart) return [];
    const rows: ScheduleRow[] = [];
    for (const entry of entries) {
      if (!entry.day_of_week || !entry.start_time || !entry.weeks?.length) continue;
      for (const week of entry.weeks) {
        rows.push({ week, date: calcDate(semesterStart, week, entry.day_of_week), entry });
      }
    }
    rows.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      const da = a.entry.day_of_week ?? 0, db = b.entry.day_of_week ?? 0;
      if (da !== db) return da - db;
      return (a.entry.start_time || '').localeCompare(b.entry.start_time || '');
    });
    return rows;
  }, [entries, semesterStart]);

  const groupedWeeks = useMemo(() => {
    const map = new Map<number, ScheduleRow[]>();
    for (const row of schedule) {
      if (!map.has(row.week)) map.set(row.week, []);
      map.get(row.week)!.push(row);
    }
    return Array.from(map.entries()).map(([week, rows]) => ({ week, rows }));
  }, [schedule]);

  const preWeekCount = useMemo(() => {
    const neg = entries.flatMap(e => (e.weeks || []).filter(w => w < 0));
    return neg.length > 0 ? Math.abs(Math.min(...neg)) : 0;
  }, [entries]);

  const extendedWeeks = useMemo(() => {
    const totalPre = Math.max(preWeekCount, semesterPreWeeks);
    return [
      ...Array.from({ length: totalPre }, (_, i) => -(totalPre - i)),
      ...ALL_WEEKS,
    ];
  }, [preWeekCount, semesterPreWeeks]);

  const allScheduleWeeks = useMemo(() => {
    const weekSet = new Set<number>(groupedWeeks.map(g => g.week));
    for (let i = semesterPreWeeks; i >= 1; i--) weekSet.add(-i);
    return Array.from(weekSet).sort((a, b) => a - b);
  }, [groupedWeeks, semesterPreWeeks]);

  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-coral border-t-transparent" />
    </div>
  );
  if (!user) return null;

  const NavLink = ({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) =>
    active
      ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm">{icon}<span>{label}</span></span>
      : <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all">{icon}<span>{label}</span></Link>;

  return (
    <div className="min-h-screen pb-20 bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full bg-linear-to-r from-coral via-coral to-honey border-b border-white/20 shadow-lg shadow-coral/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Taskly</h1>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">Workspace ส่วนตัว</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}           label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}         label="TodoList" />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>}  label="บันทึกภาระงาน" />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}      label="Dashboard" />
            <NavLink href="/timetable"         icon={<CalendarDays size={13}/>}   label="ตารางสอน" active />
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30">
              <div className="h-6 w-6 rounded-lg bg-white/20 text-white flex items-center justify-center"><User size={14}/></div>
              <span className="text-xs font-semibold text-white truncate max-w-37.5">{user.email}</span>
            </div>
            <button onClick={toggleTheme} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
            </button>
            <button onClick={signOut} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all flex items-center gap-2">
              <LogOut size={18}/><span className="text-xs font-bold hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

        {/* ── Title + Controls ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><CalendarDays size={22}/></div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ตารางสอน</h2>
              <p className="text-xs text-slate-400 mt-0.5">จัดการตารางการสอนของคุณ</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral">
              {SEMESTERS.map(s => <option key={s} value={s} className="bg-white dark:bg-dark-surface">ภาคเรียน {s}</option>)}
            </select>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImg}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-surface border border-slate-200/50 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-white hover:border-coral hover:text-coral transition-all">
              {uploadingImg
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-coral border-t-transparent"/>
                : <Upload size={15}/>}
              อัปโหลดรูปตาราง
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImgUpload} className="hidden"/>
            {refImage && (
              <button
                onClick={handleAutoParse}
                disabled={parsing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 shadow-md shadow-violet-500/20 transition-all disabled:opacity-60">
                {parsing
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                  : <Wand2 size={15}/>}
                วิเคราะห์รูปอัตโนมัติ
              </button>
            )}
            <button
              onClick={() => router.push(`/timetable/form?semester=${semester}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-md shadow-coral/20 transition-all">
              <Plus size={15}/> เพิ่มวิชา
            </button>
          </div>
        </div>

        {/* ── DB Error ── */}
        {dbError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">ยังไม่พบตาราง timetable_entries ในฐานข้อมูล</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">กรุณารัน SQL ที่อยู่ใน database.sql (ส่วน timetable) ใน Supabase SQL Editor ก่อน</p>
          </div>
        )}

        {/* ── Reference Image ── */}
        {refImage && (
          <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/20 dark:border-white/5">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">รูปตารางสอนอ้างอิง</span>
              <button onClick={removeRefImg} className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={12}/> ลบรูป
              </button>
            </div>
            <img src={refImage} alt="ตารางสอนอ้างอิง" className="w-full max-h-120 object-contain bg-white dark:bg-dark-raised p-4"/>
          </div>
        )}

        {/* ── Timetable Grid ── */}
        <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/20 dark:border-white/5">
            <span className="text-sm font-extrabold text-slate-700 dark:text-white">
              ตารางสอน ภาคเรียน {semester}
            </span>
            <span className="text-xs text-slate-400">
              {entries.filter(e => e.day_of_week).length} คาบ · {courseCodes.length} วิชา
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-215 p-4 space-y-0">

              {/* Time header */}
              <div className="flex mb-1">
                <div className="w-28 shrink-0"/>
                <div className="flex-1 relative" style={{ height: '28px' }}>
                  {HOURS.map((h, i) => {
                    const pct = (i / (HOURS.length - 1)) * 100;
                    const label = h < 12 ? `${String(h).padStart(2,'0')}:00 AM` : h === 12 ? '12:00 PM' : `${String(h - 12).padStart(2,'0')}:00 PM`;
                    return (
                      <div key={h} className="absolute top-0 flex flex-col items-center" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{label}</span>
                        <div className="w-px h-2 bg-slate-300/60 dark:bg-white/10 mt-0.5"/>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day rows */}
              {DAYS.map(day => {
                const dayEntries = byDay[day.key] || [];
                const laned = assignLanes(dayEntries);
                const numLanes = laned.length > 0 ? Math.max(...laned.map(e => e.lane)) + 1 : 1;
                const rowH = numLanes * LANE_H;

                return (
                  <div key={day.key} className="flex border-t border-slate-200/40 dark:border-white/5">
                    {/* Day label */}
                    <div className="w-28 shrink-0 flex items-center py-2 px-3">
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{day.th}</div>
                        <div className="text-[9px] text-slate-400">{day.en}</div>
                      </div>
                    </div>

                    {/* Course area */}
                    <div className="flex-1 relative bg-slate-50/40 dark:bg-dark-raised/20" style={{ height: `${rowH}px` }}>
                      {/* Grid lines */}
                      {HOURS.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-slate-200/40 dark:border-white/5"
                          style={{ left: `${(i / (HOURS.length - 1)) * 100}%` }}/>
                      ))}

                      {/* Course blocks */}
                      {laned.map(entry => {
                        const startMin = Math.max(timeToMin(entry.start_time), TIME_START);
                        const endMin   = Math.min(timeToMin(entry.end_time),   TIME_END);
                        if (endMin <= startMin) return null;
                        const leftPct  = ((startMin - TIME_START) / TOTAL_MIN) * 100;
                        const widthPct = ((endMin - startMin) / TOTAL_MIN) * 100;
                        const colorKey = colorMap[entry.course_code] || 'sky';
                        const col      = COLORS[colorKey] || COLORS.sky;

                        return (
                          <div
                            key={entry.id}
                            onClick={() => router.push(`/timetable/form?id=${entry.id}&semester=${semester}`)}
                            className={`absolute rounded-lg border cursor-pointer hover:opacity-85 hover:shadow-md transition-all ${col.light}`}
                            style={{
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              top:  `${entry.lane * LANE_H + 3}px`,
                              height: `${LANE_H - 6}px`,
                            }}>
                            {entry.weeks?.some(w => w < 0) && (
                              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50" title="มีสอนก่อนเปิดภาค"/>
                            )}
                            <div className="px-2 py-1 h-full overflow-hidden flex flex-col justify-center">
                              <div className={`text-[10px] font-extrabold leading-tight truncate ${col.text}`}>
                                {entry.course_code}{entry.section ? `(${entry.section})` : ''}
                              </div>
                              <div className="text-[9px] font-semibold leading-tight truncate text-slate-600">
                                {entry.course_name}
                              </div>
                              {entry.room && (
                                <div className="text-[9px] leading-tight text-slate-500 truncate">{entry.room}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Empty row placeholder */}
                      {laned.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] text-slate-300 dark:text-slate-700">—</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Unspecified schedule ── */}
        {unspecified.length > 0 && (
          <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
              ไม่ได้ระบุวัน/เวลา (กรุณาติดต่ออาจารย์เพื่อทราบรายละเอียด)
            </p>
            <div className="flex flex-wrap gap-2">
              {unspecified.map(e => {
                const colorKey = colorMap[e.course_code] || 'sky';
                const col = COLORS[colorKey] || COLORS.sky;
                return (
                  <div key={e.id}
                    onClick={() => router.push(`/timetable/form?id=${e.id}&semester=${semester}`)}
                    className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border ${col.light} hover:opacity-80 transition-opacity`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`}/>
                    <span className={`text-xs font-bold ${col.text}`}>{e.course_code}</span>
                    <span className="text-xs text-slate-600">{e.course_name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Course Count ── */}
        {!loading && !dbError && entries.length > 0 && (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-white">
              {courseCodes.length} วิชา ({entries.length} คาบ)
            </h3>
            <span className="text-xs text-slate-400">คลิกที่วิชาเพื่อแก้ไข</span>
          </div>
        )}

        {/* ── Course Cards ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200/40 dark:bg-dark-surface/40 animate-pulse h-44"/>
            ))}
          </div>
        ) : !dbError && courseCodes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseCodes.map(code => {
              const courseEntries = entries.filter(e => e.course_code === code);
              const first = courseEntries[0];
              const colorKey = colorMap[code] || 'sky';
              const col = COLORS[colorKey] || COLORS.sky;

              return (
                <div key={code} className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 overflow-hidden hover:shadow-xl transition-shadow">
                  {/* Card header */}
                  <div className={`px-4 py-3 border-b ${col.light}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`flex items-center gap-1.5 flex-wrap text-xs font-extrabold uppercase tracking-wider ${col.text}`}>
                          <span>{code}{first.section && <span className="font-semibold"> ({first.section})</span>}</span>
                          {courseEntries.some(e => (e.weeks || []).some(w => w < 0)) && (
                            <span className="inline-flex items-center text-[9px] font-bold text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40 border border-violet-300 dark:border-violet-700/50 px-1.5 py-0.5 rounded-md leading-tight normal-case tracking-normal">
                              ก่อนภาค
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-900 mt-0.5 leading-tight">{first.course_name}</div>
                        {first.credits && (
                          <div className="text-[10px] text-slate-500 mt-1 font-medium">{first.credits}</div>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/timetable/form?semester=${semester}&courseCode=${first.course_code}`)}
                        title="เพิ่มวันสอนใหม่"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-black/10 transition-colors shrink-0 text-slate-500 hover:text-slate-700">
                        <Plus size={12}/>
                        <span className="text-[10px] font-bold hidden sm:inline">เพิ่มวัน</span>
                      </button>
                    </div>
                  </div>

                  {/* Schedule table */}
                  <div className="p-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pb-2">วัน/เวลา</th>
                          <th className="text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pb-2">ห้อง</th>
                          <th className="w-14"/>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {courseEntries.map(e => (
                          <tr key={e.id}>
                            <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-300">
                              {e.day_of_week
                                ? `${DAYS.find(d => d.key === e.day_of_week)?.en} : ${fmtTime(e.start_time)}-${fmtTime(e.end_time)}`
                                : 'ไม่ได้ระบุ'}
                            </td>
                            <td className="py-1.5 text-slate-500 dark:text-slate-400">{e.room || '-'}</td>
                            <td className="py-1.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => router.push(`/timetable/form?id=${e.id}&semester=${semester}`)}
                                  title="แก้ไข"
                                  className="p-1 rounded-lg text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors">
                                  <Edit2 size={11}/>
                                </button>
                                <button
                                  onClick={() => handleDelete(e.id)}
                                  title="ลบ"
                                  className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <Trash2 size={11}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ── Weekly Summary ── */}
        {!loading && !dbError && entries.length > 0 && (
          <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-200/20 dark:border-white/5">
              <span className="text-sm font-extrabold text-slate-700 dark:text-white">สรุปตารางรายสัปดาห์</span>
              <span className="text-xs text-slate-400 ml-2">
                {extendedWeeks.some(w => w < 0) && <span className="text-violet-400 font-bold">+{extendedWeeks.filter(w => w < 0).length} ก่อนภาค · </span>}
                {TOTAL_WEEKS} สัปดาห์ · ภาคเรียน {semester}
              </span>
            </div>
            <div className="p-4">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pr-3 pb-2 w-52">วิชา</th>
                    {extendedWeeks.map((w, idx) => {
                      const isLastPre = w < 0 && idx + 1 < extendedWeeks.length && extendedWeeks[idx + 1] > 0;
                      return (
                        <th key={w} className={`text-center text-[10px] font-bold pb-2 px-0.5 ${w < 0 ? 'text-violet-400' : 'text-slate-400'} ${isLastPre ? 'border-r-2 border-violet-300 dark:border-violet-700' : ''}`}>
                          {w < 0 ? `P${-w}` : w}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {courseCodes.map(code => {
                    const courseEntries = entries.filter(e => e.course_code === code);
                    const colorKey = colorMap[code] || 'sky';
                    const col = COLORS[colorKey] || COLORS.sky;
                    return (
                      <tr key={code}>
                        <td className="pr-3 py-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`}/>
                            <div className="min-w-0">
                              <div className={`font-extrabold text-[11px] truncate ${col.text}`}>{code}</div>
                              <div className="text-[10px] text-slate-400 truncate leading-tight">{courseEntries[0]?.course_name}</div>
                            </div>
                          </div>
                        </td>
                        {extendedWeeks.map((w, idx) => {
                          const taught = courseEntries.some(e => isTaughtInWeek(e, w));
                          const isLastPre = w < 0 && idx + 1 < extendedWeeks.length && extendedWeeks[idx + 1] > 0;
                          return (
                            <td key={w} className={`py-1 px-0.5 ${isLastPre ? 'border-r-2 border-violet-300 dark:border-violet-700' : ''}`}>
                              <div className={`h-5 rounded ${taught ? col.dot : ''}`}/>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5 border-t border-slate-200/20 dark:border-white/5 flex items-center">
              <span className="text-[10px] text-slate-400 ml-auto">คลิกที่วิชาเพื่อแก้ไขสัปดาห์ที่สอน</span>
            </div>
          </div>
        )}

        {/* ── Detailed Teaching Schedule ── */}
        {!loading && !dbError && entries.length > 0 && (
          <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 overflow-hidden shadow-lg">
            {/* Header + start-date setting */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/20 dark:border-white/5">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-coral"/>
                <span className="text-sm font-extrabold text-slate-700 dark:text-white">ตารางรายละเอียดการสอน</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">ก่อนเปิดภาค</span>
                  <button
                    onClick={() => handleSemesterPreWeeksChange(Math.max(0, semesterPreWeeks - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 font-bold text-sm hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                    −
                  </button>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-300 w-4 text-center">{semesterPreWeeks}</span>
                  <button
                    onClick={() => handleSemesterPreWeeksChange(Math.min(8, semesterPreWeeks + 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 font-bold text-sm hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                    +
                  </button>
                  <span className="text-xs text-slate-400">สัปดาห์</span>
                </div>
                <label className="flex items-center gap-2">
                  <Settings2 size={13} className="text-slate-400"/>
                  <span className="text-xs text-slate-400">วันเริ่มสัปดาห์แรก (จันทร์)</span>
                  <input
                    type="date"
                    value={semesterStart}
                    onChange={e => handleSemesterStartChange(e.target.value)}
                    className="glass-input rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral"
                  />
                </label>
              </div>
            </div>

            {/* Body */}
            {!semesterStart ? (
              <div className="py-12 text-center space-y-1">
                <CalendarClock size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2"/>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">ระบุวันเริ่มต้นภาคเรียนก่อน</p>
                <p className="text-xs text-slate-400">เลือกวันจันทร์ของสัปดาห์ที่ 1 เพื่อคำนวณวันที่จริง</p>
              </div>
            ) : allScheduleWeeks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">ยังไม่มีวิชาที่กำหนดสัปดาห์ไว้ · ไปที่แต่ละวิชาเพื่อตั้งค่าสัปดาห์</p>
              </div>
            ) : (
              <div>
                {allScheduleWeeks.map((week, idx) => {
                  const prevWeek = idx > 0 ? allScheduleWeeks[idx - 1] : null;
                  const isFirstRegular = week > 0 && prevWeek !== null && prevWeek < 0;
                  const rows = groupedWeeks.find(g => g.week === week)?.rows ?? [];
                  return (
                    <React.Fragment key={week}>

                      {/* ── Semester-start separator ── */}
                      {isFirstRegular && (
                        <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-950/25 border-y border-emerald-200 dark:border-emerald-800/50">
                          <div className="flex-1 h-px bg-emerald-300 dark:bg-emerald-700/50"/>
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest whitespace-nowrap">
                            เปิดภาคการศึกษา
                          </span>
                          <div className="flex-1 h-px bg-emerald-300 dark:bg-emerald-700/50"/>
                        </div>
                      )}

                      {/* ── Week block ── */}
                      <div className={week < 0 ? 'border-l-4 border-violet-400 dark:border-violet-500 bg-violet-50/50 dark:bg-violet-950/20' : ''}>

                        {/* Week header */}
                        <div className={`flex items-center justify-between px-5 py-2.5 border-b sticky top-0 z-10 ${
                          week < 0
                            ? 'bg-violet-100/80 dark:bg-violet-900/50 border-violet-200 dark:border-violet-700/40'
                            : 'bg-slate-50/80 dark:bg-dark-raised/60 border-slate-200/30 dark:border-white/5'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-extrabold uppercase tracking-wide ${week < 0 ? 'text-violet-700 dark:text-violet-200' : 'text-slate-700 dark:text-slate-200'}`}>
                              {week < 0 ? `ก่อนเปิดภาค · สัปดาห์ที่ ${-week}` : `สัปดาห์ที่ ${week}`}
                            </span>
                            {week < 0 && rows.length > 0 && (
                              <span className="text-[9px] font-bold text-white bg-violet-500 px-1.5 py-0.5 rounded-full">
                                {rows.length} คาบ
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] ${week < 0 ? 'text-violet-500 dark:text-violet-400' : 'text-slate-400'}`}>
                            {weekDateRange(semesterStart, week)}
                          </span>
                        </div>

                        {/* Session rows or empty-pre-class placeholder */}
                        {rows.length === 0 && week < 0 ? (
                          <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-violet-100 dark:border-violet-900/30">
                            <div className="w-1 h-6 rounded-full bg-violet-300 dark:bg-violet-700 shrink-0"/>
                            <span className="text-xs text-violet-500 dark:text-violet-400 italic">ยังไม่มีวิชาที่กำหนดสอนในสัปดาห์นี้</span>
                          </div>
                        ) : (
                          rows.map((row, i) => {
                            const colorKey = colorMap[row.entry.course_code] || 'sky';
                            const col = COLORS[colorKey] || COLORS.sky;
                            const day = DAYS.find(d => d.key === row.entry.day_of_week);
                            return (
                              <div
                                key={i}
                                onClick={() => router.push(`/timetable/form?id=${row.entry.id}&semester=${semester}`)}
                                className={`flex items-center gap-3 px-5 py-3 border-b cursor-pointer transition-colors ${
                                  week < 0
                                    ? 'border-violet-100 dark:border-violet-900/25 hover:bg-violet-100/60 dark:hover:bg-violet-900/30'
                                    : 'border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-dark-raised/20'
                                }`}
                              >
                                {/* Color bar */}
                                <div className={`w-1 h-10 rounded-full shrink-0 ${col.dot}`}/>

                                {/* Day + date */}
                                <div className="w-24 shrink-0">
                                  <div className={`text-xs font-bold ${week < 0 ? 'text-violet-700 dark:text-violet-200' : 'text-slate-700 dark:text-slate-200'}`}>{day?.th}</div>
                                  <div className={`text-[11px] ${week < 0 ? 'text-violet-400 dark:text-violet-500' : 'text-slate-400'}`}>{fmtDateShort(row.date)}</div>
                                </div>

                                {/* Course info */}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs font-extrabold ${col.text}`}>
                                    {row.entry.course_code}
                                    {row.entry.section ? <span className="font-semibold opacity-70 ml-1">(Sec {row.entry.section})</span> : null}
                                  </div>
                                  <div className={`text-[11px] truncate ${week < 0 ? 'text-violet-700/70 dark:text-violet-300/70' : 'text-slate-600 dark:text-slate-300'}`}>{row.entry.course_name}</div>
                                </div>

                                {/* Time */}
                                <div className={`text-xs shrink-0 whitespace-nowrap font-medium ${week < 0 ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {fmtTime(row.entry.start_time)}–{fmtTime(row.entry.end_time)}
                                </div>

                                {/* Room */}
                                {row.entry.room && (
                                  <div className={`text-xs shrink-0 hidden sm:block ${week < 0 ? 'text-violet-400 dark:text-violet-500' : 'text-slate-400'}`}>{row.entry.room}</div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                <div className="px-5 py-2.5 text-right">
                  <span className="text-[10px] text-slate-400">{schedule.length} คาบ · คลิกเพื่อแก้ไข</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !dbError && entries.length === 0 && (
          <div className="glass rounded-2xl py-16 text-center border border-slate-200/40 dark:border-white/5">
            <CalendarDays size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-4"/>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">ยังไม่มีวิชาในตารางสอน</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              อัปโหลดรูปตารางสอนของคุณ แล้วเพิ่มวิชาทีละรายการ
            </p>
            <button
              onClick={() => router.push(`/timetable/form?semester=${semester}`)}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-lg shadow-coral/20 transition-all">
              <Plus size={16}/> เพิ่มวิชาแรก
            </button>
          </div>
        )}
      </main>

      {/* ── Auto-parse confirmation modal ── */}
      {parsedEntries !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200/50 dark:border-white/10 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/20 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Wand2 size={18} className="text-violet-500"/>
                <span className="text-sm font-extrabold text-slate-800 dark:text-white">ผลการวิเคราะห์</span>
                <span className="text-xs text-slate-400">({parsedEntries.length} วิชา)</span>
              </div>
              <button onClick={() => setParsedEntries(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} className="text-slate-500"/>
              </button>
            </div>

            {/* Entry list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {parsedEntries.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">ไม่พบข้อมูลวิชาในรูปภาพนี้</p>
              ) : (
                parsedEntries.map((e, i) => {
                  const dayName = e.day_of_week ? DAYS.find(d => d.key === e.day_of_week)?.en : null;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-dark-raised border border-slate-200/40 dark:border-white/5">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${COLORS[COLOR_KEYS[i % COLOR_KEYS.length]]?.dot}`}/>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white">{e.course_code}</span>
                          {e.section && <span className="text-xs text-slate-500">(Sec {e.section})</span>}
                          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{e.course_name}</span>
                          {e.credits && <span className="text-[10px] text-slate-400 shrink-0">{e.credits}</span>}
                        </div>
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          {dayName && <span className="text-[10px] text-slate-500">{dayName}</span>}
                          {e.start_time && e.end_time && (
                            <span className="text-[10px] text-slate-500">{e.start_time}–{e.end_time}</span>
                          )}
                          {e.room && <span className="text-[10px] text-slate-500">ห้อง {e.room}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal footer */}
            {parsedEntries.length > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200/20 dark:border-white/5 bg-slate-50/50 dark:bg-dark-raised/30">
                {saveProgress ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-coral border-t-transparent"/>
                    กำลังบันทึก {saveProgress.done}/{saveProgress.total} วิชา...
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">ตรวจสอบข้อมูลก่อนบันทึก</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setParsedEntries(null)}
                    disabled={!!saveProgress}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveParsed}
                    disabled={!!saveProgress}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-md shadow-coral/20 transition-all disabled:opacity-60">
                    <Check size={14}/> บันทึกทั้งหมด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
