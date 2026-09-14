create extension if not exists pgcrypto;

create sequence if not exists student_public_seq start 1;

create table if not exists students (
 id uuid primary key default gen_random_uuid(),
 student_code text unique not null default ('STU-'||lpad(nextval('student_public_seq')::text,6,'0')),
 name text not null check (char_length(trim(name)) between 2 and 120),
 phone text unique not null check (phone ~ '^03[0-9]{9}$'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists courses (
 id uuid primary key default gen_random_uuid(),
 course_code text unique not null check (course_code ~ '^[A-Z0-9-]{2,20}$'),
 name text unique not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists instructors (
 id uuid primary key default gen_random_uuid(),
 instructor_code text unique not null default ('INS-'||lpad((floor(extract(epoch from clock_timestamp())*1000)::bigint % 1000000)::text,6,'0')),
 name text not null,
 email text unique not null,
 phone text,
 profile_image text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists instructor_courses (
 instructor_id uuid not null references instructors(id) on delete cascade,
 course_id uuid not null references courses(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(instructor_id,course_id)
);

create table if not exists instructor_schedules (
 id uuid primary key default gen_random_uuid(),
 instructor_id uuid not null references instructors(id) on delete cascade,
 course_id uuid not null references courses(id) on delete cascade,
 mode text not null check(mode in ('Online','Physical')),
 day_of_week smallint not null check(day_of_week between 0 and 6),
 start_time time not null,
 end_time time not null,
 slot_duration_minutes integer not null check(slot_duration_minutes between 15 and 240),
 active boolean not null default true,
 check(end_time>start_time)
);

create table if not exists blocked_slots (
 id uuid primary key default gen_random_uuid(),
 instructor_id uuid not null references instructors(id) on delete cascade,
 demo_date date not null,
 start_time time not null,
 end_time time not null,
 reason text,
 created_at timestamptz not null default now(),
 check(end_time>start_time)
);

create sequence if not exists demo_booking_global_seq start 1;
create table if not exists demo_bookings (
 id uuid primary key default gen_random_uuid(),
 booking_code text unique not null,
 student_id uuid not null references students(id),
 course_id uuid not null references courses(id),
 instructor_id uuid not null references instructors(id),
 student_code text not null,
 student_name text not null,
 student_phone text not null,
 course_code text not null,
 course_name text not null,
 instructor_name text not null,
 instructor_email text not null,
 mode text not null check(mode in ('Online','Physical')),
 demo_date date not null,
 start_time time not null,
 end_time time not null,
 status text not null default 'Confirmed' check(status in ('Confirmed','Completed','Cancelled','No Show')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index if not exists demo_active_slot_unique on demo_bookings(instructor_id,demo_date,start_time) where status='Confirmed';
create index if not exists demo_date_idx on demo_bookings(demo_date);
create index if not exists demo_student_idx on demo_bookings(student_id);
create index if not exists demo_instructor_idx on demo_bookings(instructor_id);
create index if not exists student_phone_idx on students(phone);

create table if not exists email_notifications (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references demo_bookings(id) on delete cascade,
 recipient_email text not null,
 subject text not null,
 status text not null check(status in ('pending','sent','failed')),
 provider_message_id text,
 error_message text,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists export_logs (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid,
 export_type text not null,
 filters jsonb,
 created_at timestamptz not null default now()
);
create table if not exists settings (
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean language sql stable as $$
 select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false);
$$;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists students_updated on students; create trigger students_updated before update on students for each row execute function set_updated_at();
drop trigger if exists courses_updated on courses; create trigger courses_updated before update on courses for each row execute function set_updated_at();
drop trigger if exists instructors_updated on instructors; create trigger instructors_updated before update on instructors for each row execute function set_updated_at();
drop trigger if exists bookings_updated on demo_bookings; create trigger bookings_updated before update on demo_bookings for each row execute function set_updated_at();

alter table students enable row level security; alter table courses enable row level security; alter table instructors enable row level security; alter table instructor_courses enable row level security; alter table instructor_schedules enable row level security; alter table blocked_slots enable row level security; alter table demo_bookings enable row level security; alter table email_notifications enable row level security; alter table export_logs enable row level security; alter table settings enable row level security;

drop policy if exists admin_students on students; create policy admin_students on students for all using(is_admin()) with check(is_admin());
drop policy if exists admin_courses on courses; create policy admin_courses on courses for all using(is_admin()) with check(is_admin());
drop policy if exists admin_instructors on instructors; create policy admin_instructors on instructors for all using(is_admin()) with check(is_admin());
drop policy if exists admin_ic on instructor_courses; create policy admin_ic on instructor_courses for all using(is_admin()) with check(is_admin());
drop policy if exists admin_sched on instructor_schedules; create policy admin_sched on instructor_schedules for all using(is_admin()) with check(is_admin());
drop policy if exists admin_blocks on blocked_slots; create policy admin_blocks on blocked_slots for all using(is_admin()) with check(is_admin());
drop policy if exists admin_bookings on demo_bookings; create policy admin_bookings on demo_bookings for all using(is_admin()) with check(is_admin());
drop policy if exists admin_email on email_notifications; create policy admin_email on email_notifications for all using(is_admin()) with check(is_admin());
drop policy if exists admin_exports on export_logs; create policy admin_exports on export_logs for all using(is_admin()) with check(is_admin());
drop policy if exists admin_settings on settings; create policy admin_settings on settings for all using(is_admin()) with check(is_admin());

-- Public read policies required by the student booking flow.
-- Students may only read active catalog/assignment/schedule records needed for booking.
drop policy if exists public_active_courses on courses;
create policy public_active_courses on courses for select to anon, authenticated using (active=true);

drop policy if exists public_active_instructors on instructors;
create policy public_active_instructors on instructors for select to anon, authenticated using (active=true);

drop policy if exists public_active_instructor_courses on instructor_courses;
create policy public_active_instructor_courses on instructor_courses for select to anon, authenticated
using (exists (select 1 from instructors i where i.id=instructor_courses.instructor_id and i.active=true)
   and exists (select 1 from courses c where c.id=instructor_courses.course_id and c.active=true));

-- Schedule rows are not directly exposed by the student UI, but allowing active rows
-- keeps future schedule/calendar queries safe for authenticated/anonymous students.
drop policy if exists public_active_schedules on instructor_schedules;
create policy public_active_schedules on instructor_schedules for select to anon, authenticated using (active=true);

create or replace function find_student_by_phone(p_phone text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s students;
begin select * into s from students where phone=p_phone and active=true limit 1; if not found then return null; end if; return to_jsonb(s); end; $$;
revoke all on function find_student_by_phone(text) from public; grant execute on function find_student_by_phone(text) to anon,authenticated;

create or replace function register_student(p_name text,p_phone text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s students;
begin
 insert into students(name,phone) values(trim(p_name),p_phone) on conflict(phone) do update set name=students.name returning * into s;
 return to_jsonb(s);
end; $$;
revoke all on function register_student(text,text) from public; grant execute on function register_student(text,text) to anon,authenticated;

create or replace function get_available_demo_slots(p_instructor_id uuid,p_course_id uuid,p_mode text,p_date date) returns table(start text,end_time text,available boolean) language plpgsql security definer set search_path=public as $$
declare sch instructor_schedules; t time; dow int;
begin
 dow:=extract(dow from p_date);
 select * into sch from instructor_schedules where instructor_id=p_instructor_id and course_id=p_course_id and mode=p_mode and day_of_week=dow and active=true limit 1;
 if not found then return; end if;
 t:=sch.start_time;
 while t + make_interval(mins=>sch.slot_duration_minutes) <= sch.end_time loop
  start:=to_char(t,'HH24:MI'); end_time:=to_char(t+make_interval(mins=>sch.slot_duration_minutes),'HH24:MI');
  available:=not exists(select 1 from demo_bookings b where b.instructor_id=p_instructor_id and b.demo_date=p_date and b.start_time=t and b.status='Confirmed')
   and not exists(select 1 from blocked_slots x where x.instructor_id=p_instructor_id and x.demo_date=p_date and x.start_time < t+make_interval(mins=>sch.slot_duration_minutes) and x.end_time>t);
  return next; t:=t+make_interval(mins=>sch.slot_duration_minutes);
 end loop;
end; $$;
revoke all on function get_available_demo_slots(uuid,uuid,text,date) from public; grant execute on function get_available_demo_slots(uuid,uuid,text,date) to anon,authenticated;

create or replace function create_demo_booking(p_student_id uuid,p_course_id uuid,p_instructor_id uuid,p_mode text,p_demo_date date,p_start_time time) returns jsonb language plpgsql security definer set search_path=public as $$
declare s students; c courses; i instructors; sch instructor_schedules; b demo_bookings; p_end time; seq bigint; code text;
begin
 if p_demo_date<current_date then raise exception 'PAST_DATE'; end if;
 select * into s from students where id=p_student_id and active=true; if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
 select * into c from courses where id=p_course_id and active=true; if not found then raise exception 'COURSE_NOT_FOUND'; end if;
 select * into i from instructors where id=p_instructor_id and active=true; if not found then raise exception 'INSTRUCTOR_NOT_FOUND'; end if;
 if not exists(select 1 from instructor_courses where instructor_id=i.id and course_id=c.id) then raise exception 'INSTRUCTOR_NOT_ASSIGNED'; end if;
 select * into sch from instructor_schedules where instructor_id=i.id and course_id=c.id and mode=p_mode and day_of_week=extract(dow from p_demo_date) and active=true limit 1;
 if not found then raise exception 'SLOT_UNAVAILABLE'; end if;
 p_end:=p_start_time+make_interval(mins=>sch.slot_duration_minutes);
 if p_start_time<sch.start_time or p_end>sch.end_time then raise exception 'SLOT_UNAVAILABLE'; end if;
 if exists(select 1 from blocked_slots x where x.instructor_id=i.id and x.demo_date=p_demo_date and x.start_time<p_end and x.end_time>p_start_time) then raise exception 'SLOT_BLOCKED'; end if;
 if exists(select 1 from demo_bookings x where x.instructor_id=i.id and x.demo_date=p_demo_date and x.start_time=p_start_time and x.status='Confirmed') then raise exception 'BOOKED'; end if;
 seq:=nextval('demo_booking_global_seq'); code:='DEMO-'||c.course_code||'-'||to_char(p_demo_date,'YYYY')||'-'||lpad(seq::text,6,'0');
 insert into demo_bookings(booking_code,student_id,course_id,instructor_id,student_code,student_name,student_phone,course_code,course_name,instructor_name,instructor_email,mode,demo_date,start_time,end_time)
 values(code,s.id,c.id,i.id,s.student_code,s.name,s.phone,c.course_code,c.name,i.name,i.email,p_mode,p_demo_date,p_start_time,p_end) returning * into b;
 insert into email_notifications(booking_id,recipient_email,subject,status) values(b.id,i.email,'New Aztec Demo Booking','pending');
 return to_jsonb(b);
exception when unique_violation then raise exception 'BOOKED';
end; $$;
revoke all on function create_demo_booking(uuid,uuid,uuid,text,date,time) from public; grant execute on function create_demo_booking(uuid,uuid,uuid,text,date,time) to anon,authenticated;

create or replace function admin_add_course(p_name text,p_code text) returns courses language plpgsql security invoker as $$
declare c courses; begin if not is_admin() then raise exception 'UNAUTHORIZED'; end if; insert into courses(name,course_code) values(trim(p_name),upper(trim(p_code))) returning * into c; return c; end; $$;

-- Seed courses
insert into courses(name,course_code) values
('AI Development','AI'),('Web Development','WEB'),('Amazon','AMZ'),('Shopify','SHOP'),('Graphic Designing','GD'),('UI/UX Designing','UIUX'),('Cloud Computing','CLOUD'),('IELTS','IELTS'),('PTE','PTE'),('Digital Marketing','DM')
on conflict(course_code) do nothing;

-- Seed instructors
insert into instructors(instructor_code,name,email) values
('INS-000001','Mueed Mubarak','mueed@example.com'),('INS-000002','Samir','samir@example.com'),('INS-000003','Aisha','aisha@example.com'),('INS-000004','Aamir','aamir@example.com'),('INS-000005','Asad','asad@example.com')
on conflict(instructor_code) do nothing;

insert into instructor_courses(instructor_id,course_id)
select i.id,c.id from instructors i join courses c on (i.name='Mueed Mubarak' and c.course_code='AI') or (i.name='Samir' and c.course_code in ('WEB','DM')) or (i.name='Aisha' and c.course_code='GD') or (i.name='Aamir' and c.course_code='AMZ') or (i.name='Asad' and c.course_code='SHOP') on conflict do nothing;

insert into instructor_schedules(instructor_id,course_id,mode,day_of_week,start_time,end_time,slot_duration_minutes)
select i.id,c.id,'Online',1,'16:00','19:00',60 from instructors i,courses c where i.name='Mueed Mubarak' and c.course_code='AI'
on conflict do nothing;
insert into instructor_schedules(instructor_id,course_id,mode,day_of_week,start_time,end_time,slot_duration_minutes)
select i.id,c.id,'Physical',1,'16:00','19:00',60 from instructors i,courses c where i.name='Mueed Mubarak' and c.course_code='AI'
on conflict do nothing;
