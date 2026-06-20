'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth }  from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import {
  WorkLog,
  WORK_TYPES,
  calcHours,
  formatHours,
  formatShortDate,
  formatThaiDate,
  getWorkTypeMainCode,
  getWorkTypeFullLabel,
} from '@/lib/worklog-types';
import {
  LogOut, Sun, Moon, Plus, Search, ClipboardList, Grid,
  Sparkles, User, Timer, Calendar, SlidersHorizontal, BookOpen, BarChart3, Layers, CalendarDays,
} from 'lucide-react';

export default function WorklogPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [logs, setLogs]           = useState<WorkLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterType, setFilterType]     = useState('all');
  const [filterMonth, setFilterMonth]   = useState(() => new Date().toISOString().slice(0, 7));
  const [sortBy, setSortBy]             = useState('date_desc');

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLogs(data ?? []);
    } catch (err) {
      console.error('Error fetching work logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchLogs(); }, [user, fetchLogs]);

  // Stats (entire dataset, not filtered)
  const totalHours = logs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0);
  const thisMonthLogs  = logs.filter(l => l.work_date.startsWith(filterMonth));
  const monthlyHours   = thisMonthLogs.reduce((s, l) => s + calcHours(l.start_time, l.end_time, l.exclude_lunch), 0);
  const uniqueDays     = new Set(thisMonthLogs.map(l => l.work_date)).size;
  const type3Count     = logs.filter(l => l.work_type_code.startsWith('3')).length;
  const type4Count     = logs.filter(l => l.work_type_code.startsWith('4')).length;

  // Filter + Sort
  const filtered = logs
    .filter(l => {
      const monthMatch = !filterMonth || l.work_date.startsWith(filterMonth);
      const typeMatch  = filterType === 'all' || getWorkTypeMainCode(l.work_type_code) === filterType;
      const q = searchQuery.toLowerCase();
      const textMatch  = !q || l.title.toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q);
      return monthMatch && typeMatch && textMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return a.work_date < b.work_date ? 1 : -1;
      if (sortBy === 'date_asc')  return a.work_date > b.work_date ? 1 : -1;
      if (sortBy === 'hours_desc') return calcHours(a.start_time, a.end_time) < calcHours(b.start_time, b.end_time) ? 1 : -1;
      return 0;
    });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative min-h-screen pb-16 bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-96 w-full max-w-7xl rounded-full bg-linear-to-r from-honey/10 to-blush/10 blur-3xl opacity-50 dark:opacity-20" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-linear-to-r from-coral via-coral to-honey border-b border-white/20 shadow-lg shadow-coral/20 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg shadow-black/10">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Taskly</h1>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">Workspace ส่วนตัว</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <Link href="/"      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all"><Grid size={13}/><span>หน้าหลัก</span></Link>
            <Link href="/todos" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all"><Layers size={13}/><span>TodoList</span></Link>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm"><ClipboardList size={13}/><span>บันทึกภาระงาน</span></span>
            <Link href="/worklog/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all"><BarChart3 size={13}/><span>Dashboard</span></Link>
            <Link href="/timetable" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all"><CalendarDays size={13}/><span>ตารางสอน</span></Link>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30">
              <div className="h-6 w-6 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <User size={14} />
              </div>
              <span className="text-xs font-semibold text-white truncate max-w-37.5">{user.email}</span>
            </div>
            <button onClick={toggleTheme} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={signOut} className="p-2.5 rounded-xl text-white hover:bg-white/20 transition-all flex items-center gap-2">
              <LogOut size={18} />
              <span className="text-xs font-bold hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

        {/* Page title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-honey/15 text-amber-600 dark:text-honey">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">บันทึกภาระงาน</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">บันทึกและติดตามภาระงานตามประเภท</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'ภาระงานทั้งหมด',      value: logs.length,                unit: 'รายการ', color: 'text-coral',                bg: 'bg-coral/10 dark:bg-coral/5'   },
            { label: `ชั่วโมง (${filterMonth.replace('-', '/')})`, value: formatHours(monthlyHours), unit: '',  color: 'text-amber-600 dark:text-honey', bg: 'bg-honey/10 dark:bg-honey/5' },
            { label: `วันปฏิบัติ เดือนนี้`,  value: uniqueDays,                  unit: 'วัน',    color: 'text-teal-600 dark:text-mint',   bg: 'bg-mint/10 dark:bg-mint/5'  },
            { label: 'บริการวิชาการ / อื่น ๆ', value: `${type3Count} / ${type4Count}`, unit: '', color: 'text-steel dark:text-steel', bg: 'bg-steel/10 dark:bg-steel/5' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl p-5 border border-white/30 dark:border-white/5 shadow-md`}>
              <div className={`text-2xl font-extrabold ${s.color} tabular-nums`}>{s.value}</div>
              {s.unit && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.unit}</div>}
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <section className="glass rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            {/* Search */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={17} />
              </div>
              <input
                type="text"
                placeholder="ค้นหาชื่องาน หรือ รายละเอียด..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl glass-input py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"
              />
            </div>

            {/* Add button */}
            <button
              onClick={() => router.push('/worklog/form')}
              className="flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2.5 text-xs font-bold text-white hover:bg-coral/90 shadow-md shadow-coral/20 hover:shadow-lg transition-all shrink-0"
            >
              <Plus size={15} /><span>เพิ่มภาระงาน</span>
            </button>
          </div>

          {/* Filters */}
          <div className="pt-3 border-t border-slate-200/20 dark:border-white/5 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <SlidersHorizontal size={12} /><span>ตัวกรอง:</span>
            </div>
            <div className="flex items-center gap-2">
              <span>เดือน:</span>
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="rounded-lg glass border border-slate-300/30 dark:border-white/5 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-coral dark:text-slate-200 text-slate-800 bg-transparent font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>ประเภท:</span>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="rounded-lg glass border border-slate-300/30 dark:border-white/5 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-coral dark:text-slate-200 text-slate-800 bg-transparent font-medium"
              >
                <option value="all"  className="bg-slate-100 dark:bg-dark-surface">ทั้งหมด</option>
                <option value="1"    className="bg-slate-100 dark:bg-dark-surface">1. การเรียนการสอน</option>
                <option value="3"    className="bg-slate-100 dark:bg-dark-surface">3. บริการวิชาการ</option>
                <option value="4"    className="bg-slate-100 dark:bg-dark-surface">4. ภาระงานอื่น ๆ</option>
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span>เรียง:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="rounded-lg glass border border-slate-300/30 dark:border-white/5 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-coral dark:text-slate-200 text-slate-800 bg-transparent font-medium"
              >
                <option value="date_desc"  className="bg-slate-100 dark:bg-dark-surface">วันที่ (ใหม่-เก่า)</option>
                <option value="date_asc"   className="bg-slate-100 dark:bg-dark-surface">วันที่ (เก่า-ใหม่)</option>
                <option value="hours_desc" className="bg-slate-100 dark:bg-dark-surface">ชั่วโมง (มาก-น้อย)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Work log list */}
        {loadingLogs ? (
          <div className="py-24 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-coral border-t-transparent mx-auto" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-3xl py-24 text-center border border-slate-200/40 dark:border-white/5 shadow-md flex flex-col items-center justify-center gap-4">
            <div className="p-4 rounded-full bg-honey/10 dark:bg-honey/5 text-amber-400">
              <BookOpen size={38} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">ไม่พบรายการภาระงาน</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ลองปรับตัวกรอง หรือกด "เพิ่มภาระงาน" เพื่อบันทึกรายการแรก</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(log => {
              const hours     = calcHours(log.start_time, log.end_time, log.exclude_lunch);
              const mainCode  = getWorkTypeMainCode(log.work_type_code);
              const typeBadge = mainCode === '1'
                ? 'bg-mint/15 text-teal-700 dark:text-mint border-mint/25'
                : mainCode === '3'
                ? 'bg-honey/15 text-amber-700 dark:text-honey border-honey/25'
                : 'bg-steel/15 text-blue-700 dark:text-steel border-steel/25';

              return (
                <div
                  key={log.id}
                  onClick={() => router.push(`/worklog/${log.id}`)}
                  className="bg-white/60 dark:bg-dark-surface/80 rounded-2xl p-5 shadow-md border border-white/40 dark:border-coral/8 hover:shadow-xl hover:scale-[1.01] transition-all duration-200 cursor-pointer flex flex-col gap-3"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-raised text-slate-700 dark:text-slate-200">
                        {formatShortDate(log.work_date)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadge}`}>
                        {log.work_type_code}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-coral/10 dark:bg-coral/5 text-coral border border-coral/20 shrink-0">
                      {formatHours(hours)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 text-sm">
                    {log.title}
                  </h3>

                  {/* Description */}
                  {log.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {log.description}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="mt-auto pt-3 border-t border-slate-200/30 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Timer size={11} className="shrink-0" />
                      <span>{log.start_time.slice(0, 5)} – {log.end_time.slice(0, 5)} น.</span>
                    </div>
                    {log.images && log.images.length > 0 && (
                      <span className="text-[10px] font-semibold">รูป: {log.images.length}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}
