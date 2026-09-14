import type {Handler} from '@netlify/functions';
import {createClient} from '@supabase/supabase-js';
import {sendBookingEmail} from './email.js';

const handler:Handler=async(event)=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method Not Allowed'};
 try{
  const {booking_code}=JSON.parse(event.body||'{}');
  if(!booking_code)return {statusCode:400,body:'booking_code required'};
  const url=process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return {statusCode:500,body:'Server Supabase configuration is missing.'};
  const sb=createClient(url,key,{auth:{persistSession:false}});
  const {data:b,error}=await sb.from('demo_bookings').select('*').eq('booking_code',booking_code).single();
  if(error||!b)return {statusCode:404,body:'Booking not found'};
  const result=await sendBookingEmail(b);
  if(result.status==='not_configured')return {statusCode:500,body:'Gmail email service is not configured.'};
  await sb.from('email_notifications').update({status:'sent',provider_message_id:result.messageId,sent_at:new Date().toISOString()}).eq('booking_id',b.id);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'sent',messageId:result.messageId})};
 }catch(e:any){
  return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({message:e?.message||'Email delivery failed'})};
 }
};export {handler};
