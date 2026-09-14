import { requireSupabase } from './supabase'; import type {Booking,Course,Instructor,Schedule,Slot,Student,Mode} from '../types';
const sb=()=>requireSupabase();
export const normalizePhone=(p:string)=>{let x=p.replace(/\D/g,''); if(x.startsWith('0092'))x=x.slice(2); if(x.startsWith('92')&&x.length===12)x='0'+x.slice(2); return x;};
export async function findStudent(phone:string){const {data,error}=await sb().rpc('find_student_by_phone',{p_phone:normalizePhone(phone)}); if(error)throw error; return data as Student|null;}
export async function registerStudent(name:string,phone:string){const {data,error}=await sb().rpc('register_student',{p_name:name.trim(),p_phone:normalizePhone(phone)}); if(error)throw error; return data as Student;}
export async function getCourses(){const {data,error}=await sb().from('courses').select('id,course_code,name,active,created_at,updated_at').eq('active',true).order('name'); if(error)throw new Error(`Courses could not be loaded: ${error.message}`); if(!data?.length) throw new Error('No active courses are available. In Supabase, run supabase/migrations/002_public_booking_read_policies.sql and check that your courses are active.'); return data as Course[];}
export async function getInstructors(courseId:string){const {data,error}=await sb().from('instructors').select('id,instructor_code,name,email,phone,profile_image,active,created_at,updated_at,instructor_courses!inner(course_id)').eq('active',true).eq('instructor_courses.course_id',courseId).order('name'); if(error)throw new Error(`Instructors could not be loaded: ${error.message}`); return data as Instructor[];}
export async function getSchedules(instructorId:string,courseId:string,mode:Mode){const {data,error}=await sb().from('instructor_schedules').select('*').eq('instructor_id',instructorId).eq('course_id',courseId).eq('mode',mode).eq('active',true); if(error)throw error; return data as Schedule[];}
export async function getSlots(instructorId:string,courseId:string,mode:Mode,date:string){const {data,error}=await sb().rpc('get_available_demo_slots',{p_instructor_id:instructorId,p_course_id:courseId,p_mode:mode,p_date:date}); if(error)throw error; return (data??[]).map((row:any)=>({start:String(row.start||''),end:String(row.end??row.end_time??''),end_time:String(row.end_time??row.end??''),available:row.available===true||String(row.available).toLowerCase()==='true'})) as Slot[];}
export async function createBooking(args:{studentId:string;courseId:string;instructorId:string;mode:Mode;date:string;start:string}){
 if(window.location.hostname!=='localhost' && window.location.hostname!=='127.0.0.1'){
  const res=await fetch('/.netlify/functions/create-booking',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});
  const text=await res.text(); let body:any={}; try{body=text?JSON.parse(text):{}}catch{body={message:text}}
  if(!res.ok) throw new Error(body?.message || text || `Booking failed (${res.status})`);
  return body.booking as Booking;
 }
 const {data,error}=await sb().rpc('create_demo_booking',{p_student_id:args.studentId,p_course_id:args.courseId,p_instructor_id:args.instructorId,p_mode:args.mode,p_demo_date:args.date,p_start_time:args.start});
 if(error) throw new Error(error.message || 'Unable to create booking.');
 if(!data) throw new Error('Booking was not created. Please try again.');
 return data as Booking;
}
export async function sendBookingNotification(bookingCode:string){
 const res=await fetch('/.netlify/functions/send-demo-notification',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({booking_code:bookingCode})});
 const text=await res.text();
 let body:any={}; try{body=text?JSON.parse(text):{}}catch{body={message:text}}
 if(!res.ok) throw new Error(body?.message || text || `Email notification failed (${res.status})`);
 return body;
}
export async function getBooking(code:string){const {data,error}=await sb().from('demo_bookings').select('*').eq('booking_code',code).maybeSingle(); if(error)throw error; return data as Booking|null;}
