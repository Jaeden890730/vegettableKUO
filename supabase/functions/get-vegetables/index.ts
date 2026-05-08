import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check if caller is admin (optional auth header)
    let isAdmin = false;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await userClient.auth.getClaims(token);
      if (data?.claims?.sub) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.claims.sub)
          .eq('role', 'admin');
        isAdmin = (roles && roles.length > 0);
      }
    }

    // Fetch all three in parallel using service role (bypasses RLS)
    const [vegsResult, pricesResult, tagOrdersResult] = await Promise.all([
      supabase.from('vegetables').select('*').order('sort_order', { ascending: true }),
      supabase.from('vegetable_prices').select('*').order('sort_order', { ascending: true }),
      supabase.from('tag_orders').select('*').order('sort_order', { ascending: true }),
    ]);

    if (vegsResult.error) throw vegsResult.error;
    if (pricesResult.error) throw pricesResult.error;
    if (tagOrdersResult.error) throw tagOrdersResult.error;

    // Filter hidden vegetables for non-admin
    let vegetables = vegsResult.data || [];
    if (!isAdmin) {
      vegetables = vegetables.filter((v: any) => v.status !== 'hidden');
    }

    // Cache headers: 25s for public (price data), CDN can cache
    // Admin requests should not be cached
    const cacheControl = isAdmin
      ? 'no-store'
      : 'public, max-age=25, s-maxage=25, stale-while-revalidate=60';

    return new Response(JSON.stringify({
      vegetables,
      prices: pricesResult.data || [],
      tag_orders: tagOrdersResult.data || [],
      _ts: Date.now(), // timestamp for client cache validation
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': cacheControl,
      },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
