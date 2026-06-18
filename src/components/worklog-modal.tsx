'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Calendar, Clock, Tag, Timer } from 'lucide-react';
import {
  WorkLog,
  WorkLogFormData,
  WORK_TYPES,
  calcHours,
  formatHours,
  getWorkTypeSub,
} from '@/lib/worklog-types';
import { uploadTodoImages } from '@/lib/storage';

interface WorklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: WorkLogFormData) => Promise<void>;
  log?: WorkLog;
}

export default function WorklogModal({ isOpen, onClose, onSave, log }: WorklogModalProps) {
  const [workDate, setWorkDate]         = useState('');
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [startTime, setStartTime]       = useState('09:00');
  const [endTime, setEndTime]           = useState('12:00');
  const [excludeLunch, setExcludeLunch] = useState(false);
  const [workTypeCode, setWorkTypeCode] = useState('3.1.1');
  const [workTypeRole, setWorkTypeRole] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles]   = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hours           = calcHours(startTime, endTime, excludeLunch);
  const selectedSub     = getWorkTypeSub(workTypeCode);
  const showRoleInput   = selectedSub?.hasRole ?? false;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setNewImageFiles([]);
    setNewImagePreviews([]);

    if (log) {
      setWorkDate(log.work_date);
      setTitle(log.title);
      setDescription(log.description ?? '');
      setStartTime(log.start_time.slice(0, 5));
      setEndTime(log.end_time.slice(0, 5));
      setExcludeLunch(log.exclude_lunch ?? false);
      setWorkTypeCode(log.work_type_code);
      setWorkTypeRole(log.work_type_role ?? '');
      setExistingImages(log.images ?? []);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setWorkDate(today);
      setTitle('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('12:00');
      setExcludeLunch(false);
      setWorkTypeCode('3.1.1');
      setWorkTypeRole('');
      setExistingImages([]);
    }
  }, [isOpen, log]);

  if (!isOpen) return null;

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const all = Array.from(e.target.files);
    const valid = all.filter(f => ALLOWED_MIME.includes(f.type));
    const skipped = all.length - valid.length;
    if (skipped > 0) {
      setErrorMsg(`ไม่รองรับไฟล์ ${skipped} รายการ — ใช้ได้เฉพาะ JPG, PNG, GIF, WebP เท่านั้น`);
    }
    if (valid.length === 0) return;
    setNewImageFiles(prev => [...prev, ...valid]);
    const previews = await Promise.all(valid.map(readAsDataUrl));
    setNewImagePreviews(prev => [...prev, ...previews]);
  };

  const removeExistingImage = (i: number) =>
    setExistingImages(prev => prev.filter((_, idx) => idx !== i));

  const removeNewImage = (i: number) => {
    setNewImageFiles(prev => prev.filter((_, idx) => idx !== i));
    setNewImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleTypeChange = (code: string) => {
    setWorkTypeCode(code);
    if (!getWorkTypeSub(code)?.hasRole) setWorkTypeRole('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrorMsg('กรุณากรอกชื่องาน'); return; }
    if (!workDate)     { setErrorMsg('กรุณาระบุวันที่ปฏิบัติงาน'); return; }
    if (hours <= 0)    { setErrorMsg('เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น'); return; }
    if (showRoleInput && !workTypeRole.trim()) { setErrorMsg('กรุณาระบุฐานะ/บทบาท'); return; }

    setUploading(true);
    setErrorMsg('');
    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) uploadedUrls = await uploadTodoImages(newImageFiles);
      await onSave({
        work_date:      workDate,
        title:          title.trim(),
        description:    description.trim() || null,
        start_time:     startTime,
        end_time:       endTime,
        exclude_lunch:  excludeLunch,
        work_type_code: workTypeCode,
        work_type_role: showRoleInput ? workTypeRole.trim() || null : null,
        images:         [...existingImages, ...uploadedUrls],
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-blush/30 dark:border-dark-muted overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-6 border-b border-blush/40 dark:border-coral/10 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {log ? 'แก้ไขภาระงาน' : 'เพิ่มภาระงานใหม่'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl text-coral/60 hover:bg-coral/10 hover:text-coral transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
              ชื่องาน *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ระบุชื่อภาระงาน..."
              className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
              รายละเอียด
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="อธิบายรายละเอียดภาระงาน..."
              rows={3}
              className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all resize-none"
            />
          </div>

          {/* Date + Time */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/8 bg-slate-50/50 dark:bg-dark-raised/40 p-4 space-y-3">
            <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={12} /> วันและเวลาปฏิบัติงาน
            </p>

            {/* Start row */}
            <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-coral/10 self-end mb-0.5">
                <span className="text-[10px] font-extrabold text-coral uppercase tracking-wider whitespace-nowrap">เริ่มงาน</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                    วันที่ *
                  </label>
                  <input
                    type="date"
                    required
                    value={workDate}
                    onChange={e => setWorkDate(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                    <Clock size={11} /> เวลา *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"
                  />
                </div>
              </div>
            </div>

            {/* End row */}
            <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/60 dark:bg-dark-muted/50 self-end mb-0.5">
                <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">สิ้นสุด</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                    วันที่
                  </label>
                  <div className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 bg-slate-100/60 dark:bg-dark-raised/60 border border-slate-200/40 dark:border-white/5 select-none">
                    วันเดียวกัน
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                    <Clock size={11} /> เวลา *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Hours summary */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${
              hours > 0
                ? 'bg-honey/10 dark:bg-honey/5 border-honey/30'
                : 'bg-slate-100 dark:bg-dark-raised border-slate-200 dark:border-dark-muted'
            }`}>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <Timer size={13} /> ชั่วโมงรวม
              </span>
              <span className={`text-sm font-extrabold tabular-nums ${hours > 0 ? 'text-amber-700 dark:text-honey' : 'text-slate-400'}`}>
                {hours > 0 ? formatHours(hours) : '—'}
              </span>
            </div>
          </div>

          {/* Exclude lunch checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none group w-fit">
            <div className="relative">
              <input
                type="checkbox"
                checked={excludeLunch}
                onChange={e => setExcludeLunch(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-dark-muted bg-white dark:bg-dark-raised peer-checked:bg-coral peer-checked:border-coral transition-all flex items-center justify-center">
                {excludeLunch && (
                  <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                    <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-coral transition-colors">
              ไม่คิดเวลาพักเที่ยง 12:00–13:00 น.
            </span>
            {excludeLunch && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-honey/10 text-amber-700 dark:text-honey border border-amber-200 dark:border-honey/20">
                หักออก 1 ชม.
              </span>
            )}
          </label>

          {/* Work Type */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
              <Tag size={13} /> ประเภทงาน *
            </label>
            <select
              value={workTypeCode}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral transition-all"
            >
              {WORK_TYPES.map(group => (
                <optgroup
                  key={group.mainCode}
                  label={`${group.mainCode}. ${group.mainLabel}`}
                  className="bg-white dark:bg-dark-surface font-semibold"
                >
                  {group.subs.map(sub => (
                    <option
                      key={sub.code}
                      value={sub.code}
                      className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white font-normal"
                    >
                      {sub.code} – {sub.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Role input (only for 4.4.1) */}
          {showRoleInput && (
            <div>
              <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                ระบุฐานะ / บทบาท *
              </label>
              <input
                type="text"
                value={workTypeRole}
                onChange={e => setWorkTypeRole(e.target.value)}
                placeholder="เช่น ประธาน, กรรมการ, ผู้แทนคณะ..."
                className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral transition-all"
              />
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              รูปภาพประกอบ
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blush dark:border-coral/30 hover:border-coral dark:hover:border-coral rounded-2xl p-5 text-center cursor-pointer transition-colors flex flex-col items-center gap-2 bg-blush/10 dark:bg-coral/5"
            >
              <Upload className="h-7 w-7 text-coral/60" />
              <p className="text-sm font-semibold text-coral dark:text-blush">คลิกเพื่ออัปโหลดรูปภาพ</p>
              <p className="text-xs text-coral/50">รองรับ PNG, JPG, GIF</p>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" onChange={handleFileChange} className="hidden" />
            </div>

            {(existingImages.length > 0 || newImagePreviews.length > 0) && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {existingImages.map((url, i) => (
                  <div key={`e-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeExistingImage(i)} className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1 bg-black/60 text-[9px] text-white rounded">บันทึกแล้ว</span>
                  </div>
                ))}
                {newImagePreviews.map((url, i) => (
                  <div key={`n-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeNewImage(i)} className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1 bg-coral text-[9px] text-white rounded">ยังไม่อัพ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-blush/40 dark:border-coral/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-dark-raised text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-raised/50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2.5 rounded-xl bg-coral text-sm font-semibold text-white hover:bg-coral/90 disabled:bg-coral/50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>กำลังบันทึก...</span></>
              ) : (
                <span>บันทึกภาระงาน</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
