import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const email=process.env.ADMIN_EMAIL||'admin@aztec.local';const password=process.env.ADMIN_INITIAL_PASSWORD||'Aztec112211';
if(!url||!key){console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');process.exit(1)}
const sb=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await sb.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'admin'}});
if(error&& !error.message.toLowerCase().includes('already registered'))throw error;
if(error){const {data:list}=await sb.auth.admin.listUsers();const u=list.users.find(x=>x.email===email);if(!u)throw error;await sb.auth.admin.updateUserById(u.id,{password,app_metadata:{role:'admin'}});}
console.log(`Admin ready: ${email} (username in portal: Admin)`);
