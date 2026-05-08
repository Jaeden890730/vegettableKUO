import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 管理員帳號密碼（存在後端，前端看不到）
const ADMIN_USERNAME = 'kuo';
const ADMIN_PASSWORD = '1121';
const ADMIN_EMAIL = 'kuo@admin.local';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();
    
    console.log(`Login attempt for username: ${username}`);

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      console.log('Credentials verified, creating/signing in Supabase Auth user');
      
      // 使用 service role key 建立 admin client
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // 先嘗試用這個 email 登入
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      let userId: string;
      let session = signInData?.session;

      if (signInError) {
        console.log('Sign in failed, attempting to create user:', signInError.message);
        
        // 如果登入失敗，嘗試創建用戶
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
        });

        if (createError) {
          console.error('Failed to create admin user:', createError.message);
          
          // 可能用戶已存在但密碼不對，嘗試更新密碼
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = listData?.users?.find(u => u.email === ADMIN_EMAIL);
          
          if (existingUser) {
            console.log('User exists, updating password');
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: ADMIN_PASSWORD,
            });
            userId = existingUser.id;
            
            // 重新登入
            const { data: retryData } = await supabaseAdmin.auth.signInWithPassword({
              email: ADMIN_EMAIL,
              password: ADMIN_PASSWORD,
            });
            session = retryData?.session;
          } else {
            throw new Error('無法創建管理員用戶');
          }
        } else {
          userId = createData.user!.id;
          
          // 創建後登入取得 session
          const { data: newSignInData } = await supabaseAdmin.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
          });
          session = newSignInData?.session;
        }
      } else {
        userId = signInData.user!.id;
      }

      // 確保 admin 角色存在
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: userId!, role: 'admin' },
          { onConflict: 'user_id,role' }
        );

      if (roleError) {
        console.error('Failed to set admin role:', roleError.message);
      } else {
        console.log('Admin role ensured for user:', userId);
      }

      console.log('Login successful with Supabase Auth');
      return new Response(
        JSON.stringify({ 
          success: true,
          session: session,
          user: session?.user,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      console.log('Login failed: invalid credentials');
      return new Response(
        JSON.stringify({ success: false, error: '帳號或密碼錯誤' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '登入失敗' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
