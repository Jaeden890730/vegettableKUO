import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 管理員帳號密碼（存在後端，前端看不到）
const ADMIN_USERNAME = 'kuo';
const ADMIN_PASSWORD = '1121';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, password, vegetable, id, updates, orders } = await req.json();

    console.log(`Admin action: ${action}`);

    // 驗證管理員身份
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      console.log('Authentication failed');
      return new Response(
        JSON.stringify({ success: false, error: '驗證失敗' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // 使用 service role key 建立 Supabase client（可以繞過 RLS）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;

    switch (action) {
      case 'add': {
        // 取得最大 sort_order
        const { data: maxOrderData } = await supabaseAdmin
          .from('vegetables')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);
        
        const maxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].sort_order : 0;

        const { data, error } = await supabaseAdmin
          .from('vegetables')
          .insert({
            name: vegetable.name,
            unit: vegetable.unit,
            price: vegetable.price,
            status: vegetable.status,
            note: vegetable.note,
            is_wholesale: vegetable.is_wholesale,
            tag: vegetable.tag || null,
            supplier: vegetable.supplier || null,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();

        if (error) throw error;

        // 新增第一筆價格到 vegetable_prices
        if (data) {
          await supabaseAdmin
            .from('vegetable_prices')
            .insert({
              vegetable_id: data.id,
              unit: vegetable.unit,
              price: vegetable.price,
              sort_order: 0,
            });
        }

        result = data;
        console.log('Vegetable added:', data?.name);
        break;
      }

      case 'update': {
        const { data, error } = await supabaseAdmin
          .from('vegetables')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        result = data;
        console.log('Vegetable updated:', id);
        break;
      }

      case 'delete': {
        // vegetable_prices 會因為 ON DELETE CASCADE 自動刪除
        const { error } = await supabaseAdmin
          .from('vegetables')
          .delete()
          .eq('id', id);

        if (error) throw error;
        result = { deleted: true };
        console.log('Vegetable deleted:', id);
        break;
      }

      case 'add_price': {
        const { vegetable_id, unit: priceUnit, price: priceValue } = vegetable;
        
        // 取得最大 sort_order
        const { data: maxOrderData } = await supabaseAdmin
          .from('vegetable_prices')
          .select('sort_order')
          .eq('vegetable_id', vegetable_id)
          .order('sort_order', { ascending: false })
          .limit(1);
        
        const maxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].sort_order : -1;

        const { data, error } = await supabaseAdmin
          .from('vegetable_prices')
          .insert({
            vegetable_id,
            unit: priceUnit,
            price: priceValue,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();

        if (error) throw error;

        // 更新 vegetables 的 updated_at
        await supabaseAdmin
          .from('vegetables')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', vegetable_id);

        result = data;
        console.log('Price added for vegetable:', vegetable_id);
        break;
      }

      case 'update_price': {
        const { price_id, unit: priceUnit, price: priceValue, vegetable_id } = vegetable;
        
        const { data, error } = await supabaseAdmin
          .from('vegetable_prices')
          .update({ unit: priceUnit, price: priceValue })
          .eq('id', price_id)
          .select()
          .single();

        if (error) throw error;

        // 更新 vegetables 的 updated_at
        if (vegetable_id) {
          await supabaseAdmin
            .from('vegetables')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', vegetable_id);
        }

        result = data;
        console.log('Price updated:', price_id);
        break;
      }

      case 'delete_price': {
        const { price_id, vegetable_id } = vegetable;
        
        const { error } = await supabaseAdmin
          .from('vegetable_prices')
          .delete()
          .eq('id', price_id);

        if (error) throw error;

        // 更新 vegetables 的 updated_at
        if (vegetable_id) {
          await supabaseAdmin
            .from('vegetables')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', vegetable_id);
        }

        result = { deleted: true };
        console.log('Price deleted:', price_id);
        break;
      }

      case 'reorder': {
        // 批量更新 sort_order
        if (!orders || !Array.isArray(orders)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少排序資料' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        // 使用 Promise.all 批量更新
        await Promise.all(
          orders.map(({ id: vegId, sort_order }: { id: string; sort_order: number }) =>
            supabaseAdmin
              .from('vegetables')
              .update({ sort_order })
              .eq('id', vegId)
          )
        );

        result = { reordered: true, count: orders.length };
        console.log('Vegetables reordered:', orders.length);
        break;
      }

      case 'bulk_update': {
        // 批量更新所有蔬菜價格
        const { items } = await req.json().catch(() => ({ items: null }));
        const bulkItems = vegetable?.items || items;
        
        if (!bulkItems || !Array.isArray(bulkItems)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少批量更新資料' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        const now = new Date().toISOString();
        
        // 批量更新所有品項
        await Promise.all(
          bulkItems.map(async (item: { id: string; prices: { id: string; price: number; unit: string }[] }) => {
            // 更新 vegetable 的 updated_at
            await supabaseAdmin
              .from('vegetables')
              .update({ updated_at: now })
              .eq('id', item.id);
            
            // 更新每個價格
            await Promise.all(
              item.prices.map((p: { id: string; price: number; unit: string }) =>
                supabaseAdmin
                  .from('vegetable_prices')
                  .update({ price: p.price, unit: p.unit })
                  .eq('id', p.id)
              )
            );
          })
        );

        result = { updated: true, count: bulkItems.length };
        console.log('Bulk updated vegetables:', bulkItems.length);
        break;
      }

      case 'save_supplier_orders': {
        const suppliers = vegetable?.suppliers;
        if (!suppliers || !Array.isArray(suppliers)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少供貨商資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        await supabaseAdmin.from('supplier_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        if (suppliers.length > 0) {
          const { error: insertErr } = await supabaseAdmin
            .from('supplier_orders')
            .insert(suppliers.map((s: { supplier_name: string; sort_order: number }) => ({
              supplier_name: s.supplier_name,
              sort_order: s.sort_order,
            })));
          if (insertErr) throw insertErr;
        }

        result = { saved: true, count: suppliers.length };
        console.log('Supplier orders saved:', suppliers.length);
        break;
      }

      case 'save_tag_orders': {
        const tags = vegetable?.tags;
        if (!tags || !Array.isArray(tags)) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少標籤資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Delete all existing tag orders
        await supabaseAdmin.from('tag_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert new tag orders
        if (tags.length > 0) {
          const { error: insertErr } = await supabaseAdmin
            .from('tag_orders')
            .insert(tags.map((t: { tag_name: string; sort_order: number }) => ({
              tag_name: t.tag_name,
              sort_order: t.sort_order,
            })));
          if (insertErr) throw insertErr;
        }

        result = { saved: true, count: tags.length };
        console.log('Tag orders saved:', tags.length);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: '未知操作' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Admin operation error:', error);
    const errorMessage = error instanceof Error ? error.message : '操作失敗';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
