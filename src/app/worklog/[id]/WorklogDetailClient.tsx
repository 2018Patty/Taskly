'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import { deleteTodoImages } from '@/lib/storage';
import {
  WorkLog,
  calcHours, formatHours, formatThaiDate, formatDateRange,
  getWorkTypeMainCode, getWorkTypeFullLabel,
} from '@/lib/worklog-types';
import {
  ArrowLeft, Calendar, Tag, Timer, Edit3, Trash2,
  ChevronLeft, ChevronRight, Maximize2, Share2, Check, Copy,
  Sparkles, Sun, Moon, LogOut, User, Grid, ClipboardList, BarChart3, X, Layers, CalendarDays,
} from 'lucide-react';

export default function WorklogDetailClient({ id }: { id: string }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [log,          setLog]          = useState<WorkLog | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied,       setCopied]       = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  /* close share menu on outside click */
  useEffect(() => {
    if (!showShareMenu) return;
    const handle = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShareMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showShareMenu]);

  /* fetch log */
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('work_logs').select('*').eq('id', id).single();
      if (!error && data) setLog(data as WorkLog);
      setLoading(false);
    })();
  }, [id, user]);

  /* share helpers */
  const buildShareText = (l: WorkLog) => {
    const mainCode  = getWorkTypeMainCode(l.work_type_code);
    const mainLabel = mainCode === '1' ? 'การเรียนการสอน' : mainCode === '3' ? 'บริการวิชาการ' : 'ภาระงานอื่น ๆ';
    const hrs       = calcHours(l.start_time, l.end_time, l.exclude_lunch);
    const fullLabel = getWorkTypeFullLabel(l);
    const lines = [
      `📋 บันทึกภาระงาน: ${l.title}`,
      `📅 วันที่: ${formatThaiDate(l.work_date)}`,
      `⏱ เวลา: ${l.start_time.slice(0, 5)} – ${l.end_time.slice(0, 5)} น. (รวม ${formatHours(hrs)})`,
      `🏷 ประเภท ${l.work_type_code} (${mainLabel}) – ${fullLabel}`,
    ];
    if (l.description) lines.push('', l.description);
    return lines.join('\n');
  };

  /* Facebook share — shares current URL which now carries OG meta tags */
  const handleShareFacebook = () => {
    if (!log) return;
    const pageUrl = window.location.href;
    const fbUrl   = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=620,height=540');
    setShowShareMenu(false);
  };

  const handleCopyText = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(buildShareText(log));
      setCopied(true);
      setTimeout(() => { setCopied(false); setShowShareMenu(false); }, 1800);
    } catch { setShowShareMenu(false); }
  };

  const handleDelete = async () => {
    if (!log) return;
    if ((log.images ?? []).length > 0) await deleteTodoImages(log.images!);
    await supabase.from('work_logs').delete().eq('id', log.id);
    router.push('/worklog');
  };

  /* nav helper */
  const NavLink = ({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) =>
    active
      ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/25 text-white shadow-sm">{icon}<span>{label}</span></span>
      : <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all">{icon}<span>{label}</span></Link>;

  /* loading / auth */
  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent" />
    </div>
  );
  if (!user) return null;
  if (!log) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-slate-50 dark:bg-dark-base">
      <p className="text-slate-500 font-semibold">ไม่พบข้อมูลภาระงาน</p>
      <Link href="/worklog" className="text-coral text-sm font-bold hover:underline flex items-center gap-1">
        <ArrowLeft size={14} /> กลับหน้ารายการ
      </Link>
    </div>
  );

  const images    = log.images ?? [];
  const hours     = calcHours(log.start_time, log.end_time, log.exclude_lunch);
  const mainCode  = getWorkTypeMainCode(log.work_type_code);
  const fullLabel = getWorkTypeFullLabel(log);

  const typeBadgeCls = mainCode === '1'
    ? 'bg-mint/15 text-teal-700 dark:text-mint border-mint/30'
    : mainCode === '3'
    ? 'bg-honey/15 text-amber-700 dark:text-honey border-honey/30'
    : 'bg-steel/15 text-blue-700 dark:text-steel border-steel/30';

  const mainLabel = mainCode === '1' ? 'การเรียนการสอน' : mainCode === '3' ? 'บริการวิชาการ' : 'ภาระงานอื่น ๆ';

  return (
    <div className="min-h-screen pb-20 bg-linear-to-br from-blush/10 via-slate-50 to-mint/10 dark:from-dark-base dark:via-dark-base dark:to-honey/5">

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
                <h1 className="text-sm font-extrabold text-white line-clamp-1 max-w-48 sm:max-w-80">{log.title}</h1>
                <span className="text-[10px] text-white/60">ภาระงาน · {formatThaiDate(log.work_date)}</span>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}           label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}         label="TodoList" />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>}  label="บันทึกภาระงาน" active />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}      label="Dashboard" />
            <NavLink href="/timetable"         icon={<CalendarDays size={13}/>}   label="ตารางสอน" />
          </nav>
          <div className="flex items-center gap-2">
            {user && <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30">
              <div className="h-6 w-6 rounded-lg bg-white/20 text-white flex items-center justify-center"><User size={14}/></div>
              <span className="text-xs font-semibold text-white truncate max-w-32">{user.email}</span>
            </div>}
            <button onClick={toggleTheme} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={signOut} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all"><LogOut size={16}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Hero image ── */}
        {images.length > 0 && (
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '16/7' }}>
            <img src={images[activeIdx]} alt={log.title}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setIsFullscreen(true)}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent pointer-events-none" />
            {images.length > 1 && (
              <>
                <button onClick={() => setActiveIdx(p => p === 0 ? images.length - 1 : p - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all">
                  <ChevronLeft size={18}/>
                </button>
                <button onClick={() => setActiveIdx(p => p === images.length - 1 ? 0 : p + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all">
                  <ChevronRight size={18}/>
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setActiveIdx(i)}
                      className={`rounded-full transition-all ${i === activeIdx ? 'bg-white w-5 h-2' : 'bg-white/50 w-2 h-2 hover:bg-white/80'}`} />
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setIsFullscreen(true)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all">
              <Maximize2 size={15}/>
            </button>
            <div className="absolute bottom-4 right-4 text-white text-xs font-bold bg-black/50 px-2.5 py-1 rounded-full">
              {activeIdx + 1} / {images.length}
            </div>
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto py-1">
            {images.map((url, i) => (
              <button key={i} onClick={() => setActiveIdx(i)}
                className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === activeIdx ? 'border-coral scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={url} alt="" className="w-full h-full object-cover"/>
              </button>
            ))}
          </div>
        )}

        {/* ── Title + type badge ── */}
        <div className="glass rounded-3xl p-6 border border-slate-200/40 dark:border-white/5 shadow-md space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${typeBadgeCls}`}>
              {log.work_type_code}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{mainLabel}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">{log.title}</h2>
        </div>

        {/* ── Meta cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-dark-raised text-slate-600 dark:text-slate-400 shrink-0">
              <Calendar size={20}/>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">วันที่ปฏิบัติงาน</span>
              <span className="text-base font-bold text-slate-800 dark:text-white">{formatDateRange(log.work_date, log.end_date)}</span>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-honey/20 bg-honey/5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-honey/15 text-amber-600 dark:text-honey shrink-0">
              <Timer size={20}/>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เวลาปฏิบัติงาน</span>
              <span className="text-base font-bold text-slate-800 dark:text-white">
                {log.start_time.slice(0, 5)} – {log.end_time.slice(0, 5)} น.
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-amber-600 dark:text-honey">รวม {formatHours(hours)}</span>
                {log.exclude_lunch && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-dark-muted text-slate-500 dark:text-slate-400">
                    หักพักเที่ยง 1 ชม.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Work type ── */}
        <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 shadow-sm flex items-start gap-4">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-dark-raised text-slate-600 dark:text-slate-400 shrink-0">
            <Tag size={20}/>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ประเภทงาน</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-white leading-relaxed">
              {log.work_type_code} – {fullLabel}
            </span>
            {log.work_type_role && (
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">ฐานะ/บทบาท: {log.work_type_role}</span>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        {log.description ? (
          <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">รายละเอียด</span>
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{log.description}</p>
          </div>
        ) : (
          <p className="text-slate-400 dark:text-slate-500 text-sm italic px-1">ไม่มีรายละเอียดเพิ่มเติม</p>
        )}

        {/* ── Actions ── */}
        <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setIsDeleting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all">
            <Trash2 size={15}/><span>ลบ</span>
          </button>

          <div className="flex items-center gap-3">
            {/* Share */}
            <div className="relative" ref={shareRef}>
              <button onClick={() => setShowShareMenu(p => !p)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-dark-raised text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50 text-sm font-semibold transition-all">
                <Share2 size={15}/><span>แชร์</span>
              </button>
              {showShareMenu && (
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-white dark:bg-dark-raised rounded-2xl shadow-xl border border-slate-200/60 dark:border-white/10 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100">
                  <button onClick={handleShareFacebook}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#1877F2]/10 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-bold">แชร์ไป Facebook</p>
                      <p className="text-[10px] text-slate-400">พร้อมรูปและรายละเอียด</p>
                    </div>
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-white/5 mx-3"/>
                  <button onClick={handleCopyText}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-dark-muted flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      {copied ? <Check size={14}/> : <Copy size={14}/>}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-bold">{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกข้อความ'}</p>
                      <p className="text-[10px] text-slate-400">สำหรับโพสต์ด้วยตนเอง</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Edit */}
            <button onClick={() => router.push(`/worklog/form?id=${log.id}`)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-coral hover:bg-coral/90 text-white text-sm font-bold shadow-lg shadow-coral/20 transition-all">
              <Edit3 size={15}/><span>แก้ไข</span>
            </button>
          </div>
        </div>
      </main>

      {/* ── Delete confirm ── */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-2xl border border-white/20 dark:border-white/5 p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-100">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">ยืนยันการลบ?</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              ลบภาระงาน <strong className="text-slate-800 dark:text-white">"{log.title}"</strong> และรูปภาพทั้งหมดออก ไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setIsDeleting(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-dark-raised text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50">
                ยกเลิก
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold shadow">
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen image ── */}
      {isFullscreen && (
        <div onClick={() => setIsFullscreen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 cursor-zoom-out">
          <button onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
            <X size={20}/>
          </button>
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setActiveIdx(p => p === 0 ? images.length - 1 : p - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white">
                <ChevronLeft size={22}/>
              </button>
              <button onClick={e => { e.stopPropagation(); setActiveIdx(p => p === images.length - 1 ? 0 : p + 1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white">
                <ChevronRight size={22}/>
              </button>
            </>
          )}
          <img src={images[activeIdx]} alt="fullscreen" className="max-h-full max-w-full object-contain"/>
        </div>
      )}
    </div>
  );
}
