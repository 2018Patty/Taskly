'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Save, Trash2, Sparkles, Sun, Moon, LogOut,
  Grid, Layers, ClipboardList, BarChart3, CalendarDays,
} from 'lucide-react';

const DAYS_OPTIONS = [
  { value: 0,  label: 'ไม่ระบุ (Unspecified)' },
  { value: 1,  label: 'จันทร์ (Monday)' },
  { value: 2,  label: 'อังคาร (Tuesday)' },
  { value: 3,  label: 'พุธ (Wednesday)' },
  { value: 4,  label: 'พฤหัสบดี (Thursday)' },
  { value: 5,  label: 'ศุกร์ (Friday)' },
];

const SEMESTERS = ['1/2026','2/2026','1/2025','2/2025','1/2024','2/2024'];

const COLOR_OPTIONS = [
  { key: 'sky',    label: 'ฟ้า',     cls: 'bg-sky-400' },
  { key: 'teal',   label: 'เขียวน้ำ', cls: 'bg-teal-400' },
  { key: 'amber',  label: 'เหลือง',  cls: 'bg-amber-400' },
  { key: 'rose',   label: 'ชมพู',    cls: 'bg-rose-400' },
  { key: 'violet', label: 'ม่วง',    cls: 'bg-violet-400' },
  { key: 'green',  label: 'เขียว',   cls: 'bg-green-400' },
  { key: 'indigo', label: 'คราม',    cls: 'bg-indigo-400' },
  { key: 'orange', label: 'ส้ม',     cls: 'bg-orange-400' },
];

/* ── Inner form ── */
function TimetableFormInner() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId   = searchParams.get('id');
  const semParam = searchParams.get('semester') || '1/2026';
  const isEdit   = !!editId;

  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [section,    setSection]    = useState('');
  const [credits,    setCredits]    = useState('');
  const [semester,   setSemester]   = useState(semParam);
  const [dayOfWeek,  setDayOfWeek]  = useState(0);
  const [startTime,  setStartTime]  = useState('');
  const [endTime,    setEndTime]    = useState('');
  const [room,       setRoom]       = useState('');
  const [color,      setColor]      = useState('sky');
  const [weeks,      setWeeks]      = useState<number[]>([]);

  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [fetching,  setFetching]  = useState(isEdit);
  const [errorMsg,  setErrorMsg]  = useState('');

  /* Load existing entry when editing */
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from('timetable_entries').select('*').eq('id', editId).single();
      if (error || !data) { setErrorMsg('ไม่พบข้อมูล'); setFetching(false); return; }
      setCourseCode(data.course_code);
      setCourseName(data.course_name);
      setSection(data.section || '');
      setCredits(data.credits || '');
      setSemester(data.semester);
      setDayOfWeek(data.day_of_week || 0);
      setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
      setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
      setRoom(data.room || '');
      setColor(data.color || 'sky');
      setWeeks(data.weeks ?? []);
      setFetching(false);
    })();
  }, [editId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim()) { setErrorMsg('กรุณากรอกรหัสวิชา'); return; }
    if (!courseName.trim()) { setErrorMsg('กรุณากรอกชื่อวิชา'); return; }
    if (dayOfWeek && (!startTime || !endTime)) { setErrorMsg('กรุณาระบุเวลาเริ่มต้นและเวลาสิ้นสุด'); return; }
    if (startTime && endTime && startTime >= endTime) { setErrorMsg('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น'); return; }

    setSaving(true); setErrorMsg('');
    try {
      const payload = {
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim().toUpperCase(),
        section:     section.trim() || null,
        credits:     credits.trim() || null,
        semester,
        day_of_week: dayOfWeek || null,
        start_time:  startTime || null,
        end_time:    endTime || null,
        room:        room.trim() || null,
        color,
        weeks,
      };
      if (isEdit) {
        const { error } = await supabase.from('timetable_entries').update(payload).eq('id', editId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('timetable_entries').insert([{ ...payload, user_id: user!.id }]);
        if (error) throw error;
      }
      router.push('/timetable');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm('ต้องการลบรายการนี้?')) return;
    setDeleting(true);
    await supabase.from('timetable_entries').delete().eq('id', editId);
    router.push('/timetable');
  };

  const NavLink = ({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) =>
    active
      ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm">{icon}<span>{label}</span></span>
      : <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all">{icon}<span>{label}</span></Link>;

  return (
    <div className="min-h-screen bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5 pb-16">

      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-linear-to-r from-coral via-coral to-honey border-b border-white/20 shadow-lg shadow-coral/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all flex items-center gap-1.5">
              <ArrowLeft size={16}/><span className="text-xs font-bold hidden sm:inline">ย้อนกลับ</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white"><Sparkles size={16}/></div>
              <div>
                <h1 className="text-sm font-extrabold text-white">{isEdit ? 'แก้ไขวิชา' : 'เพิ่มวิชา'}</h1>
                <span className="text-[10px] text-white/60">Taskly · ตารางสอน</span>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}           label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}         label="TodoList" />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>}  label="บันทึกภาระงาน" />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}      label="Dashboard" />
            <NavLink href="/timetable"         icon={<CalendarDays size={13}/>}   label="ตารางสอน" active />
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={signOut} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all"><LogOut size={16}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {fetching ? (
          <div className="py-24 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-coral border-t-transparent mx-auto"/>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Page title */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-200/40 dark:border-white/5">
              <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><CalendarDays size={22}/></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                  {isEdit ? 'แก้ไขวิชา' : 'เพิ่มวิชา'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">กรอกข้อมูลรายวิชาและเวลาสอน</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-600 dark:text-red-400 font-medium">
                {errorMsg}
              </div>
            )}

            {/* ── Course info ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">ข้อมูลวิชา</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">รหัสวิชา *</label>
                  <input type="text" required value={courseCode}
                    onChange={e => setCourseCode(e.target.value)}
                    placeholder="เช่น 934-451"
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">Section</label>
                  <input type="text" value={section}
                    onChange={e => setSection(e.target.value)}
                    placeholder="เช่น 01"
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ชื่อวิชา *</label>
                <input type="text" required value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="เช่น PROJECT IN INFORMATION TECHNOLOGY"
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">หน่วยกิต</label>
                  <input type="text" value={credits}
                    onChange={e => setCredits(e.target.value)}
                    placeholder="เช่น 3(0-9-0)"
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ภาคเรียน</label>
                  <select value={semester} onChange={e => setSemester(e.target.value)}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all">
                    {SEMESTERS.map(s => <option key={s} value={s} className="bg-white dark:bg-dark-surface">{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Schedule ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">เวลาและห้องเรียน</h3>
              <p className="text-[11px] text-slate-400">
                หากวิชาสอนหลายวัน ให้เพิ่มรายการวิชาเดิมอีกครั้งพร้อมเวลาใหม่
              </p>

              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">วันสอน</label>
                <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all">
                  {DAYS_OPTIONS.map(d => (
                    <option key={d.value} value={d.value} className="bg-white dark:bg-dark-surface">{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">เวลาเริ่มต้น</label>
                  <input type="time" value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    disabled={!dayOfWeek}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all disabled:opacity-40 disabled:cursor-not-allowed"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">เวลาสิ้นสุด</label>
                  <input type="time" value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    disabled={!dayOfWeek}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all disabled:opacity-40 disabled:cursor-not-allowed"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ห้องเรียน</label>
                <input type="text" value={room}
                  onChange={e => setRoom(e.target.value)}
                  placeholder="เช่น UD265, LC202"
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
              </div>
            </div>

            {/* ── Weeks ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">สัปดาห์ที่สอน</h3>
                <span className="text-[11px] text-slate-400">
                  {weeks.length === 0 ? 'ทุกสัปดาห์ (1–18)' : `เลือก ${weeks.length} สัปดาห์`}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'ทุกสัปดาห์', value: [] as number[] },
                  { label: 'สัปดาห์คี่',  value: [1,3,5,7,9,11,13,15,17] },
                  { label: 'สัปดาห์คู่',  value: [2,4,6,8,10,12,14,16,18] },
                ].map(({ label, value }) => {
                  const active = JSON.stringify(weeks) === JSON.stringify(value);
                  return (
                    <button key={label} type="button" onClick={() => setWeeks(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-coral text-white' : 'bg-slate-100 dark:bg-dark-raised text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-surface'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: 18 }, (_, i) => i + 1).map(w => {
                  const active = weeks.length === 0 || weeks.includes(w);
                  return (
                    <button key={w} type="button"
                      onClick={() => {
                        if (weeks.length === 0) {
                          setWeeks(Array.from({ length: 18 }, (_, i) => i + 1).filter(x => x !== w));
                        } else {
                          const next = weeks.includes(w)
                            ? weeks.filter(x => x !== w)
                            : [...weeks, w].sort((a, b) => a - b);
                          setWeeks(next.length === 18 ? [] : next);
                        }
                      }}
                      className={`aspect-square rounded-xl text-xs font-bold transition-all ${active ? 'bg-coral text-white shadow-sm' : 'bg-slate-100 dark:bg-dark-raised text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-surface'}`}>
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Color ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">สีแสดงในตาราง</h3>
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map(c => (
                  <button key={c.key} type="button"
                    onClick={() => setColor(c.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                      color === c.key
                        ? 'border-slate-600 dark:border-white bg-slate-100 dark:bg-dark-raised shadow-md'
                        : 'border-transparent hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                    <div className={`w-4 h-4 rounded-full ${c.cls}`}/>
                    <span className="text-slate-700 dark:text-slate-300">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {isEdit && (
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-red-200 dark:border-red-900/40 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                  {deleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"/> : <Trash2 size={16}/>}
                  ลบรายการ
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button type="button" onClick={() => router.back()} disabled={saving}
                  className="px-6 py-3 rounded-xl border border-slate-300 dark:border-dark-raised text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-raised/50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 disabled:bg-coral/50 disabled:cursor-not-allowed shadow-lg shadow-coral/20 transition-all">
                  {saving
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/><span>กำลังบันทึก...</span></>
                    : <><Save size={16}/><span>{isEdit ? 'บันทึกการแก้ไข' : 'บันทึกวิชา'}</span></>}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function TimetableFormPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"/>
      </div>
    }>
      <TimetableFormInner />
    </Suspense>
  );
}
