import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 管理員帳號密碼（存在後端，前端看不到）
const ADMIN_USERNAME = "kuo";
const ADMIN_PASSWORD = "1121";

type AccountingEntryType = "income" | "expense" | "purchase";

type AccountingEntryInput = {
  entry_date: string;
  entry_type: AccountingEntryType;
  category: string;
  item_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  amount: number;
  note?: string | null;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, password, filters, entry, id, updates } = await req.json();

    console.log(`Accounting admin action: ${action}`);

    // 驗證管理員身份
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: false, error: "驗證失敗" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 使用 service role key 建立 client（可以繞過 RLS）
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (action) {
      case "list": {
        let query = supabaseAdmin
          .from("accounting_entries")
          .select("*")
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false });

        const startDate: string | undefined = filters?.startDate;
        const endDate: string | undefined = filters?.endDate;
        const entryType: AccountingEntryType | undefined = filters?.entryType;

        if (startDate) query = query.gte("entry_date", startDate);
        if (endDate) query = query.lte("entry_date", endDate);
        if (entryType) query = query.eq("entry_type", entryType);

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "create": {
        const payload: AccountingEntryInput = entry;

        const { data, error } = await supabaseAdmin
          .from("accounting_entries")
          .insert({
            entry_date: payload.entry_date,
            entry_type: payload.entry_type,
            category: payload.category,
            item_name: payload.item_name ?? null,
            quantity: payload.quantity ?? null,
            unit: payload.unit ?? null,
            unit_price: payload.unit_price ?? null,
            amount: payload.amount,
            note: payload.note ?? null,
          })
          .select("*")
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "bulk_create": {
        const entries: AccountingEntryInput[] = entry;
        if (!Array.isArray(entries) || entries.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "請提供記帳資料" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const insertData = entries.map((e) => ({
          entry_date: e.entry_date,
          entry_type: e.entry_type,
          category: e.category,
          item_name: e.item_name ?? null,
          quantity: e.quantity ?? null,
          unit: e.unit ?? null,
          unit_price: e.unit_price ?? null,
          amount: e.amount,
          note: e.note ?? null,
        }));

        const { data, error } = await supabaseAdmin
          .from("accounting_entries")
          .insert(insertData)
          .select("*");

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "update": {
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: "缺少 id" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const { data, error } = await supabaseAdmin
          .from("accounting_entries")
          .update(updates ?? {})
          .eq("id", id)
          .select("*")
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "delete": {
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: "缺少 id" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const { error } = await supabaseAdmin.from("accounting_entries").delete().eq("id", id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data: { deleted: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: "未知操作" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
    }
  } catch (error: unknown) {
    console.error("Accounting admin error:", error);
    const message = error instanceof Error ? error.message : "操作失敗";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
