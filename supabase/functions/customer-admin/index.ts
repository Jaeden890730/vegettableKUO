import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin credentials (same as vegetables-admin)
const ADMIN_USERNAME = 'kuo';
const ADMIN_PASSWORD = '1121';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, password, customer, orderId, orderIds, settlement, items, payment, merchantNote, customerId, orderNote, orderItems, newItems, deletedItemIds, deliveryDate } = await req.json();

    // Validate admin credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    switch (action) {
      case 'list_customers': {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, customers: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_orders': {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            customer:customers(*),
            order_items(
              *,
              vegetable:vegetables(name)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, orders: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_settlements': {
        const { data, error } = await supabase
          .from('settlements')
          .select(`
            *,
            customer:customers(*),
            settlement_items(*),
            payments(*)
          `)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, settlements: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_customer': {
        const { name, phone, contact_person, settlement_cycle, note, customer_password } = customer;

        let userId: string | null = null;

        // Create auth user if phone and password provided
        if (phone && customer_password) {
          const email = `${phone}@customer.local`;
          
          // First check if user already exists
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === email);
          
          if (existingUser) {
            // User exists - check if already linked to a customer
            const { data: existingCustomer } = await supabase
              .from('customers')
              .select('id')
              .eq('user_id', existingUser.id)
              .single();
            
            if (existingCustomer) {
              return new Response(
                JSON.stringify({ success: false, error: '此手機號碼已綁定其他客戶' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            // Reuse existing user and update password
            userId = existingUser.id;
            await supabase.auth.admin.updateUserById(userId, { password: customer_password });
          } else {
            // Create new user
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
              email,
              password: customer_password,
              email_confirm: true,
            });

            if (authError) {
              console.error('Auth error:', authError);
              return new Response(
                JSON.stringify({ success: false, error: `建立帳號失敗: ${authError.message}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            userId = authData.user?.id || null;
          }

          // Add customer role (upsert to avoid duplicates)
          if (userId) {
            const { error: roleError } = await supabase
              .from('user_roles')
              .upsert({
                user_id: userId,
                role: 'customer',
              }, { onConflict: 'user_id,role' });

            if (roleError) {
              console.error('Role error:', roleError);
            }
          }
        }

        // Create customer record
        const { data, error } = await supabase
          .from('customers')
          .insert({
            user_id: userId,
            name,
            phone: phone || null,
            contact_person: contact_person || null,
            settlement_cycle: settlement_cycle || 'monthly',
            note: note || null,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, customer: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_customer': {
        const { id, ...updates } = customer;

        const { data, error } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, customer: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_customer': {
        const { id } = customer;

        // Get customer to check if has user_id
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', id)
          .single();

        // Delete auth user if exists
        if (customerData?.user_id) {
          await supabase.auth.admin.deleteUser(customerData.user_id);
        }

        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset_password': {
        const { customer_id, new_password } = customer;

        // Get customer user_id
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customer_id)
          .single();

        if (!customerData?.user_id) {
          return new Response(
            JSON.stringify({ success: false, error: '客戶無登入帳號' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase.auth.admin.updateUserById(
          customerData.user_id,
          { password: new_password }
        );

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset_credentials': {
        const { id, phone, new_password } = customer;

        // Get customer data
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id, phone')
          .eq('id', id)
          .single();

        const newEmail = `${phone}@customer.local`;

        if (customerData?.user_id) {
          // Update existing auth user
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            customerData.user_id,
            { email: newEmail, password: new_password, email_confirm: true }
          );

          if (updateError) {
            return new Response(
              JSON.stringify({ success: false, error: updateError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Create new auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: newEmail,
            password: new_password,
            email_confirm: true,
          });

          if (authError) {
            return new Response(
              JSON.stringify({ success: false, error: authError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Add customer role
          if (authData.user) {
            await supabase.from('user_roles').upsert({
              user_id: authData.user.id,
              role: 'customer',
            }, { onConflict: 'user_id,role' });

            // Update customer with user_id
            await supabase.from('customers').update({ user_id: authData.user.id, phone }).eq('id', id);
          }
        }

        // Update customer phone
        const { error: customerError } = await supabase
          .from('customers')
          .update({ phone })
          .eq('id', id);

        if (customerError) {
          return new Response(
            JSON.stringify({ success: false, error: customerError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_order': {
        if (!orderId) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少訂單ID' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete order items first
        const { error: itemsError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (itemsError) {
          return new Response(
            JSON.stringify({ success: false, error: itemsError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Then delete the order
        const { error: orderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (orderError) {
          return new Response(
            JSON.stringify({ success: false, error: orderError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_order_items': {
        if (!orderId) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少必要參數' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete removed items
        if (deletedItemIds && deletedItemIds.length > 0) {
          for (const itemId of deletedItemIds) {
            const { error } = await supabase
              .from('order_items')
              .delete()
              .eq('id', itemId);
            if (error) {
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // Update existing items
        if (items && items.length > 0) {
          for (const item of items) {
            const updatePayload: any = {
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unitPrice,
            };
            if (item.packs !== undefined && item.packs !== null) {
              updatePayload.packs = item.packs;
            }
            const { error } = await supabase
              .from('order_items')
              .update(updatePayload)
              .eq('id', item.id);

            if (error) {
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // Add new items
        if (newItems && newItems.length > 0) {
          for (const item of newItems) {
            const { error } = await supabase
              .from('order_items')
              .insert({
                order_id: orderId,
                vegetable_id: item.vegetable_id || null,
                custom_item_name: item.custom_item_name || null,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unitPrice || 0,
                packs: item.packs || 1,
              });
            if (error) {
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (merchantNote !== undefined) {
          updateData.merchant_note = merchantNote;
        }
        if (customerId !== undefined && customerId !== null) {
          updateData.customer_id = customerId;
        }
        if (deliveryDate !== undefined) {
          updateData.delivery_date = deliveryDate || null;
        }

        await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_settlement': {
        const { customer_id, period_start, period_end, note } = settlement;

        // Generate settlement number
        const { data: settlementNumberData, error: settlementNumberError } = await supabase
          .rpc('generate_settlement_number');

        if (settlementNumberError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementNumberError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create settlement
        const { data: settlementData, error: settlementError } = await supabase
          .from('settlements')
          .insert({
            settlement_number: settlementNumberData,
            customer_id,
            period_start,
            period_end,
            note: note || null,
            status: 'draft',
          })
          .select()
          .single();

        if (settlementError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch orders in the period (include order_date)
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            order_date,
            order_items(
              id,
              vegetable_id,
              custom_item_name,
              quantity,
              unit,
              packs,
              unit_price,
              vegetable:vegetables(name, price)
            )
          `)
          .eq('customer_id', customer_id)
          .gte('order_date', period_start)
          .lte('order_date', period_end);

        if (ordersError) {
          return new Response(
            JSON.stringify({ success: false, error: ordersError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create settlement items from each order item (no aggregation to preserve original prices)
        const settlementItems: any[] = [];
        ordersData?.forEach((order: any) => {
          order.order_items?.forEach((item: any) => {
            const itemName = item.custom_item_name || item.vegetable?.name || '未知品項';
            // Use the saved unit_price from when admin applied prices
            const unitPrice = Number(item.unit_price) || 0;
            // Skip items without price applied
            if (unitPrice === 0) return;
            
            const packs = Number(item.packs) || 1;
            const quantity = Number(item.quantity) * packs;
            
            settlementItems.push({
              settlement_id: settlementData.id,
              order_item_id: item.id,
              item_name: itemName,
              settlement_quantity: quantity,
              settlement_unit: item.unit,
              settlement_unit_price: unitPrice,
              subtotal: Math.round(quantity * unitPrice),
              order_date: order.order_date,
            });
          });
        });

        if (settlementItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('settlement_items')
            .insert(settlementItems);

          if (itemsError) {
            return new Response(
              JSON.stringify({ success: false, error: itemsError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update total amount
          const totalAmount = settlementItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
          await supabase
            .from('settlements')
            .update({ total_amount: totalAmount })
            .eq('id', settlementData.id);
        }

        return new Response(
          JSON.stringify({ success: true, settlement: settlementData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_settlement_from_order': {
        // Fetch order with items
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              id,
              vegetable_id,
              custom_item_name,
              quantity,
              unit,
              packs,
              unit_price,
              vegetable:vegetables(name, price)
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (orderError) {
          return new Response(
            JSON.stringify({ success: false, error: orderError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!orderData) {
          return new Response(
            JSON.stringify({ success: false, error: '訂單不存在' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate settlement number
        const { data: settlementNumberData, error: settlementNumberError } = await supabase
          .rpc('generate_settlement_number');

        if (settlementNumberError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementNumberError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create settlement
        const { data: settlementData, error: settlementError } = await supabase
          .from('settlements')
          .insert({
            settlement_number: settlementNumberData,
            customer_id: orderData.customer_id,
            period_start: orderData.order_date,
            period_end: orderData.order_date,
            note: `來源訂單: ${orderData.order_number}`,
            status: 'draft',
          })
          .select()
          .single();

        if (settlementError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create settlement items from order items
        const settlementItems = (orderData.order_items || []).map((item: any) => {
          const itemName = item.custom_item_name || item.vegetable?.name || '未知品項';
          const unitPrice = Number(item.unit_price) || Number(item.vegetable?.price) || 0;
          const packs = Number(item.packs) || 1;
          const quantity = Number(item.quantity) * packs;
          
          return {
            settlement_id: settlementData.id,
            order_item_id: item.id,
            item_name: itemName,
            settlement_quantity: quantity,
            settlement_unit: item.unit,
            settlement_unit_price: unitPrice,
            subtotal: Math.round(quantity * unitPrice),
            order_date: orderData.order_date,
          };
        });

        if (settlementItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('settlement_items')
            .insert(settlementItems);

          if (itemsError) {
            return new Response(
              JSON.stringify({ success: false, error: itemsError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update total amount
          const totalAmount = settlementItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
          await supabase
            .from('settlements')
            .update({ total_amount: totalAmount })
            .eq('id', settlementData.id);
        }

        return new Response(
          JSON.stringify({ success: true, settlement: settlementData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_settlement_from_orders': {
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: '請選擇至少一張訂單' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              id,
              vegetable_id,
              custom_item_name,
              quantity,
              unit,
              packs,
              unit_price,
              vegetable:vegetables(name, price)
            )
          `)
          .in('id', orderIds);

        if (ordersError) {
          return new Response(
            JSON.stringify({ success: false, error: ordersError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!ordersData || ordersData.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: '訂單不存在' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 必須同一位客戶
        const customerIds = Array.from(new Set(ordersData.map((o: any) => o.customer_id)));
        if (customerIds.length > 1) {
          return new Response(
            JSON.stringify({ success: false, error: '所選訂單必須屬於同一位客戶' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const dates = ordersData.map((o: any) => o.order_date).sort();
        const periodStart = dates[0];
        const periodEnd = dates[dates.length - 1];
        const orderNumbers = ordersData.map((o: any) => o.order_number).join(', ');

        const { data: settlementNumberData, error: settlementNumberError } = await supabase
          .rpc('generate_settlement_number');
        if (settlementNumberError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementNumberError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: settlementData, error: settlementError } = await supabase
          .from('settlements')
          .insert({
            settlement_number: settlementNumberData,
            customer_id: customerIds[0],
            period_start: periodStart,
            period_end: periodEnd,
            note: `來源訂單: ${orderNumbers}`,
            status: 'draft',
          })
          .select()
          .single();

        if (settlementError) {
          return new Response(
            JSON.stringify({ success: false, error: settlementError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const settlementItems: any[] = [];
        for (const order of ordersData) {
          for (const item of (order.order_items || [])) {
            const itemName = item.custom_item_name || item.vegetable?.name || '未知品項';
            const unitPrice = Number(item.unit_price) || Number(item.vegetable?.price) || 0;
            const packs = Number(item.packs) || 1;
            const quantity = Number(item.quantity) * packs;
            settlementItems.push({
              settlement_id: settlementData.id,
              order_item_id: item.id,
              item_name: itemName,
              settlement_quantity: quantity,
              settlement_unit: item.unit,
              settlement_unit_price: unitPrice,
              subtotal: Math.round(quantity * unitPrice),
              order_date: order.order_date,
            });
          }
        }

        if (settlementItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('settlement_items')
            .insert(settlementItems);
          if (itemsError) {
            return new Response(
              JSON.stringify({ success: false, error: itemsError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const totalAmount = settlementItems.reduce((sum, i) => sum + i.subtotal, 0);
          await supabase
            .from('settlements')
            .update({ total_amount: totalAmount })
            .eq('id', settlementData.id);
        }

        return new Response(
          JSON.stringify({ success: true, settlement: settlementData, count: ordersData.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_settlement': {
        const settlementId = settlement?.id;
        if (!settlementId) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少結帳單ID' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete payments first
        await supabase.from('payments').delete().eq('settlement_id', settlementId);
        
        // Delete settlement items
        await supabase.from('settlement_items').delete().eq('settlement_id', settlementId);
        
        // Delete settlement
        const { error } = await supabase.from('settlements').delete().eq('id', settlementId);

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_payment': {
        if (!payment) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少付款資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('payments')
          .insert(payment)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, payment: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_payment': {
        if (!payment || !payment.id) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少付款資料' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { id, ...updates } = payment;
        const { data, error } = await supabase
          .from('payments')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, payment: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_payment': {
        if (!payment || !payment.id) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少付款ID' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('payments')
          .delete()
          .eq('id', payment.id);

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_order': {
        // Generate order number
        const { data: orderNumberData, error: orderNumberError } = await supabase
          .rpc('generate_order_number');

        if (orderNumberError) {
          return new Response(
            JSON.stringify({ success: false, error: orderNumberError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumberData,
            customer_id: customerId,
            note: orderNote || null,
            status: 'pending',
            delivery_date: deliveryDate || null,
          })
          .select()
          .single();

        if (orderError) {
          return new Response(
            JSON.stringify({ success: false, error: orderError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create order items
        const newOrderItems = (orderItems || []).map((item: any) => ({
          order_id: newOrder.id,
          vegetable_id: item.vegetable_id || null,
          custom_item_name: item.custom_item_name || null,
          quantity: item.quantity,
          unit: item.unit,
          packs: item.packs || 1,
          note: item.note || null,
        }));

        if (newOrderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(newOrderItems);

          if (itemsError) {
            return new Response(
              JSON.stringify({ success: false, error: itemsError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Send Telegram notification
        try {
          // Fetch customer name
          const { data: customerData } = await supabase
            .from('customers')
            .select('name')
            .eq('id', customerId)
            .single();

          const customerName = customerData?.name || '未知客戶';
          const now = new Date();
          const orderTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          // Fetch vegetable names for items with vegetable_id
          const vegIds = (orderItems || []).filter((i: any) => i.vegetable_id).map((i: any) => i.vegetable_id);
          let vegNameMap: Record<string, string> = {};
          if (vegIds.length > 0) {
            const { data: vegs } = await supabase
              .from('vegetables')
              .select('id, name')
              .in('id', vegIds);
            vegs?.forEach((v: any) => { vegNameMap[v.id] = v.name; });
          }

          const notifyItems = (orderItems || []).map((item: any) => ({
            name: item.vegetable_id ? (vegNameMap[item.vegetable_id] || '未知品項') : (item.custom_item_name || '自訂品項'),
            quantity: item.quantity,
            unit: item.unit,
            packs: item.packs || 1,
          }));

          const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
          const defaultChatId = Deno.env.get('TELEGRAM_CHAT_ID');

          if (botToken) {
            // Fetch all recipients
            let chatIds: string[] = [];
            const { data: settings } = await supabase
              .from('app_settings')
              .select('key, value')
              .like('key', 'telegram_recipient_%');

            settings?.forEach((s: any) => {
              const match = s.key.match(/telegram_recipient_(\d+)_chat_id/);
              if (match && s.value) chatIds.push(s.value);
            });

            if (chatIds.length === 0 && defaultChatId) chatIds = [defaultChatId];

            if (chatIds.length > 0) {
              const itemsList = notifyItems
                .map((item: any) => {
                  const packsText = item.packs > 1 ? ` x${item.packs}份` : '';
                  return `  • ${item.name} ${item.quantity} ${item.unit}${packsText}`;
                })
                .join('\n');

              const message = `🛒 *新訂單通知（管理員代下）*\n\n📋 訂單編號：\`${orderNumberData}\`\n👤 客戶：${customerName}\n🕐 下單時間：${orderTime}\n\n📦 *訂購品項：*\n${itemsList}${orderNote ? `\n\n📝 備註：${orderNote}` : ''}`;

              const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
              await Promise.all(chatIds.map(cid =>
                fetch(telegramUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: cid, text: message, parse_mode: 'Markdown' }),
                }).catch(e => console.error('Telegram send error:', e))
              ));
            }
          }
        } catch (notifyErr) {
          console.error('Telegram notification error (non-fatal):', notifyErr);
        }

        return new Response(
          JSON.stringify({ success: true, order: newOrder }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: '未知操作' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '伺服器錯誤' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
