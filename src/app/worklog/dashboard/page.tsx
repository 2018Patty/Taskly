'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import {
  WorkLog, WORK_TYPES,
  calcHours, formatHours, formatThaiDate,
  getWorkTypeMainCode, getWorkTypeFullLabel,
} from '@/lib/worklog-types';
import ExportMenu from '@/components/export-menu';
import {
  LogOut, Sun, Moon, Grid, ClipboardList, BarChart3, Sparkles,
  User, Clock, CalendarDays, FileText, TrendingUp, CalendarRange,
  List, ChevronUp, ChevronDown, Layers,
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────── */
const today      = () => new Date().toISOString().slice(0, 10);
const thisMonth1 = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const addDays    = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addMonths  = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const fmt        = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

const CAT_META = {
  '1': { label: 'การเรียนการสอน', color: '#97c0c0', badgeCls: 'bg-mint/15 text-teal-700 dark:text-mint border-mint/30' },
  '3': { label: 'บริการวิชาการ',  color: '#fbbd4c', badgeCls: 'bg-honey/15 text-amber-700 dark:text-honey border-honey/30' },
  '4': { label: 'ภาระงานอื่น ๆ', color: '#91adc6', badgeCls: 'bg-steel/15 text-blue-700 dark:text-steel border-steel/30' },
} as const;

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const PRESETS = [
  { label: 'เดือนนี้',      start: () => thisMonth1(),            end: () => today() },
  { label: 'เดือนที่แล้ว',  start: () => addMonths(thisMonth1(), -1), end: () => addDays(thisMonth1(), -1) },
  { label: '3 เดือนล่าสุด', start: () => addMonths(today(), -3),  end: () => today() },
  { label: '6 เดือนล่าสุด', start: () => addMonths(today(), -6),  end: () => today() },
  { label: 'ปีนี้',         start: () => `${new Date().getFullYear()}-01-01`, end: () => today() },
];

/* ── DonutChart ───────────────────────────────────────────── */
function DonutChart({ data, total }: { data: { code: string; hours: number }[]; total: number }) {
  const r = 46; const C = 2 * Math.PI * r; let off = 0;
  const segs = data.filter(d => d.hours > 0);
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {segs.length === 0
        ? <circle cx={60} cy={60} r={r} fill="none" stroke="#e2e8f0" strokeWidth="20" />
        : segs.map((s, i) => {
            const meta = CAT_META[s.code as keyof typeof CAT_META];
            const dash = (s.hours / total) * C; const gap = C - dash; const o = -off; off += dash;
            return <circle key={i} cx={60} cy={60} r={r} fill="none" stroke={meta?.color ?? '#94a3b8'}
              strokeWidth="20" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={o} transform="rotate(-90 60 60)" />;
          })
      }
    </svg>
  );
}

/* ── BarChart ─────────────────────────────────────────────── */
// MAX_BAR_PX = h-44 (176px) minus label (~16px) minus gap (4px) = ~152px
const MAX_BAR_PX = 152;
function BarChart({ bars, maxVal }: { bars: { label: string; hours: number; count: number; highlight?: boolean }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-px h-44">
      {bars.map((b, i) => {
        const ratio = maxVal > 0 ? b.hours / maxVal : 0;
        const barH  = b.hours > 0 ? Math.max(ratio * MAX_BAR_PX, 4) : 4;
        const base  = b.highlight ? '#ed6956' : b.hours > 0 ? 'rgba(237,105,86,0.5)' : 'rgba(226,232,240,0.4)';
        return (
          <div key={i} className="flex flex-col items-center gap-1 group relative shrink-0"
            style={{ flex: bars.length <= 12 ? 1 : 'none', minWidth: bars.length > 20 ? '14px' : bars.length > 12 ? '20px' : undefined }}>
            {b.hours > 0 && (
              <div className="absolute bottom-full mb-2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
                <div className="bg-slate-800 dark:bg-dark-muted text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-lg text-center">
                  {b.label}: {formatHours(b.hours)}<br /><span className="font-normal opacity-70">{b.count} รายการ</span>
                </div>
                <div className="w-2 h-2 bg-slate-800 dark:bg-dark-muted rotate-45 -mt-1" />
              </div>
            )}
            <div className="w-full rounded-t transition-all duration-500"
              style={{ height: `${barH}px`, backgroundColor: base }} />
            <span className={`font-medium ${b.highlight ? 'text-coral font-bold' : 'text-slate-400'}`}
              style={{ fontSize: bars.length > 20 ? '7px' : '8px' }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sortable column header ───────────────────────────────── */
type SortKey = 'work_date' | 'hours' | 'work_type_code';
function SortTh({ col, label, sort, onSort }: {
  col: SortKey; label: string;
  sort: { key: SortKey; asc: boolean };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th onClick={() => onSort(col)}
      className="px-4 py-3 text-left cursor-pointer select-none group">
      <div className="flex items-center gap-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${active ? 'text-coral' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
          {label}
        </span>
        {active
          ? (sort.asc ? <ChevronUp size={11} className="text-coral" /> : <ChevronDown size={11} className="text-coral" />)
          : <ChevronDown size={11} className="text-slate-300 dark:text-slate-600" />}
      </div>
    </th>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function WorklogDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [logs, setLogs]           = useState<WorkLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState(thisMonth1);
  const [endDate, setEndDate]     = useState(today);

  /* tab / filter state */
  const [activeTab, setActiveTab] = useState<'overview' | 'bytype'>('overview');
  const [catTab, setCatTab]       = useState<'all' | '1' | '3' | '4'>('all');
  const [sort, setSort]           = useState<{ key: SortKey; asc: boolean }>({ key: 'work_date', asc: false });

  /* fetch */
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('work_logs').select('*').order('work_date', { ascending: true });
    if (!error) setLogs(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchLogs(); }, [user, fetchLogs]);

  /* date range */
  const safeStart = startDate <= endDate ? startDate : endDate;
  const safeEnd   = startDate <= endDate ? endDate   : startDate;

  const filteredLogs = useMemo(
    () => logs.filter(l => l.work_date >= safeStart && l.work_date <= safeEnd),
    [logs, safeStart, safeEnd],
  );

  const rangeDays = useMemo(() => {
    const diff = new Date(safeEnd + 'T00:00:00').getTime() - new Date(safeStart + 'T00:00:00').getTime();
    return Math.round(diff / 86_400_000) + 1;
  }, [safeStart, safeEnd]);

  /* stats */
  const totalHours = useMemo(() => filteredLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0), [filteredLogs]);
  const uniqueDays = useMemo(() => new Set(filteredLogs.map(l => l.work_date)).size, [filteredLogs]);
  const avgPerDay  = uniqueDays > 0 ? totalHours / uniqueDays : 0;

  /* category */
  const catData = useMemo(() =>
    (['1', '3', '4'] as const).map(code => {
      const group   = WORK_TYPES.find(g => g.mainCode === code);
      const catLogs = filteredLogs.filter(l => getWorkTypeMainCode(l.work_type_code) === code);
      return { code, label: group?.mainLabel ?? '', count: catLogs.length,
        hours: catLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0) };
    }),
  [filteredLogs]);

  /* bar chart */
  const showDaily = rangeDays <= 31;
  const barData = useMemo(() => {
    const todayStr = today();
    if (showDaily) {
      return Array.from({ length: rangeDays }, (_, i) => {
        const dateStr = addDays(safeStart, i);
        const d       = new Date(dateStr + 'T00:00:00');
        const dLogs   = filteredLogs.filter(l => l.work_date === dateStr);
        return { label: String(d.getDate()), hours: dLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0), count: dLogs.length, highlight: dateStr === todayStr };
      });
    }
    const months: string[] = [];
    const cur = new Date(safeStart.slice(0, 7) + '-01T00:00:00');
    const endYM = safeEnd.slice(0, 7);
    while (cur.toISOString().slice(0, 7) <= endYM) { months.push(cur.toISOString().slice(0, 7)); cur.setMonth(cur.getMonth() + 1); }
    const nowYM = todayStr.slice(0, 7);
    return months.map(ym => {
      const mLogs = filteredLogs.filter(l => l.work_date.startsWith(ym));
      const mi    = Number(ym.slice(5, 7)) - 1;
      const yr    = ym.slice(0, 4);
      return { label: `${THAI_MONTHS_SHORT[mi]}${months.length > 12 ? ` '${yr.slice(2)}` : ''}`, hours: mLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0), count: mLogs.length, highlight: ym === nowYM };
    });
  }, [filteredLogs, safeStart, safeEnd, rangeDays, showDaily]);

  const maxBarHours = useMemo(() => Math.max(...barData.map(b => b.hours), 1), [barData]);

  /* type table */
  const typeData = useMemo(() =>
    WORK_TYPES.flatMap(g => g.subs.map(sub => {
      const subLogs = filteredLogs.filter(l => l.work_type_code === sub.code);
      return { code: sub.code, label: sub.label, mainCode: g.mainCode, count: subLogs.length,
        hours: subLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0) };
    })).filter(t => t.count > 0).sort((a, b) => b.hours - a.hours),
  [filteredLogs]);

  /* by-type table rows */
  const handleSort = (key: SortKey) =>
    setSort(prev => prev.key === key ? { key, asc: !prev.asc } : { key, asc: false });

  const tableRows = useMemo(() => {
    const base = catTab === 'all'
      ? filteredLogs
      : filteredLogs.filter(l => getWorkTypeMainCode(l.work_type_code) === catTab);
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'work_date')     cmp = a.work_date.localeCompare(b.work_date);
      if (sort.key === 'hours')         cmp = calcHours(a.start_time, a.end_time, a.exclude_lunch) - calcHours(b.start_time, b.end_time, b.exclude_lunch);
      if (sort.key === 'work_type_code') cmp = a.work_type_code.localeCompare(b.work_type_code);
      return sort.asc ? cmp : -cmp;
    });
  }, [filteredLogs, catTab, sort]);

  /* period label */
  const periodLabel = safeStart === safeEnd ? fmt(safeStart) : `${fmt(safeStart)} – ${fmt(safeEnd)}`;
  const activePreset = PRESETS.findIndex(p => p.start() === startDate && p.end() === endDate);

  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent" />
    </div>
  );
  if (!user) return null;

  const navLink = (href: string, icon: React.ReactNode, label: string, active = false) =>
    active
      ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm">{icon}<span>{label}</span></span>
      : <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all">{icon}<span>{label}</span></Link>;

  return (
    <div className="relative min-h-screen pb-16 bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-96 w-full max-w-7xl rounded-full bg-linear-to-r from-honey/10 to-blush/10 blur-3xl opacity-50 dark:opacity-20" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-linear-to-r from-coral via-coral to-honey border-b border-white/20 shadow-lg shadow-coral/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg shadow-black/10"><Sparkles size={20} /></div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Taskly</h1>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">Workspace ส่วนตัว</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            {navLink('/', <Grid size={13} />, 'หน้าหลัก')}
            {navLink('/todos', <Layers size={13} />, 'TodoList')}
            {navLink('/worklog', <ClipboardList size={13} />, 'บันทึกภาระงาน')}
            {navLink('/worklog/dashboard', <BarChart3 size={13} />, 'Dashboard', true)}
            {navLink('/timetable', <CalendarDays size={13} />, 'ตารางสอน')}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30">
              <div className="h-6 w-6 rounded-lg bg-white/20 text-white flex items-center justify-center"><User size={14} /></div>
              <span className="text-xs font-semibold text-white truncate max-w-37.5">{user.email}</span>
            </div>
            <button onClick={toggleTheme} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={signOut} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all flex items-center gap-2">
              <LogOut size={18} /><span className="text-xs font-bold hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* ── Filter card ──────────────────────────────── */}
        <div className="glass rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><BarChart3 size={20} /></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">Dashboard ภาระงาน</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{periodLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ExportMenu type="worklog" logs={filteredLogs} period={periodLabel} />
              <div className="flex items-center gap-2">
                <CalendarRange size={15} className="text-slate-400 shrink-0" />
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">เริ่มต้น</label>
                <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all cursor-pointer" />
              </div>
              <span className="text-slate-400 font-bold">–</span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">สิ้นสุด</label>
                <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/30 dark:border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">ช่วงด่วน:</span>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setStartDate(p.start()); setEndDate(p.end()); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activePreset === i
                    ? 'bg-coral text-white shadow-sm shadow-coral/20'
                    : 'bg-white/60 dark:bg-dark-raised text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:text-coral hover:border-coral/40'
                }`}>{p.label}</button>
            ))}
            <span className="ml-auto text-[11px] text-slate-400 font-medium">
              {rangeDays} วัน · {showDaily ? 'แสดงรายวัน' : 'แสดงรายเดือน'}
            </span>
          </div>
        </div>

        {/* ── View tabs ────────────────────────────────── */}
        <div className="flex gap-1 bg-white/50 dark:bg-dark-surface/50 rounded-2xl p-1 border border-slate-200/40 dark:border-white/5 w-fit shadow-sm">
          {[
            { id: 'overview' as const, icon: <BarChart3 size={14} />, label: 'ภาพรวม' },
            { id: 'bytype'   as const, icon: <List size={14} />,      label: 'รายละเอียดแยกประเภท' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-coral text-white shadow-md shadow-coral/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-coral border-t-transparent mx-auto" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass rounded-3xl py-20 text-center border border-slate-200/40 dark:border-white/5 shadow-md flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-coral/10 text-coral/50"><BarChart3 size={40} /></div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">ไม่มีข้อมูลในช่วงนี้</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{periodLabel}</p>
            </div>
            <Link href="/worklog" className="px-5 py-2.5 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-md transition-colors">
              ไปบันทึกภาระงาน
            </Link>
          </div>

        ) : activeTab === 'overview' ? (
          /* ════════════════ OVERVIEW TAB ════════════════ */
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {([
                { icon: FileText,     label: 'รายการ',        value: String(filteredLogs.length), unit: 'รายการ', iconCls: 'bg-coral/15 text-coral',                    valueCls: 'text-coral' },
                { icon: Clock,        label: 'ชั่วโมงรวม',    value: formatHours(totalHours),     unit: '',       iconCls: 'bg-honey/15 text-amber-600 dark:text-honey',  valueCls: 'text-amber-600 dark:text-honey' },
                { icon: CalendarDays, label: 'วันปฏิบัติงาน', value: String(uniqueDays),          unit: 'วัน',    iconCls: 'bg-mint/15 text-teal-600 dark:text-mint',     valueCls: 'text-teal-600 dark:text-mint' },
                { icon: TrendingUp,   label: 'เฉลี่ยต่อวัน',  value: formatHours(avgPerDay),      unit: '/ วัน',  iconCls: 'bg-steel/15 text-blue-600 dark:text-steel',   valueCls: 'text-blue-600 dark:text-steel' },
              ] as const).map((s, i) => (
                <div key={i} className="bg-white/60 dark:bg-dark-surface/80 rounded-2xl p-5 border border-white/40 dark:border-white/5 shadow-md flex items-center gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${s.iconCls}`}><s.icon size={20} /></div>
                  <div className="min-w-0">
                    <div className={`text-2xl font-extrabold tabular-nums leading-tight truncate ${s.valueCls}`}>{s.value}</div>
                    {s.unit && <div className="text-xs text-slate-500 dark:text-slate-400">{s.unit}</div>}
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Donut + Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 glass rounded-3xl p-6 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-5">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สัดส่วนตามหมวดงาน</h3>
                <div className="relative w-44 h-44 mx-auto">
                  <DonutChart data={catData} total={totalHours} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                    <span className="text-xl font-extrabold text-slate-800 dark:text-white tabular-nums">{formatHours(totalHours)}</span>
                    <span className="text-[10px] font-bold text-slate-400">ทั้งหมด</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {catData.map(cat => {
                    const meta = CAT_META[cat.code]; const pct = totalHours > 0 ? (cat.hours / totalHours) * 100 : 0;
                    return (
                      <div key={cat.code}>
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                          <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 font-medium">{cat.code}. {cat.label}</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatHours(cat.hours)}</span>
                          <span className="text-[10px] text-slate-400 w-9 text-right tabular-nums">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-dark-raised overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-3 glass rounded-3xl p-6 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ชั่วโมง{showDaily ? 'รายวัน' : 'รายเดือน'}</h3>
                  <span className="text-xs text-slate-400">{periodLabel}</span>
                </div>
                <BarChart bars={barData} maxVal={maxBarHours} />
                <div className="flex justify-between text-[9px] text-slate-400 border-t border-slate-200/30 dark:border-white/5 pt-2">
                  <span>0 ชม.</span><span>{formatHours(maxBarHours / 2)}</span><span>สูงสุด {formatHours(maxBarHours)}</span>
                </div>
              </div>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {catData.map(cat => {
                const meta = CAT_META[cat.code];
                const typeRows = typeData.filter(t => t.mainCode === cat.code);
                const maxH = Math.max(...typeRows.map(t => t.hours), 1);
                return (
                  <div key={cat.code} className="glass rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.badgeCls}`}>หมวด {cat.code}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{cat.count} รายการ</span>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-800 dark:text-white tabular-nums">{formatHours(cat.hours)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cat.label}</div>
                    </div>
                    {typeRows.length > 0 ? (
                      <div className="space-y-3 pt-3 border-t border-slate-200/30 dark:border-white/5">
                        {typeRows.map(t => (
                          <div key={t.code} className="space-y-1">
                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">{t.code}</span>
                              <span className="text-[10px] text-slate-400 flex-1 truncate ml-1" title={t.label}>{t.label}</span>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">{formatHours(t.hours)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-dark-raised overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(t.hours / maxH) * 100}%`, backgroundColor: meta.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic pt-2 border-t border-slate-200/30 dark:border-white/5">ไม่มีข้อมูล</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary table */}
            <div className="glass rounded-3xl border border-slate-200/40 dark:border-white/5 shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/30 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">รายละเอียดตามประเภทงาน</h3>
                <span className="text-xs text-slate-400">{typeData.length} ประเภท</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/30 dark:border-white/5 bg-slate-50/50 dark:bg-dark-surface/30">
                      <th className="px-6 py-3 text-left">รหัส</th>
                      <th className="px-4 py-3 text-left">ชื่อประเภทงาน</th>
                      <th className="px-4 py-3 text-center">จำนวน</th>
                      <th className="px-4 py-3 text-right">ชั่วโมง</th>
                      <th className="px-6 py-3 text-right w-36">สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/20 dark:divide-white/5">
                    {typeData.map(t => {
                      const meta = CAT_META[t.mainCode as keyof typeof CAT_META];
                      const pct  = totalHours > 0 ? (t.hours / totalHours) * 100 : 0;
                      return (
                        <tr key={t.code} className="hover:bg-slate-50/50 dark:hover:bg-dark-raised/30 transition-colors">
                          <td className="px-6 py-3.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.badgeCls ?? ''}`}>{t.code}</span></td>
                          <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-200 font-medium max-w-xs"><span className="line-clamp-2 leading-relaxed">{t.label}</span></td>
                          <td className="px-4 py-3.5 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold tabular-nums">{t.count}</td>
                          <td className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatHours(t.hours)}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-16 h-1.5 rounded-full bg-slate-200/60 dark:bg-dark-raised overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta?.color ?? '#94a3b8' }} />
                              </div>
                              <span className="text-[10px] text-slate-400 w-9 text-right tabular-nums">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200/40 dark:border-white/10 bg-slate-50/30 dark:bg-dark-surface/10">
                    <tr>
                      <td colSpan={2} className="px-6 py-3 text-xs font-extrabold text-slate-600 dark:text-slate-300">รวมทั้งหมด</td>
                      <td className="px-4 py-3 text-center text-xs font-extrabold text-slate-700 dark:text-slate-200 tabular-nums">{filteredLogs.length}</td>
                      <td className="px-4 py-3 text-right text-xs font-extrabold text-coral tabular-nums">{formatHours(totalHours)}</td>
                      <td className="px-6 py-3 text-right text-xs font-bold text-slate-400">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

        ) : (
          /* ════════════════ BY-TYPE TAB ════════════════ */
          <div className="space-y-4">
            {/* Category filter tabs */}
            <div className="glass rounded-2xl p-1.5 border border-slate-200/40 dark:border-white/5 shadow-sm flex flex-wrap gap-1">
              {([
                { id: 'all', label: 'ทั้งหมด', count: filteredLogs.length },
                { id: '1',   label: 'หมวด 1 การเรียนการสอน', count: catData.find(c => c.code === '1')?.count ?? 0 },
                { id: '3',   label: 'หมวด 3 บริการวิชาการ',  count: catData.find(c => c.code === '3')?.count ?? 0 },
                { id: '4',   label: 'หมวด 4 ภาระงานอื่น ๆ', count: catData.find(c => c.code === '4')?.count ?? 0 },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setCatTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    catTab === t.id
                      ? t.id === 'all' ? 'bg-coral text-white shadow-sm'
                        : t.id === '1' ? 'bg-mint/30 text-teal-700 dark:text-mint shadow-sm'
                        : t.id === '3' ? 'bg-honey/30 text-amber-700 dark:text-honey shadow-sm'
                        : 'bg-steel/30 text-blue-700 dark:text-steel shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                  }`}>
                  <span>{t.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                    catTab === t.id ? 'bg-white/30' : 'bg-slate-200/60 dark:bg-dark-raised'
                  }`}>{t.count}</span>
                </button>
              ))}
              <span className="ml-auto self-center text-xs text-slate-400 font-medium pr-2">
                {tableRows.length} รายการ
              </span>
            </div>

            {/* Detail table */}
            <div className="glass rounded-3xl border border-slate-200/40 dark:border-white/5 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/30 dark:border-white/5 bg-slate-50/50 dark:bg-dark-surface/30">
                      <SortTh col="work_date"     label="วันที่"    sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">ชื่องาน</th>
                      <SortTh col="work_type_code" label="ประเภท"   sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">เวลา</th>
                      <SortTh col="hours"          label="ชั่วโมง"  sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">รายละเอียด</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/20 dark:divide-white/5">
                    {tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-sm text-slate-400 font-medium">ไม่มีข้อมูลในหมวดนี้</td>
                      </tr>
                    ) : tableRows.map(log => {
                      const mainCode = getWorkTypeMainCode(log.work_type_code);
                      const meta     = CAT_META[mainCode as keyof typeof CAT_META];
                      const hrs      = calcHours(log.start_time, log.end_time, log.exclude_lunch);
                      return (
                        <tr key={log.id}
                          onClick={() => router.push(`/worklog/${log.id}`)}
                          className="hover:bg-coral/5 dark:hover:bg-coral/5 cursor-pointer transition-colors group">
                          {/* วันที่ */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatThaiDate(log.work_date)}</span>
                          </td>
                          {/* ชื่องาน */}
                          <td className="px-4 py-3.5 max-w-52">
                            <span className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-1">{log.title}</span>
                          </td>
                          {/* ประเภท */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.badgeCls ?? ''}`}>{log.work_type_code}</span>
                          </td>
                          {/* เวลา */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                              {log.start_time.slice(0, 5)} – {log.end_time.slice(0, 5)}
                            </span>
                          </td>
                          {/* ชั่วโมง */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-extrabold text-amber-600 dark:text-honey tabular-nums">{formatHours(hrs)}</span>
                            {log.exclude_lunch && <span className="ml-1 text-[9px] text-slate-400">(หักพัก)</span>}
                          </td>
                          {/* รายละเอียด */}
                          <td className="px-4 py-3.5 max-w-60">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{log.description ?? '–'}</span>
                          </td>
                          {/* arrow */}
                          <td className="px-4 py-3.5">
                            <ChevronDown size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-coral -rotate-90 transition-colors" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {tableRows.length > 0 && (
                    <tfoot className="border-t-2 border-slate-200/40 dark:border-white/10 bg-slate-50/30 dark:bg-dark-surface/10">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-xs font-extrabold text-slate-600 dark:text-slate-300">รวม</td>
                        <td className="px-4 py-3 text-xs font-extrabold text-coral tabular-nums">
                          {formatHours(tableRows.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
