'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { supabase } from '@/lib/supabase';
import { uploadTodoImages } from '@/lib/storage';
import { Todo } from '@/components/task-calendar';
import {
  ArrowLeft, Upload, Trash2, Calendar, Clock, Tag, CheckSquare,
  Sparkles, Sun, Moon, LogOut, Grid, ClipboardList, BarChart3, Save, Layers,
} from 'lucide-react';

const CATEGORIES = ['General','Work','Personal','Urgent','Study','Shopping','Finance','บริการวิชาการ'];

/* ── Inner form (uses useSearchParams — must be in Suspense) ── */
function TodoFormInner() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editId       = searchParams.get('id');
  const dateParam    = searchParams.get('date');
  const isEdit       = !!editId;

  /* form state */
  const [title,            setTitle]            = useState('');
  const [description,      setDescription]      = useState('');
  const [date,             setDate]             = useState('');
  const [startTime,        setStartTime]        = useState('');
  const [deadline,         setDeadline]         = useState('');
  const [status,           setStatus]           = useState<'pending'|'in_progress'|'completed'>('pending');
  const [category,         setCategory]         = useState('General');
  const [customCategory,   setCustomCategory]   = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [existingImages,   setExistingImages]   = useState<string[]>([]);
  const [newImageFiles,    setNewImageFiles]     = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews]  = useState<string[]>([]);
  const [uploading,  setUploading]  = useState(false);
  const [fetching,   setFetching]   = useState(isEdit);
  const [errorMsg,   setErrorMsg]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* load existing todo when editing */
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error } = await supabase.from('todos').select('*').eq('id', editId).single();
      if (error || !data) { setErrorMsg('ไม่พบข้อมูลงาน'); setFetching(false); return; }
      const todo = data as Todo;
      setTitle(todo.title);
      setDescription(todo.description || '');
      setDate(todo.date || new Date().toISOString().split('T')[0]);
      setStartTime(todo.start_time ?? '');
      if (todo.deadline) {
        const dl     = new Date(todo.deadline);
        const offset = dl.getTimezoneOffset();
        setDeadline(new Date(dl.getTime() - offset * 60000).toISOString().slice(0, 16));
      }
      setStatus(todo.status);
      if (CATEGORIES.includes(todo.category)) {
        setCategory(todo.category); setIsCustomCategory(false);
      } else {
        setCategory('Custom'); setCustomCategory(todo.category); setIsCustomCategory(true);
      }
      setExistingImages(todo.images || []);
      setFetching(false);
    })();
  }, [editId, user]);

  /* default date for new todo (use ?date= param if from calendar) */
  useEffect(() => {
    if (!isEdit) setDate(dateParam || new Date().toISOString().split('T')[0]);
  }, [isEdit, dateParam]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrorMsg('กรุณากรอกชื่องาน'); return; }
    setUploading(true); setErrorMsg('');
    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) uploadedUrls = await uploadTodoImages(newImageFiles);
      const finalCategory  = isCustomCategory ? customCategory.trim() || 'General' : category;
      const formattedDeadline = deadline ? new Date(deadline).toISOString() : '';
      const payload = {
        title:       title.trim(),
        description: description.trim(),
        date,
        start_time:  startTime || null,
        deadline:    formattedDeadline,
        status,
        category:    finalCategory,
        images:      [...existingImages, ...uploadedUrls],
      };
      if (isEdit) {
        const { error } = await supabase.from('todos').update(payload).eq('id', editId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('todos').insert([{ ...payload, user_id: user!.id }]);
        if (error) throw error;
      }
      router.push('/todos');
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
              <ArrowLeft size={16}/><span className="text-xs font-bold hidden sm:inline">ย้อนกลับ</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white"><Sparkles size={16}/></div>
              <div>
                <h1 className="text-sm font-extrabold text-white">{isEdit ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h1>
                <span className="text-[10px] text-white/60">Taskly · รายการงาน</span>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1 border border-white/20">
            <NavLink href="/"                  icon={<Grid size={13}/>}          label="หน้าหลัก" />
            <NavLink href="/todos"             icon={<Layers size={13}/>}        label="TodoList" active />
            <NavLink href="/worklog"           icon={<ClipboardList size={13}/>} label="บันทึกภาระงาน" />
            <NavLink href="/worklog/dashboard" icon={<BarChart3 size={13}/>}     label="Dashboard" />
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all">
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={signOut} className="p-2 rounded-xl text-white hover:bg-white/20 transition-all"><LogOut size={16}/></button>
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
              <div className="p-2.5 rounded-2xl bg-coral/15 text-coral"><Layers size={22}/></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{isEdit ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">กรอกข้อมูลให้ครบถ้วนแล้วกด "บันทึก"</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-600 dark:text-red-400">{errorMsg}</div>
            )}

            {/* ── Title + Description ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">ข้อมูลหลัก</h3>
              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">ชื่องาน *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="ระบุชื่องานที่ต้องทำ..."
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">รายละเอียด</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="อธิบายรายละเอียดเกี่ยวกับงานชิ้นนี้..." rows={4}
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all resize-none"/>
              </div>
            </div>

            {/* ── Date + Time ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13}/> วันที่และเวลา
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                    <Calendar size={13}/> วันที่เริ่มต้น *
                  </label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                    <Clock size={13}/> เวลาเริ่มต้น
                  </label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                    <Clock size={13}/> วันครบกำหนดส่ง (Deadline)
                  </label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                </div>
              </div>
            </div>

            {/* ── Status + Category ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">การจัดหมวดหมู่</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                    <CheckSquare size={13}/> สถานะของงาน
                  </label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all">
                    <option value="pending"     className="bg-white dark:bg-dark-surface">ยังไม่เริ่ม (Pending)</option>
                    <option value="in_progress" className="bg-white dark:bg-dark-surface">กำลังทำ (In Progress)</option>
                    <option value="completed"   className="bg-white dark:bg-dark-surface">เสร็จสิ้น (Completed)</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                    <Tag size={13}/> หมวดหมู่ (Category)
                  </label>
                  {!isCustomCategory ? (
                    <select value={category}
                      onChange={e => { if (e.target.value === 'Custom') { setIsCustomCategory(true); setCategory('Custom'); } else setCategory(e.target.value); }}
                      className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all">
                      {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-dark-surface">{cat}</option>)}
                      <option value="Custom" className="bg-white dark:bg-dark-surface">+ เพิ่มหมวดหมู่เอง</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        placeholder="เช่น ออกกำลังกาย..."
                        className="flex-1 rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"/>
                      <button type="button" onClick={() => { setIsCustomCategory(false); setCategory('General'); }}
                        className="px-3 rounded-2xl glass hover:bg-coral/10 text-coral/60 text-xs font-semibold shrink-0">ยกเลิก</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Images ── */}
            <div className="glass rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">รูปภาพประกอบ (อัพโหลดได้หลายรูป)</h3>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blush dark:border-coral/30 hover:border-coral rounded-2xl p-7 text-center cursor-pointer transition-colors flex flex-col items-center gap-2 bg-blush/10 dark:bg-coral/5">
                <Upload className="h-8 w-8 text-coral/60"/>
                <p className="text-sm font-semibold text-coral dark:text-blush">คลิกที่นี่เพื่ออัปโหลดรูปภาพ</p>
                <p className="text-xs text-coral/50">PNG, JPG, GIF</p>
                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" onChange={handleFileChange} className="hidden"/>
              </div>
              {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {existingImages.map((url, i) => (
                    <div key={`e-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                      <img src={url} alt="" className="h-full w-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => setExistingImages(p => p.filter((_,j)=>j!==i))} className="p-1.5 rounded-lg bg-red-600 text-white"><Trash2 size={13}/></button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 bg-black/60 text-[9px] text-white rounded">จากเซิร์ฟเวอร์</span>
                    </div>
                  ))}
                  {newImagePreviews.map((url, i) => (
                    <div key={`n-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                      <img src={url} alt="" className="h-full w-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => { setNewImageFiles(p=>p.filter((_,j)=>j!==i)); setNewImagePreviews(p=>p.filter((_,j)=>j!==i)); }} className="p-1.5 rounded-lg bg-red-600 text-white"><Trash2 size={13}/></button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 bg-coral text-[9px] text-white rounded">ยังไม่อัพโหลด</span>
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
                  : <><Save size={16}/><span>{isEdit ? 'บันทึกการแก้ไข' : 'บันทึกงาน'}</span></>
                }
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function TodoFormPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-base">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"/>
      </div>
    }>
      <TodoFormInner />
    </Suspense>
  );
}
