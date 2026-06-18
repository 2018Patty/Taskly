'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Calendar, Clock, Tag, CheckSquare, Plus } from 'lucide-react';
import { Todo } from './task-calendar';
import { uploadTodoImages } from '@/lib/storage';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    title: string;
    description: string;
    date: string;
    start_time: string | null;
    deadline: string;
    status: 'pending' | 'in_progress' | 'completed';
    category: string;
    images: string[];
  }) => Promise<void>;
  task?: Todo; // If provided, we are editing
  preselectedDate?: string; // Preselected deadline date from calendar click
}

const CATEGORIES = ['General', 'Work', 'Personal', 'Urgent', 'Study', 'Shopping', 'Finance', 'บริการวิชาการ'];

export default function TaskModal({ isOpen, onClose, onSave, task, preselectedDate }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [category, setCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Images state
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setNewImageFiles([]);
      setNewImagePreviews([]);
      
      if (task) {
        // Editing mode
        setTitle(task.title);
        setDescription(task.description || '');
        setDate(task.date || new Date().toISOString().split('T')[0]);
        setStartTime(task.start_time ?? '');

        // Format ISO deadline to datetime-local value (YYYY-MM-DDTHH:MM)
        if (task.deadline) {
          const dl = new Date(task.deadline);
          // Adjust to local time string
          const offset = dl.getTimezoneOffset();
          const localTime = new Date(dl.getTime() - offset * 60 * 1000);
          setDeadline(localTime.toISOString().slice(0, 16));
        } else {
          setDeadline('');
        }
        
        setStatus(task.status);
        
        if (CATEGORIES.includes(task.category)) {
          setCategory(task.category);
          setIsCustomCategory(false);
        } else {
          setCategory('Custom');
          setCustomCategory(task.category);
          setIsCustomCategory(true);
        }
        
        setExistingImages(task.images || []);
      } else {
        // Creating mode
        setTitle('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        
        if (preselectedDate) {
          // calendar date selected, set deadline to that date at 12:00
          setDeadline(`${preselectedDate}T12:00`);
        } else {
          setDeadline('');
        }
        
        setStartTime('');
        setStatus('pending');
        setCategory('General');
        setIsCustomCategory(false);
        setCustomCategory('');
        setExistingImages([]);
      }
    }
  }, [isOpen, task, preselectedDate]);

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

  const removeExistingImage = (indexToRemove: number) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const removeNewImage = (indexToRemove: number) => {
    setNewImageFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setNewImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('กรุณากรอกชื่องาน');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      // 1. Upload new images to Supabase storage
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) {
        uploadedUrls = await uploadTodoImages(newImageFiles);
      }

      // 2. Combine remaining existing images and newly uploaded image URLs
      const finalImages = [...existingImages, ...uploadedUrls];

      // 3. Save task
      const finalCategory = isCustomCategory ? customCategory.trim() || 'General' : category;
      
      // format deadline back to ISO standard string
      let formattedDeadline = '';
      if (deadline) {
        formattedDeadline = new Date(deadline).toISOString();
      }

      await onSave({
        title: title.trim(),
        description: description.trim(),
        date,
        start_time: startTime || null,
        deadline: formattedDeadline,
        status,
        category: finalCategory,
        images: finalImages,
      });

      onClose();
    } catch (err: any) {
      console.error('Error saving task:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
            {task ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-coral/60 hover:bg-coral/10 dark:hover:bg-coral/10 hover:text-coral transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left side: title, description, category */}
            <div className="space-y-4 md:col-span-2">
              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                  ชื่องาน *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ระบุชื่องานที่ต้องทำ..."
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                  รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="อธิบายรายละเอียดเกี่ยวกับงานชิ้นนี้..."
                  rows={4}
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>
            </div>

            {/* Date + Start Time */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                <Calendar size={14} /> วันที่และเวลาเริ่มต้น *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
                />
                <div className="relative">
                  <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="ระบุเวลา (ไม่บังคับ)"
                    className="w-full rounded-2xl glass-input pl-9 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Deadline Picker */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                <Clock size={14} /> วันครบกำหนดส่ง (Deadline)
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Status Select */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                <CheckSquare size={14} /> สถานะของงาน
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
              >
                <option value="pending" className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">ยังไม่เริ่ม (Pending)</option>
                <option value="in_progress" className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">กำลังทำ (In Progress)</option>
                <option value="completed" className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">เสร็จสิ้น (Completed)</option>
              </select>
            </div>

            {/* Category Select */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-coral dark:text-blush mb-1.5 uppercase tracking-wider">
                <Tag size={14} /> หมวดหมู่ (Category)
              </label>
              <div className="flex gap-2">
                {!isCustomCategory ? (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === 'Custom') {
                        setIsCustomCategory(true);
                        setCategory('Custom');
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">
                        {cat}
                      </option>
                    ))}
                    <option value="Custom" className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">+ เพิ่มหมวดหมู่เอง</option>
                  </select>
                ) : (
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="เช่น ออกกำลังกาย..."
                      className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCategory('General');
                      }}
                      className="px-3 rounded-2xl glass hover:bg-coral/10 text-coral/60 text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Multi-Image Uploader */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              รูปภาพประกอบ (อัพโหลดได้หลายรูป)
            </label>
            
            {/* Dropzone/Upload Button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blush dark:border-coral/30 hover:border-coral dark:hover:border-coral rounded-2xl p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center gap-2 bg-blush/10 dark:bg-coral/5"
            >
              <Upload className="h-8 w-8 text-coral/60 group-hover:text-coral" />
              <div>
                <p className="text-sm font-semibold text-coral dark:text-blush">
                  คลิกที่นี่เพื่ออัปโหลดรูปภาพ
                </p>
                <p className="text-xs text-coral/50 mt-1">
                  รองรับไฟล์ PNG, JPG, GIF
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Images Previews */}
            {(existingImages.length > 0 || newImagePreviews.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
                {/* Existing Images */}
                {existingImages.map((url, idx) => (
                  <div key={`existing-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                    <img
                      src={url}
                      alt="task attachment"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeExistingImage(idx)}
                        className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1 bg-black/60 text-[9px] text-white rounded">
                      จากเซิร์ฟเวอร์
                    </span>
                  </div>
                ))}

                {/* New Images Previews */}
                {newImagePreviews.map((url, idx) => (
                  <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 group">
                    <img
                      src={url}
                      alt="new upload preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeNewImage(idx)}
                        className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1 bg-coral text-[9px] text-white rounded">
                      ยังไม่อัพโหลด
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
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
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>บันทึกงาน</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
