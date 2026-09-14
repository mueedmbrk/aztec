import type {Handler} from '@netlify/functions';
import {createClient} from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const handler:Handler=async (event)=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method Not Allowed'};
 const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {statusCode:500,body:'Server Supabase configuration is missing.'};
 const sb=createClient(url,key,{auth:{persistSession:false}});
 const auth=event.headers.authorization?.replace('Bearer ','');
 if(!auth)return {statusCode:401,body:'Unauthorized'};
 const {data:userData}=await sb.auth.getUser(auth); if(!userData.user)return {statusCode:401,body:'Unauthorized'};
 if(userData.user.app_metadata?.role!=='admin')return {statusCode:403,body:'Forbidden'};
 const format=(JSON.parse(event.body||'{}').format||'xlsx').toLowerCase();
 if(format==='google-sheets')return {statusCode:501,headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Google Sheets export is not configured. Add Google service-account credentials and a target sheet before using this button.'})};
 const [students,courses,instructors,schedules,bookings]=await Promise.all([
  sb.from('students').select('*').order('created_at',{ascending:false}),sb.from('courses').select('*').order('name'),sb.from('instructors').select('*').order('name'),sb.from('instructor_schedules').select('*'),sb.from('demo_bookings').select('*').order('created_at',{ascending:false})
 ]);
 for(const r of [students,courses,instructors,schedules,bookings])if(r.error)return {statusCode:500,body:r.error.message};
 const rows=(bookings.data||[]).map((b:any)=>({Booking_ID:b.booking_code,Student_ID:b.student_code,Name:b.student_name,Phone:b.student_phone,Course:b.course_name,Course_Code:b.course_code,Instructor:b.instructor_name,Instructor_Email:b.instructor_email,Mode:b.mode,Date:b.demo_date,Start:b.start_time,End:b.end_time,Status:b.status,Created_At:b.created_at}));
 if(format==='csv'){
  const headers=Object.keys(rows[0]||{Booking_ID:'',Student_ID:'',Name:'',Phone:'',Course:'',Instructor:'',Mode:'',Date:'',Start:'',End:'',Status:'',Created_At:''});
  const esc=(v:any)=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv=[headers.join(','),...rows.map(r=>headers.map(h=>esc((r as any)[h])).join(','))].join('\n');
  return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="Aztec_IT_Report.csv"'},body:Buffer.from(csv).toString('base64')};
 }
 const wb=new ExcelJS.Workbook(); wb.creator='AZTEC IT INSTITUTE'; wb.created=new Date();
 const title=(ws:any,text:string)=>{ws.mergeCells('A1:F1');ws.getCell('A1').value=text;ws.getCell('A1').font={bold:true,size:18,color:{argb:'FFFFFF'}};ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'102A4A'}};ws.getCell('A1').alignment={vertical:'middle'};ws.getRow(1).height=30;ws.freezePanes={ySplit:3};};
 const add=(name:string,data:any[])=>{const ws=wb.addWorksheet(name);title(ws,`AZTEC IT INSTITUTE — ${name}`);if(!data.length)return ws;const keys=Object.keys(data[0]);ws.addRow([]);ws.addRow(keys);data.forEach(x=>ws.addRow(keys.map(k=>x[k])));const hr=ws.getRow(3);hr.font={bold:true,color:{argb:'FFFFFF'}};hr.fill={type:'pattern',pattern:'solid',fgColor:{argb:'F47B20'}};hr.alignment={wrapText:true};ws.autoFilter.ref=`A3:${String.fromCharCode(64+Math.min(keys.length,26))}${ws.rowCount}`;keys.forEach((k,i)=>{let max=Math.max(k.length,...data.slice(0,200).map(x=>String(x[k]??'').length));ws.getColumn(i+1).width=Math.min(38,Math.max(12,max+2));});return ws;};
 const summary=wb.addWorksheet('Summary');title(summary,'AZTEC IT INSTITUTE — FULL REPORT');summary.getCell('A2').value=`Generated: ${new Date().toLocaleString()}`;[['Total Students',students.data?.length||0],['Total Demo Bookings',bookings.data?.length||0],['Confirmed',bookings.data?.filter((x:any)=>x.status==='Confirmed').length||0],['Completed',bookings.data?.filter((x:any)=>x.status==='Completed').length||0],['Cancelled',bookings.data?.filter((x:any)=>x.status==='Cancelled').length||0]].forEach(x=>summary.addRow(x));
 add('Students',students.data||[]);add('Demo Bookings',rows);add('Courses',courses.data||[]);add('Instructors',instructors.data||[]);add('Schedules',schedules.data||[]);
 const buf=await wb.xlsx.writeBuffer(); await sb.from('export_logs').insert({admin_user_id:userData.user.id,export_type:'xlsx'});
 return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Aztec_IT_Full_Report.xlsx"'},body:Buffer.from(buf).toString('base64')};
}; export {handler};
