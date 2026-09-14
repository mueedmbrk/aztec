export type Mode = 'Online'|'Physical';
export type BookingStatus = 'Confirmed'|'Completed'|'Cancelled'|'No Show';
export interface Student { id:string; student_code:string; name:string; phone:string; active:boolean; created_at:string; updated_at:string; }
export interface Course { id:string; course_code:string; name:string; active:boolean; created_at:string; updated_at:string; }
export interface Instructor { id:string; instructor_code:string; name:string; email:string; phone?:string|null; profile_image?:string|null; active:boolean; created_at:string; updated_at:string; }
export interface Schedule { id:string; instructor_id:string; course_id:string; mode:Mode; day_of_week:number; start_time:string; end_time:string; slot_duration_minutes:number; active:boolean; }
export interface Booking { id:string; booking_code:string; student_id:string; course_id:string; instructor_id:string; student_code:string; student_name:string; student_phone:string; course_code:string; course_name:string; instructor_name:string; instructor_email:string; mode:Mode; demo_date:string; start_time:string; end_time:string; status:BookingStatus; created_at:string; }
export interface Slot { start:string; end?:string; end_time?:string; available:boolean; }
