'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, Image, ImageOff, Loader2 } from 'lucide-react';
import type { Todo } from './task-calendar';
import type { WorkLog } from '@/lib/worklog-types';
import {
  exportTodoToWord, exportTodoToExcel,
  exportWorklogToWord, exportWorklogToExcel,
} from '@/lib/export-utils';

type TodoExportProps = {
  type: 'todo';
  todos: Todo[];
};

type WorklogExportProps = {
  type: 'worklog';
  logs: WorkLog[];
  period: string;
};

type Props = (TodoExportProps | WorklogExportProps) & {
  className?: string;
};

type ExportOption = {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
};

const OPTIONS: ExportOption[] = [
  {
    id: 'word-with-images',
    icon: <Image size={15} />,
    label: 'Word (.docx)',
    sublabel: 'รวมรูปภาพ',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'word-no-images',
    icon: <ImageOff size={15} />,
    label: 'Word (.docx)',
    sublabel: 'ไม่มีรูปภาพ',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'excel',
    icon: <FileSpreadsheet size={15} />,
    label: 'Excel (.xlsx)',
    sublabel: 'ตารางสรุปรายการ',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
];

export default function ExportMenu(props: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (optId: string) => {
    setOpen(false);
    setLoading(optId);
    try {
      if (props.type === 'todo') {
        if (optId === 'excel')           await exportTodoToExcel(props.todos);
        else if (optId === 'word-with-images') await exportTodoToWord(props.todos, true);
        else                             await exportTodoToWord(props.todos, false);
      } else {
        if (optId === 'excel')           await exportWorklogToExcel(props.logs, props.period);
        else if (optId === 'word-with-images') await exportWorklogToWord(props.logs, props.period, true);
        else                             await exportWorklogToWord(props.logs, props.period, false);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className={`relative ${props.className ?? ''}`} ref={ref}>
      <button
        onClick={() => !isLoading && setOpen(p => !p)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300/60 dark:border-white/15 bg-white/70 dark:bg-dark-surface/70 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-dark-raised/70 hover:border-slate-400/60 dark:hover:border-white/25 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading
          ? <Loader2 size={15} className="animate-spin text-coral shrink-0"/>
          : <Download size={15} className="text-coral shrink-0"/>}
        <span>{isLoading ? 'กำลัง Export...' : 'Export'}</span>
        {!isLoading && <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`}/>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-dark-raised rounded-2xl shadow-xl border border-slate-200/60 dark:border-white/10 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-dark-surface/40">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={11}/> เลือกรูปแบบการ Export
            </p>
          </div>
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left border-b border-slate-100/60 dark:border-white/5 last:border-0"
            >
              <span className={`${opt.color} shrink-0 group-hover:scale-110 transition-transform`}>
                {opt.id === 'excel'
                  ? <FileSpreadsheet size={16}/>
                  : <FileText size={16}/>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{opt.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                  {opt.icon}
                  {opt.sublabel}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
