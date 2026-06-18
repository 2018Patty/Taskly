'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X, Calendar, Clock, Tag, Timer, Edit3, Trash2,
  ChevronLeft, ChevronRight, Maximize2, Share2, Check, Copy
} from 'lucide-react';
import {
  WorkLog,
  calcHours,
  formatHours,
  formatThaiDate,
  getWorkTypeSub,
  getWorkTypeMainCode,
  getWorkTypeFullLabel,
} from '@/lib/worklog-types';

interface WorklogDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  log: WorkLog | null;
  onEdit: (log: WorkLog) => void;
  onDelete: (logId: string, imageUrls: string[]) => void;
}

export default function WorklogDetails({ isOpen, onClose, log, onEdit, onDelete }: WorklogDetailsProps) {
  const [activeIdx, setActiveIdx]           = useState(0);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [showShareMenu, setShowShareMenu]   = useState(false);
  const [copied, setCopied]                 = useState(false);
  const shareRef                            = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShareMenu) return;
    const handle = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showShareMenu]);

  if (!isOpen || !log) return null;

  const images    = log.images ?? [];
  const hours     = calcHours(log.start_time, log.end_time, log.exclude_lunch);
  const mainCode  = getWorkTypeMainCode(log.work_type_code);
  const sub       = getWorkTypeSub(log.work_type_code);
  const fullLabel = getWorkTypeFullLabel(log);

  const typeBadge = mainCode === '1'
    ? 'bg-mint/15 text-teal-700 dark:text-mint border-mint/30'
    : mainCode === '3'
    ? 'bg-honey/15 text-amber-700 dark:text-honey border-honey/30'
    : 'bg-steel/15 text-blue-700 dark:text-steel border-steel/30';

  const handlePrev = (e: React.MouseEvent) => { e.stopPropagation(); setActiveIdx(p => (p === 0 ? images.length - 1 : p - 1)); };
  const handleNext = (e: React.MouseEvent) => { e.stopPropagation(); setActiveIdx(p => (p === images.length - 1 ? 0 : p + 1)); };

  const buildShareText = () => {
    const mainLabel = mainCode === '1' ? 'การเรียนการสอน' : mainCode === '3' ? 'บริการวิชาการ' : 'ภาระงานอื่น ๆ';
    const lines = [
      `📋 บันทึกภาระงาน: ${log.title}`,
      `📅 วันที่: ${formatThaiDate(log.work_date)}`,
      `⏱ เวลา: ${log.start_time.slice(0, 5)} – ${log.end_time.slice(0, 5)} น. (รวม ${formatHours(hours)})`,
      `🏷 ประเภท ${log.work_type_code} (${mainLabel}) – ${fullLabel}`,
    ];
    if (log.description) lines.push('', log.description);
    return lines.join('\n');
  };

  const handleShareFacebook = () => {
    const text = buildShareText();
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(text)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=620,height=540');
    setShowShareMenu(false);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setCopied(true);
      setTimeout(() => { setCopied(false); setShowShareMenu(false); }, 1800);
    } catch {
      setShowShareMenu(false);
    }
  };

  const confirmDelete = () => {
    onDelete(log.id, log.images ?? []);
    setIsDeleting(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white dark:bg-dark-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-dark-muted overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="p-6 border-b border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${typeBadge}`}>
                {log.work_type_code}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-xs truncate">
                {mainCode === '1' ? 'การเรียนการสอน' : mainCode === '3' ? 'บริการวิชาการ' : 'ภาระงานอื่น ๆ'}
              </span>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/50 dark:hover:bg-dark-raised/50 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">

            {/* Title */}
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {log.title}
            </h2>

            {/* Meta grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50/50 dark:bg-dark-surface/20 border border-slate-200/40 dark:border-white/5">
                <div className="p-2.5 rounded-xl bg-slate-200/50 dark:bg-dark-raised text-slate-600 dark:text-slate-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">วันที่ปฏิบัติงาน</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatThaiDate(log.work_date)}</span>
                </div>
              </div>

              {/* Time + Hours */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-honey/5 dark:bg-honey/5 border border-honey/20">
                <div className="p-2.5 rounded-xl bg-honey/15 text-amber-600 dark:text-honey">
                  <Timer size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เวลาปฏิบัติงาน</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {log.start_time.slice(0, 5)} – {log.end_time.slice(0, 5)} น.
                  </span>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-honey block mt-0.5">
                    รวม {formatHours(hours)}
                  </span>
                  {log.exclude_lunch && (
                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-dark-muted text-slate-500 dark:text-slate-400">
                      หักพักเที่ยง 1 ชม.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Work type full label */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/50 dark:bg-dark-surface/20 border border-slate-200/40 dark:border-white/5">
              <div className="p-2.5 rounded-xl bg-slate-200/50 dark:bg-dark-raised text-slate-600 dark:text-slate-400 shrink-0">
                <Tag size={18} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ประเภทงาน</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                  {log.work_type_code} – {fullLabel}
                </span>
              </div>
            </div>

            {/* Description */}
            {log.description ? (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">รายละเอียด</span>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/50 dark:bg-dark-surface/20 p-4 rounded-2xl border border-slate-200/40 dark:border-white/5">
                  {log.description}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic">ไม่มีรายละเอียดเพิ่มเติม</p>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="space-y-2.5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  รูปภาพแนบ ({images.length} รูป)
                </span>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 bg-black/40 flex items-center justify-center group">
                  <img
                    src={images[activeIdx]}
                    alt={`Attachment ${activeIdx + 1}`}
                    className="max-h-full max-w-full object-contain cursor-zoom-in"
                    onClick={() => setIsFullscreen(true)}
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={handlePrev} className="absolute left-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={handleNext} className="absolute right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all">
                        <ChevronRight size={18} />
                      </button>
                      <div className="absolute bottom-3 flex gap-1.5 justify-center w-full">
                        {images.map((_, i) => (
                          <button key={i} onClick={() => setActiveIdx(i)}
                            className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <button onClick={() => setIsFullscreen(true)} className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all">
                    <Maximize2 size={15} />
                  </button>
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {images.map((url, i) => (
                      <button key={i} onClick={() => setActiveIdx(i)}
                        className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === activeIdx ? 'border-coral scale-105 shadow' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200/40 dark:border-white/5 bg-slate-50/30 dark:bg-dark-surface/10 flex justify-between gap-3">
            <button onClick={() => setIsDeleting(true)}
              className="px-4 py-2.5 rounded-xl border border-red-500/20 text-red-600 hover:bg-red-500/10 text-sm font-semibold flex items-center gap-2 transition-all">
              <Trash2 size={15} /><span>ลบ</span>
            </button>
            <div className="flex gap-3">
              {/* Share dropdown */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setShowShareMenu(p => !p)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border border-slate-300 dark:border-dark-raised text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50"
                >
                  <Share2 size={15} /><span>แชร์</span>
                </button>

                {showShareMenu && (
                  <div className="absolute bottom-full mb-2 right-0 w-52 bg-white dark:bg-dark-raised rounded-2xl shadow-xl border border-slate-200/60 dark:border-white/10 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-100">
                    {/* Facebook */}
                    <button
                      onClick={handleShareFacebook}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#1877F2]/10 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </span>
                      <span>แชร์ไป Facebook</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 mx-3" />

                    {/* Copy text */}
                    <button
                      onClick={handleCopyText}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-dark-muted flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </span>
                      <span>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกข้อความ'}</span>
                    </button>
                  </div>
                )}
              </div>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-dark-raised text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50 transition-colors">
                ปิด
              </button>
              <button onClick={() => { onEdit(log); onClose(); }}
                className="px-5 py-2.5 rounded-xl bg-coral hover:bg-coral/90 text-white text-sm font-semibold flex items-center gap-2 shadow-lg transition-all">
                <Edit3 size={15} /><span>แก้ไข</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      {isDeleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
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
              <button onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold shadow">
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen */}
      {isFullscreen && (
        <div onClick={() => setIsFullscreen(false)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out">
          <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X size={20} />
          </button>
          <img src={images[activeIdx]} alt="fullscreen" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}
