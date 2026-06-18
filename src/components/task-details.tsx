'use client';

import React, { useState } from 'react';
import { X, Calendar, Clock, Tag, CheckSquare, Trash2, Edit3, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { getCategoryColor } from '@/lib/category-colors';
import { Todo } from './task-calendar';

interface TaskDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  task: Todo | null;
  onEdit: (task: Todo) => void;
  onDelete: (taskId: string, imageUrls: string[]) => void;
}

export default function TaskDetails({ isOpen, onClose, task, onEdit, onDelete }: TaskDetailsProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !task) return null;

  const images = task.images || [];

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Format Dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return 'ไม่มีกำหนดส่ง';
    const d = new Date(dateStr);
    const dateText = d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeText = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
    return `${dateText} เวลา ${timeText}`;
  };

  // Check if deadline is overdue
  const isOverdue = () => {
    if (!task.deadline || task.status === 'completed') return false;
    return new Date(task.deadline) < new Date();
  };

  // Calculate remaining days
  const getDeadlineStatusText = () => {
    if (!task.deadline) return null;
    if (task.status === 'completed') return 'งานเสร็จสมบูรณ์';
    
    const now = new Date();
    const deadline = new Date(task.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    
    if (diffTime < 0) {
      return 'เลยกำหนดส่งแล้ว';
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      return 'ครบกำหนดส่งพรุ่งนี้!';
    }
    return `เหลือเวลาอีก ${diffDays} วัน`;
  };

  // Status Styles
  const getStatusBadge = () => {
    switch (task.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            เสร็จสิ้น (Completed)
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            กำลังทำ (In Progress)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            ยังไม่เริ่ม (Pending)
          </span>
        );
    }
  };

  const handleDeleteClick = () => {
    setIsDeleting(true);
  };

  const confirmDelete = () => {
    onDelete(task.id, task.images || []);
    setIsDeleting(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white dark:bg-dark-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-dark-muted overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200/40 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCategoryColor(task.category)}`}>
                {task.category}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/50 dark:hover:bg-dark-raised/50 hover:text-slate-800 dark:hover:text-white transition-colors duration-200"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-6">
            
            {/* Title & Description */}
            <div className="space-y-3">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {task.title}
              </h2>
              {task.description ? (
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/50 dark:bg-dark-surface/20 p-4 rounded-2xl border border-slate-200/40 dark:border-white/5">
                  {task.description}
                </p>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm italic">
                  ไม่มีรายละเอียดเพิ่มเติม
                </p>
              )}
            </div>

            {/* Dates Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50/50 dark:bg-dark-surface/20 border border-slate-200/40 dark:border-white/5">
                <div className="p-2.5 rounded-xl bg-slate-200/50 dark:bg-dark-raised text-slate-600 dark:text-slate-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">วันที่เริ่มบันทึก</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDate(task.date)}</span>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${
                isOverdue() 
                  ? 'bg-rose-500/10 border-rose-500/20' 
                  : 'bg-slate-50/50 dark:bg-dark-surface/20 border-slate-200/40 dark:border-white/5'
              }`}>
                <div className={`p-2.5 rounded-xl ${
                  isOverdue() ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-200/50 dark:bg-dark-raised text-slate-600 dark:text-slate-400'
                }`}>
                  <Clock size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">วันครบกำหนด (Deadline)</span>
                  <span className={`text-sm font-semibold ${isOverdue() ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {formatDeadline(task.deadline)}
                  </span>
                  {getDeadlineStatusText() && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      isOverdue() ? 'text-rose-500' : 'text-coral dark:text-blush'
                    }`}>
                      {getDeadlineStatusText()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Images Carousel Section */}
            {images.length > 0 && (
              <div className="space-y-2.5">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  รูปภาพแนบ ({images.length} รูป)
                </span>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-250 dark:border-white/5 bg-slate-950/40 flex items-center justify-center group">
                  <img
                    src={images[activeImageIdx]}
                    alt={`Attachment ${activeImageIdx + 1}`}
                    className="max-h-full max-w-full object-contain cursor-zoom-in"
                    onClick={() => setIsFullscreenImage(true)}
                  />
                  
                  {/* Prev/Next Buttons */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}

                  {/* Maximize Button */}
                  <button
                    onClick={() => setIsFullscreenImage(true)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100"
                    title="ขยายรูป"
                  >
                    <Maximize2 size={16} />
                  </button>

                  {/* Bullet indicators */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 flex gap-1.5 justify-center w-full">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIdx(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === activeImageIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Thumbnails list */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {images.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                          idx === activeImageIdx ? 'border-coral scale-105 shadow' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-200/40 dark:border-white/5 bg-slate-50/30 dark:bg-dark-surface/10 flex justify-between gap-3">
            <button
              onClick={handleDeleteClick}
              className="px-4 py-2.5 rounded-xl border border-red-500/20 text-red-600 hover:bg-red-500/10 text-sm font-semibold flex items-center gap-2 transition-all duration-200"
            >
              <Trash2 size={16} />
              <span>ลบงาน</span>
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-dark-raised text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50 transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  onEdit(task);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-coral hover:bg-coral/90 text-white text-sm font-semibold flex items-center gap-2 shadow-lg transition-all duration-200"
              >
                <Edit3 size={16} />
                <span>แก้ไขงาน</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="glass w-full max-w-sm rounded-2xl border border-white/20 dark:border-white/5 p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-100">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">ยืนยันการลบงาน?</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              คุณแน่ใจหรือไม่ที่จะลบงาน <strong className="text-slate-800 dark:text-white">"{task.title}"</strong>? ข้อมูลรูปภาพทั้งหมดจะถูกลบออกและไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDeleting(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-dark-raised text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-raised/50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold shadow"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Overlay */}
      {isFullscreenImage && (
        <div
          onClick={() => setIsFullscreenImage(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
        >
          <button
            onClick={() => setIsFullscreenImage(false)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl"
          >
            <X size={20} />
          </button>
          <img
            src={images[activeImageIdx]}
            alt="fullscreen attachment"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
