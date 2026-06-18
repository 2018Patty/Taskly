'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle, HelpCircle } from 'lucide-react';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  start_time: string | null;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
  category: string;
  images: string[];
  created_at: string;
}

interface TaskCalendarProps {
  todos: Todo[];
  onSelectTask: (todo: Todo) => void;
  onAddOnDate: (dateString: string) => void;
}

export default function TaskCalendar({ todos, onSelectTask, onAddOnDate }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Get first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get total days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (dayNum: number) => {
    return (
      dayNum === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Generate calendar days
  const calendarDays = [];

  // Add padding days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthTotalDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthTotalDays - i)
    });
  }

  // Add days of current month
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i)
    });
  }

  // Add padding days for next month to complete the grid (multiples of 7)
  const remainingCells = 42 - calendarDays.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  // Filter tasks that have deadline on a specific date
  const getTasksForDate = (date: Date) => {
    return todos.filter(todo => {
      if (!todo.deadline) return false;
      const todoDeadline = new Date(todo.deadline);
      return (
        todoDeadline.getDate() === date.getDate() &&
        todoDeadline.getMonth() === date.getMonth() &&
        todoDeadline.getFullYear() === date.getFullYear()
      );
    });
  };

  const formatLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const weekdays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  return (
    <div className="glass rounded-3xl p-6 shadow-xl w-full border border-white/20 dark:border-white/5 transition-all duration-300">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-coral/10 text-coral dark:text-honey">
            <CalendarIcon size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {monthNames[month]} {year + 543}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              คลิกที่วันเพื่อเพิ่มงานใหม่
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl glass hover:bg-slate-200/50 dark:hover:bg-dark-raised/50 text-slate-600 dark:text-slate-300 transition-all duration-200"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl glass hover:bg-slate-200/50 dark:hover:bg-dark-raised/50 text-slate-600 dark:text-slate-300 transition-all duration-200"
          >
            วันนี้
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl glass hover:bg-slate-200/50 dark:hover:bg-dark-raised/50 text-slate-600 dark:text-slate-300 transition-all duration-200"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
        {weekdays.map((day, idx) => (
          <div key={idx} className="py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((cell, idx) => {
          const dateTasks = getTasksForDate(cell.date);
          const isCellToday = isToday(cell.day) && cell.isCurrentMonth;

          return (
            <div
              key={idx}
              className={`min-h-[100px] flex flex-col justify-between p-2 rounded-2xl transition-all duration-200 border group ${
                cell.isCurrentMonth
                  ? 'bg-white/30 dark:bg-dark-surface/20 hover:bg-white/60 dark:hover:bg-dark-raised/30 cursor-pointer border-slate-200/40 dark:border-white/5'
                  : 'bg-slate-100/10 dark:bg-dark-base/10 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed opacity-50'
              } ${isCellToday ? 'ring-2 ring-coral ring-offset-2 dark:ring-offset-dark-base' : ''}`}
              onClick={() => {
                if (cell.isCurrentMonth) {
                  onAddOnDate(formatLocalDateString(cell.date));
                }
              }}
            >
              {/* Day Number */}
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-xs font-bold flex items-center justify-center h-6 w-6 rounded-full ${
                    isCellToday
                      ? 'bg-coral text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cell.day}
                </span>
                {cell.isCurrentMonth && (
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    + เพิ่ม
                  </span>
                )}
              </div>

              {/* Day Tasks */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[70px] no-scrollbar">
                {dateTasks.map(task => {
                  let statusColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                  let StatusIcon = Clock;

                  if (task.status === 'in_progress') {
                    statusColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                  } else if (task.status === 'completed') {
                    statusColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    StatusIcon = CheckCircle;
                  }

                  return (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation(); // prevent triggering day click
                        onSelectTask(task);
                      }}
                      className={`text-[10px] font-semibold p-1 px-1.5 rounded-lg border truncate flex items-center gap-1 hover:scale-105 transition-transform duration-100 ${statusColor}`}
                      title={task.title}
                    >
                      <StatusIcon size={10} className="shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
