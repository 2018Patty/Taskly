'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import { uploadTodoImages } from '@/lib/storage';
import {
  WorkLog, WORK_TYPES,
  calcHours, formatHours, getWorkTypeSub,
} from '@/lib/worklog-types';
import {
  ArrowLeft, Upload, Trash2, Calendar, Clock, Tag, Timer,
  Sparkles, Sun, Moon, LogOut, User, Grid, ClipboardList, BarChart3, Save, Layers,
} from 'lucide-react';

/* ── Inner form (uses useSearchParams — must be in Suspense) ── */
function WorklogFormInner() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editId       = searchParams.get('id');
  const isEdit       = !!editId;

  /* form state */
  const [workDate,     setWorkDate]     = useState('');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [startTime,    setStartTime]    = useState('09:00');
  const [endTime,      setEndTime]      = useState('12:00');
  const [excludeLunch, setExcludeLunch] = useState(false);
  const [workTypeCode, setWorkTypeCode] = useState('3.1.1');
  const [workTypeRole, setWorkTypeRole] = useState('');
  const [existingImages,    setExistingImages]    = useState<string[]>([]);
  const [newImageFiles,     setNewImageFiles]     = useState<File[]>([]);
  const [newImagePreviews,  setNewImagePreviews]  = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fetching,  setFetching]  = useState(isEdit);
  const [errorMsg,  setErrorMsg]  = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hours         = calcHours(startTime, endTime, excludeLunch);
  const selectedSub   = getWorkTypeSub(workTypeCode);
  const showRoleInput = selectedSub?.hasRole ?? false;

  /* load existing log when editing */
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from('work_logs').select('*').eq('id', editId).single();
      if (error || !data) { setErrorMsg('ไม่พบข้อมูลภาระงาน'); setFetching(false); return; }
      const log = data as WorkLog;
      setWorkDate(log.work_date);
      setTitle(log.title);
      setDescription(log.description ?? '');
      setStartTime(log.start_time.slice(0, 5));
      setEndTime(log.end_time.slice(0, 5));
      setExcludeLunch(log.exclude_lunch ?? false);
      setWorkTypeCode(log.work_type_code);
      setWorkTypeRole(log.work_type_role ?? '');
      setExistingImages(log.images ?? []);
      setFetching(false);
    })();
  }, [editId, user]);

  /* default date for new log */
  useEffect(() => {
    if (!isEdit) setWorkDate(new Date().toISOString().split('T')[0]);
  }, [isEdit]);

  const ALLOWED_MIME = ['image/jpeg','image/png','image/gif','image/webp'];
  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target?.result as string); fr.readAsDataURL(file); });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const all   = Array.from(e.target.files);
    const valid = all.filter(f => ALLOWED_MIME.includes(f.type));
    if (all.length - valid.length > 0) setErrorMsg(`ไม่รองรับไฟล์ ${all.length - valid.length} รายการ`);
    if (valid.length === 0) return;
    setNewImageFiles(prev => [...prev, ...valid]);
    const previews = await Promise.all(valid.map(readAsDataUrl));
    setNewImagePreviews(prev => [...prev, ...previews]);
  };

  const handleTypeChange = (code: string) => {
    setWorkTypeCode(code);
    if (!getWorkTypeSub(code)?.hasRole) setWorkTypeRole('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())  { setErrorMsg('กรุณากรอกชื่องาน'); return; }
    if (!workDate)      { setErrorMsg('กรุณาระบุวันที่ปฏิบัติงาน'); return; }
    if (hours <= 0)     { setErrorMsg('เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น'); return; }
    if (showRoleInput && !workTypeRole.trim()) { setErrorMsg('กรุณาระบุฐานะ/บทบาท'); return; }

    setUploading(true); setErrorMsg('');
    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) uploadedUrls = await uploadTodoImages(newImageFiles);
      const payload = {
        work_date:      workDate,
        title:          title.trim(),
        description:    description.trim() || null,
        start_time:     startTime,
        end_time:       endTime,
        exclude_lunch:  excludeLunch,
        work_type_code: workTypeCode,
        work_type_role: showRoleInput ? workTypeRole.trim() || null : null,
        images:         [...existingImages, ...uploadedUrls],
      };
      if (isEdit) {
        const { error } = await supabase.from('work_logs').update(payload).eq('id', editId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_logs').insert([{ ...payload, user_id: user!.id }]);
        if (error) throw error;
      }
      router.push('/worklog');
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setUploading(false);
    }
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
              <ArrowLeft size={16} /><span className="text-xs font-bold hidden sm:inline">ย้อนกลับ</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white"><Sparkles size={16}/></div>
              <div>
                <h1 className="text-sm font-extrabold text-white">{isEdit ? 'แก้ไขภาระงาน' : 'บันทึกภาระงานใหม่'}</h1>
                <span className="text-[10px] text-white/60">Taskly · บันทึกภาระงาน</span>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}         label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}       label="TodoList" />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>} label="บันทึกภาระงาน" active />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}    label="Dashboard" />
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={signOut} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all">
              <LogOut size={16}/>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {fetching ? (
          <div className="py-24 text-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-coral border-t-transparent mx-auto"/></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Page title */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-200/40 dark:border-white/5">
              <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><ClipboardList size={22}/></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{isEdit ? 'แก้ไขภาระงาน' : 'บันทึกภาระงานใหม่'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">กรอกข้อมูลให้ครบถ้วนแล้วกด "บันทึก"</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-600 dark:text-red-400">{errorMsg}</div>
            )}

            {/* ── Title ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">ข้อมูลหลัก</h3>
              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ชื่องาน *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="ระบุชื่อภาระงาน..."
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">รายละเอียด</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="อธิบายรายละเอียดภาระงาน..." rows={4}
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all resize-none"/>
              </div>
            </div>

            {/* ── Date + Time ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13}/> วันและเวลาปฏิบัติงาน
              </h3>
              {/* Start row */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-end">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-coral/10 self-end">
                  <span className="text-[10px] font-extrabold text-coral uppercase tracking-wider">เริ่มงาน</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">วันที่ *</label>
                  <input type="date" required value={workDate} onChange={e => setWorkDate(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <Clock size={11}/> เวลา *
                  </label>
                  <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
              </div>
              {/* End row */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-end">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200/60 dark:bg-dark-muted/50 self-end">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สิ้นสุด</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">วันที่</label>
                  <div className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 bg-slate-100/60 dark:bg-dark-raised/60 border border-slate-200/40 dark:border-white/5">
                    วันเดียวกัน
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <Clock size={11}/> เวลา *
                  </label>
                  <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
              </div>
              {/* Hours summary */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${hours > 0 ? 'bg-honey/10 dark:bg-honey/5 border-honey/30' : 'bg-slate-100 dark:bg-dark-raised border-slate-200 dark:border-dark-muted'}`}>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Timer size={14}/> ชั่วโมงรวม
                </span>
                <span className={`text-base font-extrabold tabular-nums ${hours > 0 ? 'text-amber-700 dark:text-honey' : 'text-slate-400'}`}>
                  {hours > 0 ? formatHours(hours) : '—'}
                </span>
              </div>
              {/* Exclude lunch */}
              <label className="flex items-center gap-3 cursor-pointer select-none group w-fit">
                <div className="relative">
                  <input type="checkbox" checked={excludeLunch} onChange={e => setExcludeLunch(e.target.checked)} className="sr-only peer"/>
                  <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-dark-muted bg-white dark:bg-dark-raised peer-checked:bg-coral peer-checked:border-coral transition-all flex items-center justify-center">
                    {excludeLunch && <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-coral transition-colors">
                  ไม่คิดเวลาพักเที่ยง 12:00–13:00 น.
                </span>
                {excludeLunch && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-honey/10 text-amber-700 dark:text-honey border border-amber-200 dark:border-honey/20">หักออก 1 ชม.</span>}
              </label>
            </div>

            {/* ── Work Type ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={13}/> ประเภทงาน
              </h3>
              <select value={workTypeCode} onChange={e => handleTypeChange(e.target.value)}
                className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all">
                {WORK_TYPES.map(group => (
                  <optgroup key={group.mainCode} label={`${group.mainCode}. ${group.mainLabel}`} className="bg-white dark:bg-dark-surface font-semibold">
                    {group.subs.map(sub => (
                      <option key={sub.code} value={sub.code} className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white font-normal">
                        {sub.code} – {sub.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {showRoleInput && (
                <div>
                  <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ระบุฐานะ / บทบาท *</label>
                  <input type="text" value={workTypeRole} onChange={e => setWorkTypeRole(e.target.value)}
                    placeholder="เช่น ประธาน, กรรมการ, ผู้แทนคณะ..."
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
              )}
            </div>

            {/* ── Images ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">รูปภาพประกอบ</h3>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blush dark:border-coral/30 hover:border-coral rounded-2xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center gap-2 bg-blush/10 dark:bg-coral/5">
                <Upload className="h-7 w-7 text-coral/60"/>
                <p className="text-sm font-semibold text-coral dark:text-blush">คลิกเพื่ออัปโหลดรูปภาพ</p>
                <p className="text-xs text-coral/50">PNG, JPG, GIF, WebP</p>
                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" onChange={handleFileChange} className="hidden"/>
              </div>
              {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {existingImages.map((url, i) => (
                    <div key={`e-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                      <img src={url} alt="" className="h-full w-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 rounded-lg bg-red-600 text-white"><Trash2 size={13}/></button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 bg-black/60 text-[9px] text-white rounded">บันทึกแล้ว</span>
                    </div>
                  ))}
                  {newImagePreviews.map((url, i) => (
                    <div key={`n-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                      <img src={url} alt="" className="h-full w-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => { setNewImageFiles(p => p.filter((_,j)=>j!==i)); setNewImagePreviews(p => p.filter((_,j)=>j!==i)); }} className="p-1.5 rounded-lg bg-red-600 text-white"><Trash2 size={13}/></button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 bg-coral text-[9px] text-white rounded">ยังไม่อัพ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => router.back()} disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-300 dark:border-dark-raised text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-raised/50 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={uploading}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-coral text-white text-sm font-bold hover:bg-coral/90 disabled:bg-coral/50 disabled:cursor-not-allowed shadow-lg shadow-coral/20 transition-all">
                {uploading
                  ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/><span>กำลังบันทึก...</span></>
                  : <><Save size={16}/><span>{isEdit ? 'บันทึกการแก้ไข' : 'บันทึกภาระงาน'}</span></>
                }
              </button>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}

export default function WorklogFormPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"/>
      </div>
    }>
      <WorklogFormInner />
    </Suspense>
  );
}
