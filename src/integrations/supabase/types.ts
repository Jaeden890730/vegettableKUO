export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          entry_date: string
          entry_type: Database["public"]["Enums"]["accounting_entry_type"]
          id: string
          item_name: string | null
          note: string | null
          quantity: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          entry_date?: string
          entry_type: Database["public"]["Enums"]["accounting_entry_type"]
          id?: string
          item_name?: string | null
          note?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["accounting_entry_type"]
          id?: string
          item_name?: string | null
          note?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_done: boolean
          sort_order: number
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          can_view_all_dates: boolean
          can_view_item_stats_detail: boolean
          contact_person: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          phone: string | null
          settlement_cycle: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_view_all_dates?: boolean
          can_view_item_stats_detail?: boolean
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          phone?: string | null
          settlement_cycle?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_view_all_dates?: boolean
          can_view_item_stats_detail?: boolean
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          settlement_cycle?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      holiday_dates: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          actual_quantity: number | null
          actual_unit: string | null
          created_at: string
          custom_item_name: string | null
          id: string
          note: string | null
          order_id: string
          packs: number
          quantity: number
          unit: string
          unit_price: number | null
          vegetable_id: string | null
        }
        Insert: {
          actual_quantity?: number | null
          actual_unit?: string | null
          created_at?: string
          custom_item_name?: string | null
          id?: string
          note?: string | null
          order_id: string
          packs?: number
          quantity?: number
          unit?: string
          unit_price?: number | null
          vegetable_id?: string | null
        }
        Update: {
          actual_quantity?: number | null
          actual_unit?: string | null
          created_at?: string
          custom_item_name?: string | null
          id?: string
          note?: string | null
          order_id?: string
          packs?: number
          quantity?: number
          unit?: string
          unit_price?: number | null
          vegetable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vegetable_id_fkey"
            columns: ["vegetable_id"]
            isOneToOne: false
            referencedRelation: "vegetables"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_date: string | null
          id: string
          merchant_note: string | null
          note: string | null
          order_date: string
          order_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_date?: string | null
          id?: string
          merchant_note?: string | null
          note?: string | null
          order_date?: string
          order_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_date?: string | null
          id?: string
          merchant_note?: string | null
          note?: string | null
          order_date?: string
          order_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_date: string
          payment_method: string
          settlement_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          settlement_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_vegetable_prices: {
        Row: {
          created_at: string
          id: string
          price: number
          sort_order: number
          unit: string
          vegetable_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number
          sort_order?: number
          unit?: string
          vegetable_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          sort_order?: number
          unit?: string
          vegetable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_vegetable_prices_vegetable_id_fkey"
            columns: ["vegetable_id"]
            isOneToOne: false
            referencedRelation: "retail_vegetables"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_vegetables: {
        Row: {
          created_at: string
          id: string
          is_wholesale: boolean
          name: string
          note: string | null
          price: number
          sort_order: number
          status: string
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_wholesale?: boolean
          name: string
          note?: string | null
          price?: number
          sort_order?: number
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_wholesale?: boolean
          name?: string
          note?: string | null
          price?: number
          sort_order?: number
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlement_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          note: string | null
          order_date: string | null
          order_item_id: string | null
          settlement_id: string
          settlement_quantity: number
          settlement_unit: string
          settlement_unit_price: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          note?: string | null
          order_date?: string | null
          order_item_id?: string | null
          settlement_id: string
          settlement_quantity?: number
          settlement_unit?: string
          settlement_unit_price?: number
          subtotal?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          note?: string | null
          order_date?: string | null
          order_item_id?: string | null
          settlement_id?: string
          settlement_quantity?: number
          settlement_unit?: string
          settlement_unit_price?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          note: string | null
          paid_amount: number
          period_end: string
          period_start: string
          settlement_number: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          paid_amount?: number
          period_end: string
          period_start: string
          settlement_number: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          paid_amount?: number
          period_end?: string
          period_start?: string
          settlement_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          supplier_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          supplier_name: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          supplier_name?: string
        }
        Relationships: []
      }
      tag_orders: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          tag_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          tag_name: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          tag_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vegetable_prices: {
        Row: {
          created_at: string
          id: string
          price: number
          sort_order: number
          unit: string
          vegetable_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number
          sort_order?: number
          unit?: string
          vegetable_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          sort_order?: number
          unit?: string
          vegetable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vegetable_prices_vegetable_id_fkey"
            columns: ["vegetable_id"]
            isOneToOne: false
            referencedRelation: "vegetables"
            referencedColumns: ["id"]
          },
        ]
      }
      vegetables: {
        Row: {
          created_at: string
          id: string
          is_wholesale: boolean
          name: string
          note: string | null
          price: number
          sort_order: number
          status: string
          supplier: string | null
          tag: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_wholesale?: boolean
          name: string
          note?: string | null
          price?: number
          sort_order?: number
          status?: string
          supplier?: string | null
          tag?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_wholesale?: boolean
          name?: string
          note?: string | null
          price?: number
          sort_order?: number
          status?: string
          supplier?: string | null
          tag?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      generate_settlement_number: { Args: never; Returns: string }
      get_customer_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      accounting_entry_type: "income" | "expense" | "purchase"
      app_role: "admin" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      accounting_entry_type: ["income", "expense", "purchase"],
      app_role: ["admin", "customer"],
    },
  },
} as const
