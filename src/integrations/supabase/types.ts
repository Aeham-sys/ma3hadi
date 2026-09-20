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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          id: number
          price_monthly: number
          price_yearly: number
          shamcash_qr_url: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          price_monthly?: number
          price_yearly?: number
          shamcash_qr_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          price_monthly?: number
          price_yearly?: number
          shamcash_qr_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          branch: string | null
          created_at: string
          grade: string | null
          id: string
          institute_id: string
          name: string
          price: number
          stage: string | null
          teacher_id: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          institute_id: string
          name: string
          price?: number
          stage?: string | null
          teacher_id?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          institute_id?: string
          name?: string
          price?: number
          stage?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      institutes: {
        Row: {
          created_at: string
          id: string
          language: string
          name: string
          onboarding_completed: boolean
          owner_email: string | null
          owner_id: string
          phone: string | null
          reminder_template: string
          subscription_end: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          theme: string
          trial_end: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          onboarding_completed?: boolean
          owner_email?: string | null
          owner_id: string
          phone?: string | null
          reminder_template?: string
          subscription_end?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          theme?: string
          trial_end?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          onboarding_completed?: boolean
          owner_email?: string | null
          owner_id?: string
          phone?: string | null
          reminder_template?: string
          subscription_end?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          theme?: string
          trial_end?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string
          date: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          created_at: string
          id: string
          image_url: string
          institute_id: string
          months: number
          plan: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          user_email: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          image_url: string
          institute_id: string
          months?: number
          plan: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          user_email?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          image_url?: string
          institute_id?: string
          months?: number
          plan?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          name: string
          start_time: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          name: string
          start_time: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_courses: {
        Row: {
          course_id: string
          created_at: string
          custom_fee: number | null
          id: string
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          custom_fee?: number | null
          id?: string
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          custom_fee?: number | null
          id?: string
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_courses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          branch: string | null
          created_at: string
          enrollment_date: string
          father_name: string | null
          grade: string | null
          guardian_phone: string | null
          id: string
          institute_id: string
          mother_name: string | null
          name: string
          phone: string | null
          stage: string | null
          surname: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          enrollment_date?: string
          father_name?: string | null
          grade?: string | null
          guardian_phone?: string | null
          id?: string
          institute_id: string
          mother_name?: string | null
          name: string
          phone?: string | null
          stage?: string | null
          surname?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          enrollment_date?: string
          father_name?: string | null
          grade?: string | null
          guardian_phone?: string | null
          id?: string
          institute_id?: string
          mother_name?: string | null
          name?: string
          phone?: string | null
          stage?: string | null
          surname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          price: number | null
          teacher_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          price?: number | null
          teacher_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          price?: number | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          teacher_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          institute_id: string
          name: string
          phone: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          institute_id: string
          name: string
          phone?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          institute_id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_course_fk"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_subscription: {
        Args: {
          p_cancel?: boolean
          p_days?: number
          p_institute_id: string
          p_months?: number
        }
        Returns: string
      }
      approve_receipt: {
        Args: { p_receipt_id: string }
        Returns: {
          institute_id: string
          receipt_id: string
          subscription_end: string
        }[]
      }
      get_payment_settings: {
        Args: never
        Returns: {
          price_monthly: number
          price_yearly: number
          shamcash_qr_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      my_institute_id: { Args: never; Returns: string }
      plan_months: { Args: { _plan: string }; Returns: number }
      plan_price: { Args: { _plan: string }; Returns: number }
      reject_receipt: { Args: { p_receipt_id: string }; Returns: string }
      subscription_allowed: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_method: "cash" | "shamcash" | "transfer"
      receipt_status: "pending" | "confirmed" | "cancelled"
      subscription_status:
        | "trial"
        | "active"
        | "grace"
        | "expired"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
      payment_method: ["cash", "shamcash", "transfer"],
      receipt_status: ["pending", "confirmed", "cancelled"],
      subscription_status: ["trial", "active", "grace", "expired", "cancelled"],
    },
  },
} as const
