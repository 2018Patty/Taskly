import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import WorklogDetailClient from './WorklogDetailClient';
import {
  calcHours, formatHours, formatThaiDate,
  getWorkTypeFullLabel, getWorkTypeMainCode,
} from '@/lib/worklog-types';

type Props = { params: Promise<{ id: string }> };

/* ── server-side Supabase (anon key — uses SECURITY DEFINER rpc, no public RLS needed) ── */
function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/* ── Open Graph meta tags — read by Facebook crawler ── */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = makeSupabase();

  // SECURITY DEFINER function — bypasses RLS so anon key can read data
  const { data: rows } = await supabase.rpc('get_worklog_share_data', { p_id: id });
  const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

  if (!data) {
    return {
      title: 'บันทึกภาระงาน | Taskly',
      description: 'Taskly — ระบบบันทึกภาระงาน',
    };
  }

  const mainCode  = getWorkTypeMainCode(data.work_type_code);
  const mainLabel = mainCode === '1' ? 'การเรียนการสอน' : mainCode === '3' ? 'บริการวิชาการ' : 'ภาระงานอื่น ๆ';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullLabel = getWorkTypeFullLabel(data as any);
  const hours     = calcHours(data.start_time, data.end_time, data.exclude_lunch);
  const images: string[] = data.images ?? [];

  const description = [
    `📅 ${formatThaiDate(data.work_date)}`,
    `⏱ ${data.start_time.slice(0, 5)} – ${data.end_time.slice(0, 5)} น. (${formatHours(hours)})`,
    `🏷 ${data.work_type_code} ${mainLabel} – ${fullLabel}`,
    data.description ? `\n${data.description}` : '',
  ].filter(Boolean).join('  ');

  return {
    title: `${data.title} | Taskly`,
    description,
    openGraph: {
      title: data.title,
      description,
      siteName: 'Taskly',
      type: 'article',
      images: images.length > 0
        ? [{ url: images[0], width: 1200, height: 630, alt: data.title }]
        : [],
    },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title: data.title,
      description,
      images: images.length > 0 ? [images[0]] : [],
    },
  };
}

/* ── Page ── */
export default async function WorklogDetailPage({ params }: Props) {
  const { id } = await params;
  return <WorklogDetailClient id={id} />;
}
