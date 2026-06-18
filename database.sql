-- 1. สร้างตาราง todos
create table if not exists public.todos (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null,
    description text,
    date date not null default current_date,
    start_time text,
    deadline timestamp with time zone,
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
    category text default 'General',
    images text[] not null default '{}'::text[],
    created_at timestamp with time zone not null default now()
);

-- 2. เปิดใช้งาน Row Level Security (RLS) สำหรับตาราง todos
alter table public.todos enable row level security;

-- 3. สร้างนโยบายความปลอดภัย (Policies) สำหรับ todos
-- ให้ผู้ใช้อ่านข้อมูลของตัวเองได้เท่านั้น
create policy "Users can read their own todos" 
on public.todos for select 
using (auth.uid() = user_id);

-- ให้ผู้ใช้เพิ่มข้อมูลของตัวเองได้เท่านั้น
create policy "Users can insert their own todos" 
on public.todos for insert 
with check (auth.uid() = user_id);

-- ให้ผู้ใช้อัปเดตข้อมูลของตัวเองได้เท่านั้น
create policy "Users can update their own todos" 
on public.todos for update 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ให้ผู้ใช้ลบข้อมูลของตัวเองได้เท่านั้น
create policy "Users can delete their own todos" 
on public.todos for delete 
using (auth.uid() = user_id);


-- 4. ตั้งค่า Storage Bucket สำหรับจัดเก็บรูปภาพของ Todo List
-- สร้าง bucket ชื่อ 'todo-images' (หากยังไม่มี)
insert into storage.buckets (id, name, public)
values ('todo-images', 'todo-images', true)
on conflict (id) do nothing;

-- 5. สร้างนโยบายความปลอดภัย (Policies) สำหรับ Storage
-- ให้บุคคลทั่วไปสามารถดึงรูปภาพไปแสดงผลได้ (Read Access)
create policy "Public Access to images"
on storage.objects for select
using (bucket_id = 'todo-images');

-- ให้ผู้ใช้ที่ล็อกอินแล้วสามารถอัปโหลดรูปภาพได้ (Upload Access)
create policy "Authenticated users can upload images"
on storage.objects for insert
with check (bucket_id = 'todo-images' and auth.role() = 'authenticated');

-- ให้ผู้ใช้ที่ล็อกอินแล้วสามารถลบรูปภาพของตนเองได้ (Delete Access)
create policy "Authenticated users can delete images"
on storage.objects for delete
using (bucket_id = 'todo-images' and auth.role() = 'authenticated');


-- ============================================================
-- ตาราง work_logs สำหรับบันทึกภาระงาน
-- ============================================================

create table if not exists public.work_logs (
  id           uuid                     default gen_random_uuid() primary key,
  user_id      uuid                     not null default auth.uid() references auth.users(id) on delete cascade,
  work_date    date                     not null default current_date,
  title        text                     not null,
  description  text,
  start_time   time                     not null,
  end_time     time                     not null,
  work_type_code text                   not null,
  work_type_role text,
  images       text[]                   not null default '{}'::text[],
  created_at   timestamp with time zone not null default now()
);

alter table public.work_logs enable row level security;

create policy "Users can read their own work_logs"
  on public.work_logs for select using (auth.uid() = user_id);

create policy "Users can insert their own work_logs"
  on public.work_logs for insert with check (auth.uid() = user_id);

create policy "Users can update their own work_logs"
  on public.work_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own work_logs"
  on public.work_logs for delete using (auth.uid() = user_id);

-- ============================================================
-- รัน SQL ด้านล่างนี้ใน Supabase SQL Editor เพื่อเปิดใช้การแชร์ Facebook
-- ============================================================

-- เพิ่ม column exclude_lunch ถ้ายังไม่มี
alter table public.work_logs
  add column if not exists exclude_lunch boolean not null default false;

-- ฟังก์ชันสำหรับดึงข้อมูล worklog เพื่อสร้าง Open Graph meta tags
-- ทำงานด้วย SECURITY DEFINER (รันในสิทธิ์ postgres) จึงข้าม RLS ได้
-- anon role จะเรียกฟังก์ชันนี้เพื่อสร้าง OG tags โดยไม่ต้องเปิด public read บนตาราง
create or replace function get_worklog_share_data(p_id uuid)
returns table (
  id             uuid,
  title          text,
  description    text,
  images         text[],
  work_date      text,
  work_type_code text,
  work_type_role text,
  start_time     text,
  end_time       text,
  exclude_lunch  boolean
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    title,
    description,
    images,
    work_date::text,
    work_type_code,
    work_type_role,
    start_time::text,
    end_time::text,
    coalesce(exclude_lunch, false)
  from work_logs
  where id = p_id;
$$;

-- อนุญาตให้ anon role เรียกใช้ฟังก์ชันนี้ได้
grant execute on function get_worklog_share_data(uuid) to anon;
