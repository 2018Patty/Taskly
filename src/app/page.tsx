'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import { deleteTodoImages } from '@/lib/storage';
import { Todo } from '@/components/task-calendar';
import TaskDetails from '@/components/task-details';
import {
  WorkLog,
  calcHours, formatHours, formatThaiDate, getWorkTypeMainCode,
} from '@/lib/worklog-types';
import {
  LogOut, Sun, Moon, Plus, Grid, Clock, User, Sparkles,
  ClipboardList, BarChart3, ChevronRight, ChevronLeft,
  CheckCircle, AlertCircle, Circle, ArrowRight,
  ImageIcon, Layers, Search,
} from 'lucide-react';

/* ── helpers ── */
const CAT_META: Record<string, { label: string; cls: string }> = {
  '1': { label: 'การเรียนการสอน', cls: 'bg-mint/20 text-teal-700 dark:text-mint border-mint/30' },
  '3': { label: 'บริการวิชาการ',  cls: 'bg-honey/20 text-amber-700 dark:text-honey border-honey/30' },
  '4': { label: 'ภาระงานอื่น ๆ', cls: 'bg-steel/20 text-blue-700 dark:text-steel border-steel/30' },
};

const fmtDeadline = (d?: string) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.' : null;

const isOverdue = (t: Todo) =>
  !!(t.deadline && t.status !== 'completed' && new Date(t.deadline) < new Date());

/* ── Page ── */
export default function HomePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [todos,    setTodos]    = useState<Todo[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading,  setLoading]  = useState(true);

  /* hero rotation */
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* todo search */
  const [todoSearch, setTodoSearch] = useState('');

  /* task details modal */
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedTodo,      setSelectedTodo]      = useState<Todo | null>(null);

  /* fetch */
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tr, wr] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('work_logs').select('*').order('work_date', { ascending: false }).limit(20),
    ]);
    if (!tr.error) setTodos(tr.data ?? []);
    if (!wr.error) setWorkLogs(wr.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  /* hero pool — prefer logs with images */
  const heroPool = useMemo(() => {
    const withImg = workLogs.filter(l => l.images && l.images.length > 0);
    return (withImg.length > 0 ? withImg : workLogs).slice(0, 10);
  }, [workLogs]);

  useEffect(() => {
    if (heroPool.length <= 1) return;
    heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % heroPool.length), 6000);
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, [heroPool.length]);

  const heroLog = heroPool.length > 0 ? heroPool[heroIdx % heroPool.length] : null;

  /* recent work log gallery */
  const galleryLogs = workLogs.slice(0, 8);

  /* sorted todos */
  const sortedTodos = useMemo(() => {
    const q = todoSearch.trim().toLowerCase();
    return [...todos]
      .filter(t => !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [todos, todoSearch]);

  /* handlers */
  const handleDeleteTodo = async (id: string, urls: string[]) => {
    if (urls.length > 0) await deleteTodoImages(urls);
    await supabase.from('todos').delete().eq('id', id);
    setIsTaskDetailsOpen(false);
    fetchAll();
  };

  /* loading / auth */
  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-coral border-t-transparent" />
    </div>
  );
  if (!user) return null;

  /* nav helper */
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
            <NavLink href="/"                  icon={<Grid size={13}/>}         label="หน้าหลัก"        active />
            <NavLink href="/todos"             icon={<Layers size={13}/>}       label="TodoList" />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>} label="บันทึกภาระงาน" />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}    label="Dashboard" />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">

        {/* ════════════════ HERO SECTION ════════════════ */}
        {loading ? (
          <div className="rounded-3xl bg-slate-200/40 dark:bg-dark-surface/40 animate-pulse" style={{ height: '380px' }} />
        ) : heroLog ? (
          <section
            className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/20 cursor-pointer group"
            style={{ minHeight: '380px' }}
            onClick={() => router.push(`/worklog/${heroLog.id}`)}
          >
            {/* Background */}
            {heroLog.images && heroLog.images.length > 0 ? (
              <img
                key={heroLog.id}
                src={heroLog.images[0]}
                alt={heroLog.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="absolute inset-0 bg-linear-to-135deg from-coral via-honey to-mint" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-slate-900/95 via-slate-900/50 to-slate-900/10" />

            {/* Navigation controls */}
            {heroPool.length > 1 && (
              <div className="absolute top-5 right-5 z-20 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setHeroIdx(i => (i - 1 + heroPool.length) % heroPool.length)}
                  className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all backdrop-blur-sm">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex gap-1.5">
                  {heroPool.slice(0, Math.min(heroPool.length, 8)).map((_, i) => (
                    <button key={i}
                      onClick={() => setHeroIdx(i)}
                      className={`rounded-full transition-all duration-300 ${i === heroIdx % heroPool.length ? 'bg-white w-4 h-2' : 'bg-white/40 w-2 h-2 hover:bg-white/70'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setHeroIdx(i => (i + 1) % heroPool.length)}
                  className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all backdrop-blur-sm">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Hero Content */}
            <div className="relative z-10 flex flex-col justify-end p-8 md:p-10" style={{ minHeight: '380px' }}>
              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm">
                  ภาระงานล่าสุด
                </span>
                <span className="text-[10px] font-bold text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm">
                  {formatThaiDate(heroLog.work_date)}
                </span>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${CAT_META[getWorkTypeMainCode(heroLog.work_type_code)]?.cls ?? 'bg-white/20 text-white border-white/20'}`}>
                  {heroLog.work_type_code}
                </span>
                {heroLog.images && heroLog.images.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                    <ImageIcon size={11} /> {heroLog.images.length} รูปภาพ
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-4xl font-extrabold text-white drop-shadow-lg leading-tight max-w-3xl mb-3">
                {heroLog.title}
              </h2>
              {heroLog.description && (
                <p className="text-sm md:text-base text-white/75 max-w-2xl line-clamp-2 leading-relaxed mb-5">
                  {heroLog.description}
                </p>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-extrabold text-honey tabular-nums bg-black/30 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                  {formatHours(calcHours(heroLog.start_time, heroLog.end_time, heroLog.exclude_lunch))}
                </span>
                <span className="text-xs font-bold text-white/60">
                  {heroLog.start_time.slice(0,5)} – {heroLog.end_time.slice(0,5)} น.
                </span>
                <div className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-coral text-xs font-extrabold shadow-xl group-hover:bg-coral group-hover:text-white transition-all">
                  ดูรายละเอียด <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-linear-to-r from-coral to-honey p-12 text-center shadow-xl">
            <Sparkles size={40} className="mx-auto text-white/60 mb-4" />
            <h2 className="text-2xl font-extrabold text-white">ยินดีต้อนรับสู่ Taskly</h2>
            <p className="text-white/70 text-sm mt-2 mb-6">เริ่มต้นบันทึกภาระงานเพื่อดูสรุปที่นี่</p>
            <Link href="/worklog" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-coral font-bold text-sm hover:bg-white/90 shadow-lg transition-all">
              <ClipboardList size={16} /> บันทึกภาระงานแรก
            </Link>
          </section>
        )}

        {/* ════════════════ CONTENT COLUMNS ════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Work Log Gallery (3/5) ── */}
          <section className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-coral" /> ภาระงานล่าสุด
              </h2>
              <Link href="/worklog" className="flex items-center gap-1 text-xs font-bold text-coral hover:underline">
                ดูทั้งหมด <ChevronRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-slate-200/40 dark:bg-dark-surface/40 animate-pulse" style={{ height: '200px' }} />
                ))}
              </div>
            ) : galleryLogs.length === 0 ? (
              <div className="glass rounded-2xl py-12 text-center border border-slate-200/40 dark:border-white/5">
                <ClipboardList size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">ยังไม่มีภาระงาน</p>
                <Link href="/worklog" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-coral hover:underline">
                  <Plus size={13} /> เพิ่มภาระงาน
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {galleryLogs.map(log => {
                  const mc   = getWorkTypeMainCode(log.work_type_code);
                  const meta = CAT_META[mc];
                  const hrs  = calcHours(log.start_time, log.end_time, log.exclude_lunch);
                  const thumb = log.images && log.images.length > 0 ? log.images[0] : null;
                  return (
                    <div key={log.id}
                      onClick={() => router.push(`/worklog/${log.id}`)}
                      className="glass rounded-2xl overflow-hidden border border-slate-200/40 dark:border-white/5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col">
                      {/* Thumbnail */}
                      <div className="relative h-28 bg-linear-to-br from-coral/10 to-honey/10 dark:from-dark-raised dark:to-dark-muted overflow-hidden shrink-0">
                        {thumb ? (
                          <img src={thumb} alt={log.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ClipboardList size={28} className="text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                        {log.images && log.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <ImageIcon size={9} /> +{log.images.length - 1}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3 flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border truncate ${meta?.cls ?? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-dark-raised dark:text-slate-400 dark:border-dark-muted'}`}>
                            {log.work_type_code}
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-600 dark:text-honey tabular-nums shrink-0">{formatHours(hrs)}</span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-white line-clamp-2 leading-snug flex-1">{log.title}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{formatThaiDate(log.work_date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Todo List (2/5) ── */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Layers size={18} className="text-coral" /> TodoList
                  {todos.length > 0 && (
                    <span className="text-[10px] font-extrabold bg-coral text-white px-2 py-0.5 rounded-full">{todos.filter(t => t.status !== 'completed').length}</span>
                  )}
                </h2>
                <Link href="/todos" className="text-[10px] font-bold text-coral/70 hover:text-coral hover:underline flex items-center gap-0.5">
                  ดูทั้งหมด <ChevronRight size={11}/>
                </Link>
              </div>
              <button
                onClick={() => router.push('/todos/form')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-coral text-white text-xs font-bold hover:bg-coral/90 shadow-md transition-all">
                <Plus size={14} /> เพิ่ม
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหางาน..."
                value={todoSearch}
                onChange={e => setTodoSearch(e.target.value)}
                className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-slate-200/40 dark:bg-dark-surface/40 animate-pulse h-14" />
                ))}
              </div>
            ) : sortedTodos.length === 0 ? (
              <div className="glass rounded-2xl py-12 text-center border border-slate-200/40 dark:border-white/5">
                <Layers size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">{todoSearch ? 'ไม่พบงานที่ค้นหา' : 'ยังไม่มีรายการงาน'}</p>
              </div>
            ) : (
              <div className="glass rounded-2xl border border-slate-200/40 dark:border-white/5 shadow-lg overflow-hidden">
                <div className="divide-y divide-slate-200/20 dark:divide-white/5 max-h-145 overflow-y-auto">
                  {sortedTodos.map((todo, idx) => {
                    const overdue = isOverdue(todo);
                    const thumb   = todo.images && todo.images.length > 0 ? todo.images[0] : null;
                    const statusIcon = todo.status === 'completed'
                      ? <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                      : overdue
                        ? <AlertCircle size={15} className="text-red-400 shrink-0 animate-pulse" />
                        : <Circle size={15} className={`shrink-0 ${todo.status === 'in_progress' ? 'text-honey' : 'text-slate-300 dark:text-slate-600'}`} />;

                    return (
                      <div key={todo.id}
                        onClick={() => { setSelectedTodo(todo); setIsTaskDetailsOpen(true); }}
                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-coral/5 transition-colors group ${todo.status === 'completed' ? 'opacity-55' : ''}`}>
                        {/* Rank */}
                        <span className="text-[10px] font-extrabold text-slate-300 dark:text-slate-600 w-4 text-center shrink-0 tabular-nums">{idx + 1}</span>
                        {statusIcon}
                        {/* Thumbnail */}
                        {thumb && (
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200/40 dark:border-white/10">
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${todo.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                            {todo.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {todo.category && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-dark-raised px-1.5 py-0.5 rounded">
                                {todo.category}
                              </span>
                            )}
                            {todo.deadline && (
                              <span className={`flex items-center gap-0.5 text-[9px] font-bold ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                                <Clock size={9} /> {fmtDeadline(todo.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-slate-300 dark:text-slate-600 group-hover:text-coral transition-colors shrink-0" />
                      </div>
                    );
                  })}
                </div>

                {/* Footer summary */}
                <div className="px-4 py-2.5 border-t border-slate-200/20 dark:border-white/5 bg-slate-50/50 dark:bg-dark-surface/30 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">{sortedTodos.length} รายการ</span>
                  <div className="flex items-center gap-3 text-[9px] font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">{todos.filter(t => t.status === 'completed').length} เสร็จ</span>
                    <span className="text-honey">{todos.filter(t => t.status === 'in_progress').length} กำลังทำ</span>
                    <span className="text-red-400">{todos.filter(isOverdue).length} เลยกำหนด</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Modals (details only — forms are full pages) ── */}
      <TaskDetails
        isOpen={isTaskDetailsOpen}
        onClose={() => setIsTaskDetailsOpen(false)}
        task={selectedTodo}
        onEdit={task => { setIsTaskDetailsOpen(false); router.push(`/todos/form?id=${task.id}`); }}
        onDelete={handleDeleteTodo}
      />
    </div>
  );
}
