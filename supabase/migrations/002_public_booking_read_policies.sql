-- AZTEC IT INSTITUTE: fix student booking catalog visibility
-- Run this once in Supabase SQL Editor if 001_initial.sql was already applied.

alter table courses enable row level security;
alter table instructors enable row level security;
alter table instructor_courses enable row level security;
alter table instructor_schedules enable row level security;

drop policy if exists public_active_courses on courses;
create policy public_active_courses on courses
for select to anon, authenticated
using (active=true);

drop policy if exists public_active_instructors on instructors;
create policy public_active_instructors on instructors
for select to anon, authenticated
using (active=true);

drop policy if exists public_active_instructor_courses on instructor_courses;
create policy public_active_instructor_courses on instructor_courses
for select to anon, authenticated
using (
  exists (select 1 from instructors i where i.id=instructor_courses.instructor_id and i.active=true)
  and exists (select 1 from courses c where c.id=instructor_courses.course_id and c.active=true)
);

drop policy if exists public_active_schedules on instructor_schedules;
create policy public_active_schedules on instructor_schedules
for select to anon, authenticated
using (active=true);

-- Verify the public booking catalog after running this migration:
-- select course_code, name from courses where active=true order by name;
