import type {Handler} from '@netlify/functions';
import {createClient} from '@supabase/supabase-js';
import {sendBookingEmail} from './email.js';

const json=(statusCode:number,body:any)=>({statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

const handler:Handler=async(event)=>{
  if(event.httpMethod!=='POST') return {statusCode:405,body:'Method Not Allowed'};
  try{
    const url=process.env.VITE_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key) return json(500,{message:'Server Supabase configuration is missing.'});
    const body=JSON.parse(event.body||'{}');
    const {studentId,courseId,instructorId,mode,date,start}=body;
    if(!studentId||!courseId||!instructorId||!mode||!date||!start) return json(400,{message:'Missing booking fields.'});
    const sb=createClient(url,key,{auth:{persistSession:false}});
    const {data,error}=await sb.rpc('create_demo_booking',{p_student_id:studentId,p_course_id:courseId,p_instructor_id:instructorId,p_mode:mode,p_demo_date:date,p_start_time:start});
    if(error) return json(409,{message:error.message});
    const booking=data;
    let emailStatus='not_configured';
    let emailMessageId='';
    try{
      const email=await sendBookingEmail(booking);
      emailStatus=email.status;
      emailMessageId=email.status==='sent'?email.messageId||'':'';
      if(email.status==='sent'){
        await sb.from('email_notifications').update({status:'sent',provider_message_id:emailMessageId,sent_at:new Date().toISOString()}).eq('booking_id',booking.id);
      }
    }catch(e:any){
      emailStatus='failed';
      await sb.from('email_notifications').update({status:'failed',error_message:e?.message||'Email delivery failed'}).eq('booking_id',booking.id);
    }
    return json(200,{booking,emailStatus,emailMessageId});
  }catch(e:any){
    return json(500,{message:e?.message||'Booking failed.'});
  }
};
export {handler};
