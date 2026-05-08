import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_USERNAME = 'kuo';
const ADMIN_PASSWORD = '1121';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, password, vegetable, id, updates, orders } = await req.json();

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ success: false, error: '驗證失敗' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;

    switch (action) {
      case 'add': {
        const { data: maxOrderData } = await supabaseAdmin
          .from('retail_vegetables')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);
        
        const maxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].sort_order : 0;

        const { data, error } = await supabaseAdmin
          .from('retail_vegetables')
          .insert({
            name: vegetable.name,
            unit: vegetable.unit,
            price: vegetable.price,
            status: vegetable.status,
            note: vegetable.note,
            is_wholesale: vegetable.is_wholesale,
            supplier: vegetable.supplier || null,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          await supabaseAdmin
            .from('retail_vegetable_prices')
            .insert({
              vegetable_id: data.id,
              unit: vegetable.unit,
              price: vegetable.price,
              sort_order: 0,
            });
        }

        result = data;
        break;
      }

      case 'update': {
        const { data, error } = await supabaseAdmin
          .from('retail_vegetables')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case 'delete': {
        const { error } = await supabaseAdmin
          .from('retail_vegetables')
          .delete()
          .eq('id', id);

        if (error) throw error;
        result = { deleted: true };
        break;
      }

      case 'add_price': {
        const { vegetable_id, unit: priceUnit, price: priceValue } = vegetable;
        
        const { data: maxOrderData } = await supabaseAdmin
          .from('retail_vegetable_prices')
          .select('sort_order')
          .eq('vegetable_id', vegetable_id)
          .order('sort_order', { ascending: false })
          .limit(1);
        
        const maxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].sort_order : -1;

        const { data, error } = await supabaseAdmin
          .from('retail_vegetable_prices')
          .insert({
            vegetable_id,
            unit: priceUnit,
            price: priceValue,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();

        if (error) throw error;

        await supabaseAdmin
          .from('retail_vegetables')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', vegetable_id);

        result = data;
        break;
      }

      case 'update_price': {
        const { price_id, unit: priceUnit, price: priceValue, vegetable_id } = vegetable;
        
        const { data, error } = await supabaseAdmin
          .from('retail_vegetable_prices')
          .update({ unit: priceUnit, price: priceValue })
          .eq('id', price_id)
          .select()
          .single();

        if (error) throw error;

        if (vegetable_id) {
          await supabaseAdmin
            .from('retail_vegetables')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', vegetable_id);
        }

        result = data;
        break;
      }

      case 'delete_price': {
        const { price_id, vegetable_id } = vegetable;
        
        const { error } = await supabaseAdmin
          .from('retail_vegetable_prices')
          .delete()
          .eq('id', price_id);

        if (error) throw error;

        if (vegetable_id) {
          await supabaseAdmin
            .from('retail_vegetables')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', vegetable_id);
        }

        result = { deleted: true };
        break;
      }

      case 'reorder': {
        if (!orders || !Array.isArray(orders)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少排序資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        await Promise.all(
          orders.map(({ id: vegId, sort_order }: { id: string; sort_order: number }) =>
            supabaseAdmin
              .from('retail_vegetables')
              .update({ sort_order })
              .eq('id', vegId)
          )
        );

        result = { reordered: true, count: orders.length };
        break;
      }

      case 'bulk_update': {
        const bulkItems = vegetable?.items;
        
        if (!bulkItems || !Array.isArray(bulkItems)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少批量更新資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const now = new Date().toISOString();
        
        await Promise.all(
          bulkItems.map(async (item: { id: string; prices: { id: string; price: number; unit: string }[] }) => {
            await supabaseAdmin
              .from('retail_vegetables')
              .update({ updated_at: now })
              .eq('id', item.id);
            
            await Promise.all(
              item.prices.map((p: { id: string; price: number; unit: string }) =>
                supabaseAdmin
                  .from('retail_vegetable_prices')
                  .update({ price: p.price, unit: p.unit })
                  .eq('id', p.id)
              )
            );
          })
        );

        result = { updated: true, count: bulkItems.length };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: '未知操作' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Retail admin operation error:', error);
    const errorMessage = error instanceof Error ? error.message : '操作失敗';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
