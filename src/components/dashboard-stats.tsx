'use client';

import React from 'react';
import { Todo } from './task-calendar';

interface DashboardStatsProps {
  todos: Todo[];
  categoryFilter: string;
  onCategoryClick: (category: string) => void;
}

const CATEGORY_HEX: Record<string, string> = {
  General:          '#91adc6',
  Work:             '#ed6956',
  Personal:         '#fbbd4c',
  Urgent:           '#ed6956',
  Study:            '#97c0c0',
  Shopping:         '#fbbd4c',
  Finance:          '#91adc6',
  'บริการวิชาการ': '#97c0c0',
};
const HEX_CYCLE = ['#ed6956', '#fbbd4c', '#91adc6', '#97c0c0'];

function hashIndex(str: string, len: number): number {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % len;
  return h;
}

function getCategoryHex(category: string): string {
  return CATEGORY_HEX[category] ?? HEX_CYCLE[hashIndex(category, HEX_CYCLE.length)];
}

function CategoryDonut({ categories }: { categories: { name: string; count: number }[] }) {
  const total = categories.reduce((s, c) => s + c.count, 0);
  const cx = 100, cy = 100, r = 82, inner = 50;

  if (total === 0) {
    return (
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={(r + inner) / 2} fill="none" stroke="#e2e8f0" strokeWidth={r - inner} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fill="#94a3b8">ว่าง</text>
      </svg>
    );
  }

  const segs = categories.filter(c => c.count > 0).map(c => ({
    color: getCategoryHex(c.name),
    value: c.count,
  }));

  let angle = -Math.PI / 2;
  const paths = segs.map((seg, i) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const sa = angle;
    angle += sweep;
    const ea = angle;

    if (segs.length === 1) {
      const mid = (r + inner) / 2;
      return <circle key={i} cx={cx} cy={cy} r={mid} fill="none" stroke={seg.color} strokeWidth={r - inner} />;
    }

    const x1  = cx + r     * Math.cos(sa), y1  = cy + r     * Math.sin(sa);
    const x2  = cx + r     * Math.cos(ea), y2  = cy + r     * Math.sin(ea);
    const ix1 = cx + inner * Math.cos(ea), iy1 = cy + inner * Math.sin(ea);
    const ix2 = cx + inner * Math.cos(sa), iy2 = cy + inner * Math.sin(sa);
    const lg  = sweep > Math.PI ? 1 : 0;
    const d   = `M${x1},${y1} A${r},${r},0,${lg},1,${x2},${y2} L${ix1},${iy1} A${inner},${inner},0,${lg},0,${ix2},${iy2} Z`;

    return <path key={i} d={d} fill={seg.color} />;
  });

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {paths}
      <text x={cx} y={cy + 4}  textAnchor="middle" fontSize="22" fontWeight="bold" fill="#475569">{total}</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11"  fill="#94a3b8">งานทั้งหมด</text>
    </svg>
  );
}

export default function DashboardStats({ todos }: DashboardStatsProps) {
  const total      = todos.length;
  const pending    = todos.filter(t => t.status === 'pending').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const completed  = todos.filter(t => t.status === 'completed').length;

  const categoryCounts = todos.reduce<Record<string, number>>((acc, todo) => {
    const cat = todo.category || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const statusRows = [
    { label: 'ยังไม่เริ่ม', count: pending,    dot: 'bg-steel', bar: 'bg-steel' },
    { label: 'กำลังทำ',     count: inProgress, dot: 'bg-honey', bar: 'bg-honey' },
    { label: 'เสร็จสิ้น',   count: completed,  dot: 'bg-mint',  bar: 'bg-mint'  },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5">

      {/* Status summary — white card with progress bars */}
      <div className="flex-1 bg-white dark:bg-dark-surface rounded-3xl shadow-lg p-6 flex flex-col gap-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">สรุปสถานะงาน</h3>

        <div className="flex flex-col gap-5">
          {statusRows.map(row => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <div key={row.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{row.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-white tabular-nums">{row.count}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-dark-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full ${row.bar} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-dark-raised flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-600">รวมทั้งหมด</span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{total} งาน</span>
        </div>
      </div>

      {/* Category donut chart */}
      <div className="lg:w-96 bg-white dark:bg-dark-surface rounded-3xl shadow-lg p-5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">สัดส่วนตามประเภทงาน</h3>

        {categories.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">ยังไม่มีงาน</div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <CategoryDonut categories={categories} />
            </div>
            <div className="space-y-3 flex-1 min-w-0">
              {categories.map(cat => (
                <div key={cat.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCategoryHex(cat.name) }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 leading-none truncate">{cat.name}</span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
