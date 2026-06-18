// Badge colors (for task details / small tags)
const CATEGORY_COLORS: Record<string, string> = {
  General:  'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/40 border-slate-300/40 dark:border-slate-600/30',
  Work:     'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-300/40 dark:border-blue-700/30',
  Personal: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 border-violet-300/40 dark:border-violet-700/30',
  Urgent:   'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300/40 dark:border-red-700/30',
  Study:    'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300/40 dark:border-emerald-700/30',
  Shopping: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300/40 dark:border-orange-700/30',
  Finance:         'text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300/40 dark:border-yellow-700/30',
  'บริการวิชาการ': 'text-mint dark:text-mint bg-mint/10 dark:bg-mint/10 border-mint/30',
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'text-coral dark:text-blush bg-coral/10 dark:bg-coral/10 border-coral/20';
}

// Card background colors (brand palette)
const CATEGORY_BG_MAP: Record<string, string> = {
  General:  'bg-steel',
  Work:     'bg-coral',
  Personal: 'bg-honey',
  Urgent:   'bg-coral',
  Study:    'bg-mint',
  Shopping: 'bg-honey',
  Finance:         'bg-steel',
  'บริการวิชาการ': 'bg-mint',
};

const CATEGORY_SHADOW_MAP: Record<string, string> = {
  General:  'shadow-steel/30',
  Work:     'shadow-coral/30',
  Personal: 'shadow-honey/30',
  Urgent:   'shadow-coral/30',
  Study:    'shadow-mint/30',
  Shopping: 'shadow-honey/30',
  Finance:         'shadow-steel/30',
  'บริการวิชาการ': 'shadow-mint/30',
};

const BG_CYCLE     = ['bg-coral', 'bg-honey', 'bg-steel', 'bg-mint'];
const SHADOW_CYCLE = ['shadow-coral/30', 'shadow-honey/30', 'shadow-steel/30', 'shadow-mint/30'];

// coral เป็นสีเดียวที่เข้มพอสำหรับตัวอักษรสีขาว
const DARK_BACKGROUNDS = new Set(['bg-coral']);

function hashIndex(str: string, len: number): number {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % len;
  return h;
}

export function getCategoryBg(category: string): string {
  return CATEGORY_BG_MAP[category] ?? BG_CYCLE[hashIndex(category, BG_CYCLE.length)];
}

export function getCategoryShadow(category: string): string {
  return CATEGORY_SHADOW_MAP[category] ?? SHADOW_CYCLE[hashIndex(category, SHADOW_CYCLE.length)];
}

export function isCategoryDarkBg(category: string): boolean {
  return DARK_BACKGROUNDS.has(getCategoryBg(category));
}
