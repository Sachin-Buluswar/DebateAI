export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audio_recordings: {
        Row: {
          audio_url: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          phase: string
          session_id: string | null
          speaker_id: string
          speaker_name: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          phase: string
          session_id?: string | null
          speaker_id: string
          speaker_name: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          phase?: string
          session_id?: string | null
          speaker_id?: string
          speaker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_feedback: {
        Row: {
          created_at: string | null
          debate_id: string
          feedback_text: string | null
          id: string
          rating: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          debate_id: string
          feedback_text?: string | null
          id?: string
          rating?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          debate_id?: string
          feedback_text?: string | null
          id?: string
          rating?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_feedback_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_history: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          title: string
          transcript: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          transcript?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          transcript?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      debate_sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          has_ai_partner: boolean
          id: string
          last_saved_at: string | null
          saved_state: Json | null
          started_at: string | null
          status: string | null
          topic: string
          user_id: string | null
          user_side: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          has_ai_partner?: boolean
          id?: string
          last_saved_at?: string | null
          saved_state?: Json | null
          started_at?: string | null
          status?: string | null
          topic: string
          user_id?: string | null
          user_side: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          has_ai_partner?: boolean
          id?: string
          last_saved_at?: string | null
          saved_state?: Json | null
          started_at?: string | null
          status?: string | null
          topic?: string
          user_id?: string | null
          user_side?: string
        }
        Relationships: []
      }
      debate_speeches: {
        Row: {
          audio_url: string | null
          created_at: string | null
          id: string
          phase: string
          session_id: string | null
          speaker_id: string
          speaker_name: string
          speech_text: string
          timestamp: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          id?: string
          phase: string
          session_id?: string | null
          speaker_id: string
          speaker_name: string
          speech_text: string
          timestamp?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          id?: string
          phase?: string
          session_id?: string | null
          speaker_id?: string
          speaker_name?: string
          speech_text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_speeches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      debates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          status: string | null
          title: string
          topic: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title: string
          topic: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      health_check: {
        Row: {
          created_at: string | null
          id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string | null
          id: string
          query: string
          results: Json
          results_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          query: string
          results?: Json
          results_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          query?: string
          results?: Json
          results_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      speech_feedback: {
        Row: {
          audio_url: string | null
          created_at: string | null
          custom_instructions: string | null
          debate_id: string | null
          duration_seconds: number | null
          feedback: Json
          file_path: string | null
          file_size_bytes: number | null
          id: string
          overall_score: number | null
          recording_id: string | null
          skill_level: string | null
          speech_type: string | null
          speech_types: string | null
          topic: string
          transcription: string | null
          updated_at: string | null
          user_id: string
          user_side: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          debate_id?: string | null
          duration_seconds?: number | null
          feedback: Json
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          overall_score?: number | null
          recording_id?: string | null
          skill_level?: string | null
          speech_type?: string | null
          speech_types?: string | null
          topic: string
          transcription?: string | null
          updated_at?: string | null
          user_id: string
          user_side?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          debate_id?: string | null
          duration_seconds?: number | null
          feedback?: Json
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          overall_score?: number | null
          recording_id?: string | null
          skill_level?: string | null
          speech_type?: string | null
          speech_types?: string | null
          topic?: string
          transcription?: string | null
          updated_at?: string | null
          user_id?: string
          user_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speech_feedback_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_feedback_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "speech_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_recordings: {
        Row: {
          created_at: string | null
          debate_id: string | null
          description: string | null
          duration: number | null
          id: string
          recording_url: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          debate_id?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          recording_url?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          debate_id?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          recording_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speech_recordings_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          preferences: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          preferences?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          preferences?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
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