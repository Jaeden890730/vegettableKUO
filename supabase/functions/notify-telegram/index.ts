import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderNotification {
  type: 'order';
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    packs?: number;
  }>;
  note?: string;
  orderTime?: string;
  targetChatId?: string; // 支援指定發送目標
  sendToAll?: boolean; // 發送給所有接收人
}

interface DailyStatsNotification {
  type: 'daily_stats';
  date: string;
  orderCount: number;
  items: Array<{
    itemName: string;
    details: string[];
    total: string;
  }>;
  targetChatId?: string; // 支援指定發送目標
}

type NotificationPayload = OrderNotification | DailyStatsNotification;

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(telegramUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  const result = await response.json();
  console.log(`Telegram API response for ${chatId}:`, result.ok ? 'success' : result);
  return result.ok;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const defaultChatId = Deno.env.get('TELEGRAM_CHAT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken) {
      console.error('Missing Telegram bot token');
      return new Response(
        JSON.stringify({ error: 'Telegram bot token missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: NotificationPayload = await req.json();
    
    let message: string;

    if (payload.type === 'daily_stats') {
      // Format daily stats message
      console.log('Received daily stats notification:', { date: payload.date, orderCount: payload.orderCount, itemCount: payload.items.length });
      
      const itemsList = payload.items
        .map(item => `${item.itemName}  ${item.details.join(' ')}  → ${item.total}`)
        .join('\n');

      message = `📊 *備貨統計* ${payload.date}
${payload.orderCount} 筆訂單

${itemsList}`;
    } else {
      // Format order notification (existing logic)
      const orderPayload = payload as OrderNotification;
      console.log('Received order notification request:', { orderNumber: orderPayload.orderNumber, customerName: orderPayload.customerName, itemCount: orderPayload.items.length });

      const itemsList = orderPayload.items
        .map(item => {
          const packsText = item.packs && item.packs > 1 ? ` ×${item.packs}份` : '';
          return `  • ${item.name} ${item.quantity} ${item.unit}${packsText}`;
        })
        .join('\n');

      message = `🛒 *新訂單通知*

📋 訂單編號：\`${orderPayload.orderNumber}\`
👤 客戶：${orderPayload.customerName}
🕐 下單時間：${orderPayload.orderTime}

📦 *訂購品項：*
${itemsList}
${orderPayload.note ? `\n📝 備註：${orderPayload.note}` : ''}`;
    }

    // Determine which chat IDs to send to
    let chatIds: string[] = [];
    
    if (payload.targetChatId) {
      // If specific targetChatId is provided, only send to that
      chatIds = [payload.targetChatId];
      console.log('Sending to specific chat ID:', payload.targetChatId);
    } else if (supabaseUrl && supabaseServiceKey) {
      // For order notifications without targetChatId, fetch all recipients from database
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: settings } = await supabase
          .from('app_settings')
          .select('key, value')
          .like('key', 'telegram_recipient_%');
        
        const recipientMap = new Map<string, string>();
        settings?.forEach((setting: { key: string; value: string | null }) => {
          const match = setting.key.match(/telegram_recipient_(\d+)_chat_id/);
          if (match && setting.value) {
            recipientMap.set(match[1], setting.value);
          }
        });
        
        chatIds = Array.from(recipientMap.values());
        console.log('Found recipients in database:', chatIds.length);
      } catch (err) {
        console.error('Error fetching recipients from database:', err);
      }
    }
    
    // Fallback to default chat ID if no recipients found
    if (chatIds.length === 0) {
      if (defaultChatId) {
        chatIds = [defaultChatId];
        console.log('Using default chat ID from environment');
      } else {
        console.error('No chat ID specified and no default available');
        return new Response(
          JSON.stringify({ error: 'No Telegram chat ID specified' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send to all chat IDs
    console.log(`Sending notification to ${chatIds.length} recipient(s)`);
    const results = await Promise.all(
      chatIds.map(chatId => sendTelegramMessage(botToken, chatId, message))
    );
    
    const successCount = results.filter(r => r).length;
    console.log(`Successfully sent to ${successCount}/${chatIds.length} recipients`);

    return new Response(
      JSON.stringify({ success: true, sentTo: successCount, total: chatIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notify-telegram function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
