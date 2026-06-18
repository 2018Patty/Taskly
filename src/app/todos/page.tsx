'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth }  from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import { deleteTodoImages } from '@/lib/storage';
import { Todo } from '@/components/task-calendar';
import TaskCalendar from '@/components/task-calendar';
import TaskDetails  from '@/components/task-details';
import DashboardStats from '@/components/dashboard-stats';
import ExportMenu from '@/components/export-menu';
import { getCategoryColor } from '@/lib/category-colors';
import {
  LogOut, Sun, Moon, Plus, Search, Grid, ClipboardList, BarChart3,
  Sparkles, User, CalendarDays, List, Layers,
  CheckCircle, AlertCircle, Circle, Clock, ChevronRight,
} from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  pending:     'ยังไม่เริ่ม',
  in_progress: 'กำลังทำ',
  completed:   'เสร็จสิ้น',
};

const isOverdue = (t: Todo) =>
  !!(t.deadline && t.status !== 'completed' && new Date(t.deadline) < new Date());

export default function TodosPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [todos,   setTodos]   = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  /* view toggle */
  const [view, setView] = useState<'list' | 'calendar'>('list');

  /* list filters */
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  /* details modal */
  const [selectedTodo,      setSelectedTodo]      = useState<Todo | null>(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);

  /* fetch */
  const fetchTodos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('todos').select('*').order('created_at', { ascending: false });
    if (!error) setTodos(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchTodos(); }, [user, fetchTodos]);

  /* delete handler */
  const handleDelete = async (id: string, urls: string[]) => {
    if (urls.length > 0) await deleteTodoImages(urls);
    await supabase.from('todos').delete().eq('id', id);
    setIsTaskDetailsOpen(false);
    fetchTodos();
  };

  /* unique categories */
  const categories = useMemo(() =>
    Array.from(new Set(todos.map(t => t.category).filter(Boolean))).sort(),
  [todos]);

  /* filtered + sorted list */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...todos]
      .filter(t => {
        const statusOk   = filterStatus   === 'all' || t.status   === filterStatus;
        const categoryOk = filterCategory === 'all' || t.category === filterCategory;
        const textOk     = !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
        return statusOk && categoryOk && textOk;
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [todos, search, filterStatus, filterCategory]);

  /* stats quick counts */
  const pendingCount    = todos.filter(t => t.status === 'pending').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const completedCount  = todos.filter(t => t.status === 'completed').length;
  const overdueCount    = todos.filter(isOverdue).length;

  /* auth guard */
  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent" />
    </div>
  );
  if (!user) return null;

  /* nav helper */
  const NavLink = ({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) =>
    active
      ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm">{icon}<span>{label}</span></span>
      : <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all">{icon}<span>{label}</span></Link>;

  const fmtDeadline = (d: string) =>
    new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' +
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

  return (
    <div className="min-h-screen pb-20 bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full bg-linear-to-r from-coral via-coral to-honey border-b border-white/20 shadow-lg shadow-coral/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg"><Sparkles size={20}/></div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Taskly</h1>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">Workspace ส่วนตัว</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}         label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}       label="TodoList" active />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

        {/* ── Page title + add button ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><Layers size={22}/></div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">TodoList</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">จัดการและติดตามรายการงานทั้งหมด</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportMenu type="todo" todos={filtered} />
            <button
              onClick={() => router.push('/todos/form')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-lg shadow-coral/20 transition-all">
              <Plus size={16}/><span>เพิ่มงาน</span>
            </button>
          </div>
        </div>

        {/* ── Quick stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'ทั้งหมด',     value: todos.length,    color: 'text-coral',                   bg: 'bg-coral/10'                   },
            { label: 'ยังไม่เริ่ม', value: pendingCount,    color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-200/40 dark:bg-dark-raised/40' },
            { label: 'กำลังทำ',     value: inProgressCount, color: 'text-amber-600 dark:text-honey', bg: 'bg-honey/10'                  },
            { label: 'เสร็จสิ้น',   value: completedCount,  color: 'text-teal-600 dark:text-mint',  bg: 'bg-mint/10'                   },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl p-5 border border-white/30 dark:border-white/5 shadow-md`}>
              <div className={`text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Stats / Donut ── */}
        {loading ? (
          <div className="h-48 rounded-3xl bg-slate-200/40 dark:bg-dark-surface/40 animate-pulse" />
        ) : (
          <DashboardStats todos={todos} categoryFilter="" onCategoryClick={() => {}} />
        )}

        {/* ── View toggle + filters ── */}
        <div className="glass rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            {/* View toggle */}
            <div className="flex gap-1 bg-slate-100/60 dark:bg-dark-raised/60 rounded-xl p-1 w-fit">
              <button onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white dark:bg-dark-surface text-coral shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
                <List size={14}/><span>รายการ</span>
              </button>
              <button onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'calendar' ? 'bg-white dark:bg-dark-surface text-coral shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
                <CalendarDays size={14}/><span>ปฏิทิน</span>
              </button>
            </div>

            {/* Filters (list only) */}
            {view === 'list' && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  <input type="text" placeholder="ค้นหางาน..." value={search} onChange={e => setSearch(e.target.value)}
                    className="glass-input rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all w-44"/>
                </div>
                {/* Status filter */}
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white bg-transparent border border-slate-300/30 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-coral">
                  <option value="all">สถานะทั้งหมด</option>
                  <option value="pending">ยังไม่เริ่ม</option>
                  <option value="in_progress">กำลังทำ</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
                {/* Category filter */}
                {categories.length > 0 && (
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                    className="glass-input rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white bg-transparent border border-slate-300/30 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-coral">
                    <option value="all">ประเภททั้งหมด</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-coral border-t-transparent mx-auto"/>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">กำลังโหลด...</p>
          </div>
        ) : view === 'calendar' ? (
          /* ── Calendar view ── */
          <TaskCalendar
            todos={todos}
            onSelectTask={todo => { setSelectedTodo(todo); setIsTaskDetailsOpen(true); }}
            onAddOnDate={dateStr => router.push(`/todos/form?date=${dateStr}`)}
          />
        ) : filtered.length === 0 ? (
          <div className="glass rounded-3xl py-20 text-center border border-slate-200/40 dark:border-white/5 shadow-md flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-coral/10 text-coral/50"><Layers size={40}/></div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">ไม่พบรายการงาน</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ลองปรับตัวกรอง หรือกดเพิ่มงานใหม่</p>
            </div>
            <button onClick={() => router.push('/todos/form')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 shadow-lg transition-all">
              <Plus size={15}/> เพิ่มงาน
            </button>
          </div>
        ) : (
          /* ── List view ── */
          <div className="glass rounded-3xl border border-slate-200/40 dark:border-white/5 shadow-lg overflow-hidden">
            {/* result count */}
            <div className="px-6 py-3 border-b border-slate-200/30 dark:border-white/5 flex items-center justify-between bg-slate-50/40 dark:bg-dark-surface/20">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{filtered.length} รายการ</span>
              {overdueCount > 0 && (
                <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12}/> เลยกำหนด {overdueCount} งาน
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-200/20 dark:divide-white/5">
              {filtered.map(todo => {
                const overdue = isOverdue(todo);
                const statusIcon = todo.status === 'completed'
                  ? <CheckCircle size={16} className="text-emerald-500 shrink-0"/>
                  : overdue
                    ? <AlertCircle size={16} className="text-red-400 shrink-0 animate-pulse"/>
                    : <Circle size={16} className={`shrink-0 ${todo.status === 'in_progress' ? 'text-honey' : 'text-slate-300 dark:text-slate-600'}`}/>;
                const thumb = todo.images && todo.images.length > 0 ? todo.images[0] : null;

                return (
                  <div key={todo.id}
                    onClick={() => { setSelectedTodo(todo); setIsTaskDetailsOpen(true); }}
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-coral/5 transition-colors group ${todo.status === 'completed' ? 'opacity-60' : ''}`}>
                    {statusIcon}

                    {/* Thumbnail */}
                    {thumb && (
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200/40 dark:border-white/10">
                        <img src={thumb} alt="" className="w-full h-full object-cover"/>
                      </div>
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${todo.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                        {todo.title}
                      </p>
                      {todo.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{todo.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {todo.category && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(todo.category)}`}>
                            {todo.category}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          todo.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : todo.status === 'in_progress' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-honey'
                          : 'bg-slate-100 dark:bg-dark-raised text-slate-500 dark:text-slate-400'
                        }`}>{STATUS_LABEL[todo.status]}</span>
                        {todo.deadline && (
                          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                            <Clock size={10}/> {fmtDeadline(todo.deadline)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 group-hover:text-coral transition-colors shrink-0"/>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200/20 dark:border-white/5 bg-slate-50/30 dark:bg-dark-surface/10 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{todos.length} งานทั้งหมด</span>
              <div className="flex gap-3 text-[10px] font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">{completedCount} เสร็จ</span>
                <span className="text-honey">{inProgressCount} กำลังทำ</span>
                <span className="text-slate-400">{pendingCount} รอเริ่ม</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Task details modal ── */}
      <TaskDetails
        isOpen={isTaskDetailsOpen}
        onClose={() => setIsTaskDetailsOpen(false)}
        task={selectedTodo}
        onEdit={task => { setIsTaskDetailsOpen(false); router.push(`/todos/form?id=${task.id}`); }}
        onDelete={handleDelete}
      />
    </div>
  );
}
