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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_corrections: {
        Row: {
          corrected_category: string
          created_at: string
          expense_id: string
          feedback: string | null
          id: string
          original_category: string
          user_id: string
        }
        Insert: {
          corrected_category: string
          created_at?: string
          expense_id: string
          feedback?: string | null
          id?: string
          original_category: string
          user_id: string
        }
        Update: {
          corrected_category?: string
          created_at?: string
          expense_id?: string
          feedback?: string | null
          id?: string
          original_category?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_corrections_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          active: boolean
          applied_count: number
          condition_field: string
          condition_operator: string
          condition_value: string
          created_at: string
          id: string
          target_category: string
          user_id: string
        }
        Insert: {
          active?: boolean
          applied_count?: number
          condition_field?: string
          condition_operator?: string
          condition_value: string
          created_at?: string
          id?: string
          target_category: string
          user_id: string
        }
        Update: {
          active?: boolean
          applied_count?: number
          condition_field?: string
          condition_operator?: string
          condition_value?: string
          created_at?: string
          id?: string
          target_category?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          color: string
          created_at: string
          icon: string
          id: string
          keywords: string[] | null
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          keywords?: string[] | null
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          keywords?: string[] | null
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          closing_day: number
          created_at: string
          due_day: number
          id: string
          limit_amount: number
          name: string
          user_id: string
        }
        Insert: {
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          limit_amount?: number
          name: string
          user_id: string
        }
        Update: {
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          limit_amount?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          category_ai: string | null
          created_at: string
          credit_card_id: string | null
          date: string
          description: string
          final_category: string
          frequency: string | null
          id: string
          installments: number
          is_recurring: boolean
          type: string
          user_id: string
          value: number
        }
        Insert: {
          category_ai?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description: string
          final_category: string
          frequency?: string | null
          id?: string
          installments?: number
          is_recurring?: boolean
          type?: string
          user_id: string
          value: number
        }
        Update: {
          category_ai?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description?: string
          final_category?: string
          frequency?: string | null
          id?: string
          installments?: number
          is_recurring?: boolean
          type?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ai_auto_categorize: boolean
          ai_learn_corrections: boolean
          ai_min_confidence: number
          ai_model: string
          ai_personal_context: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          currency: string
          full_name: string | null
          id: string
          notify_app_achievements: boolean
          notify_app_reminders: boolean
          notify_app_suggestions: boolean
          notify_email_alerts: boolean
          notify_email_news: boolean
          notify_email_weekly: boolean
          plan: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_auto_categorize?: boolean
          ai_learn_corrections?: boolean
          ai_min_confidence?: number
          ai_model?: string
          ai_personal_context?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          full_name?: string | null
          id?: string
          notify_app_achievements?: boolean
          notify_app_reminders?: boolean
          notify_app_suggestions?: boolean
          notify_email_alerts?: boolean
          notify_email_news?: boolean
          notify_email_weekly?: boolean
          plan?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_auto_categorize?: boolean
          ai_learn_corrections?: boolean
          ai_min_confidence?: number
          ai_model?: string
          ai_personal_context?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          full_name?: string | null
          id?: string
          notify_app_achievements?: boolean
          notify_app_reminders?: boolean
          notify_app_suggestions?: boolean
          notify_email_alerts?: boolean
          notify_email_news?: boolean
          notify_email_weekly?: boolean
          plan?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
