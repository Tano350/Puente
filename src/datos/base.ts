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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asistentes: {
        Row: {
          desde: string
          estado: string
          evento: string
          persona: string
        }
        Insert: {
          desde?: string
          estado: string
          evento: string
          persona: string
        }
        Update: {
          desde?: string
          estado?: string
          evento?: string
          persona?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistentes_evento_fkey"
            columns: ["evento"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistentes_persona_fkey"
            columns: ["persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      calendarios: {
        Row: {
          google_id: string
          nombre: string
          permiso: string
          persona: string | null
          visto_en: string
        }
        Insert: {
          google_id: string
          nombre: string
          permiso: string
          persona?: string | null
          visto_en?: string
        }
        Update: {
          google_id?: string
          nombre?: string
          permiso?: string
          persona?: string | null
          visto_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendarios_persona_fkey"
            columns: ["persona"]
            isOneToOne: true
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          asignado_por: string | null
          canal: Database["public"]["Enums"]["canal"] | null
          creado_en: string
          creado_por: string
          dato: string | null
          etapa: Database["public"]["Enums"]["etapa"]
          etapa_en: string
          id: string
          nombre: string
          organizacion: string | null
          personal: boolean
          responsable: string
        }
        Insert: {
          asignado_por?: string | null
          canal?: Database["public"]["Enums"]["canal"] | null
          creado_en?: string
          creado_por?: string
          dato?: string | null
          etapa?: Database["public"]["Enums"]["etapa"]
          etapa_en?: string
          id?: string
          nombre: string
          organizacion?: string | null
          personal?: boolean
          responsable: string
        }
        Update: {
          asignado_por?: string | null
          canal?: Database["public"]["Enums"]["canal"] | null
          creado_en?: string
          creado_por?: string
          dato?: string | null
          etapa?: Database["public"]["Enums"]["etapa"]
          etapa_en?: string
          id?: string
          nombre?: string
          organizacion?: string | null
          personal?: boolean
          responsable?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_responsable_fkey"
            columns: ["responsable"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          cambiado_en: string
          cancelado_en: string | null
          contacto: string | null
          creado_en: string
          creado_por: string | null
          cupos: number | null
          desde_google: boolean
          direccion: string | null
          fin: string
          google_id: string | null
          id: string
          inicio: string
          lugar: string | null
          modo: Database["public"]["Enums"]["modo_evento"]
          notas: string | null
          organizador: string | null
          tipo: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
        }
        Insert: {
          cambiado_en?: string
          cancelado_en?: string | null
          contacto?: string | null
          creado_en?: string
          creado_por?: string | null
          cupos?: number | null
          desde_google?: boolean
          direccion?: string | null
          fin: string
          google_id?: string | null
          id?: string
          inicio: string
          lugar?: string | null
          modo?: Database["public"]["Enums"]["modo_evento"]
          notas?: string | null
          organizador?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
        }
        Update: {
          cambiado_en?: string
          cancelado_en?: string | null
          contacto?: string | null
          creado_en?: string
          creado_por?: string | null
          cupos?: number | null
          desde_google?: boolean
          direccion?: string | null
          fin?: string
          google_id?: string | null
          id?: string
          inicio?: string
          lugar?: string | null
          modo?: Database["public"]["Enums"]["modo_evento"]
          notas?: string | null
          organizador?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_contacto_fkey"
            columns: ["contacto"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_organizador_fkey"
            columns: ["organizador"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          autor: string
          contacto: string
          creada_en: string
          id: string
          personal: boolean
          texto: string
        }
        Insert: {
          autor?: string
          contacto: string
          creada_en?: string
          id?: string
          personal?: boolean
          texto: string
        }
        Update: {
          autor?: string
          contacto?: string
          creada_en?: string
          id?: string
          personal?: boolean
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_autor_fkey"
            columns: ["autor"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_contacto_fkey"
            columns: ["contacto"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_reunion: {
        Row: {
          aprendi: string | null
          autor: string
          escrita_en: string
          evento: string
          sigue: string | null
        }
        Insert: {
          aprendi?: string | null
          autor?: string
          escrita_en?: string
          evento: string
          sigue?: string | null
        }
        Update: {
          aprendi?: string | null
          autor?: string
          escrita_en?: string
          evento?: string
          sigue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_reunion_autor_fkey"
            columns: ["autor"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_reunion_evento_fkey"
            columns: ["evento"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      ocupados: {
        Row: {
          fin: string
          id: string
          inicio: string
          persona: string
          titulo: string
        }
        Insert: {
          fin: string
          id?: string
          inicio: string
          persona?: string
          titulo: string
        }
        Update: {
          fin?: string
          id?: string
          inicio?: string
          persona?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocupados_persona_fkey"
            columns: ["persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ocupados_google: {
        Row: {
          fin: string
          inicio: string
          persona: string
        }
        Insert: {
          fin: string
          inicio: string
          persona: string
        }
        Update: {
          fin?: string
          inicio?: string
          persona?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocupados_google_persona_fkey"
            columns: ["persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          administra: boolean
          avisos: Json
          bienvenida_en: string | null
          carrera: string | null
          correo: string
          emprendimiento: string | null
          emprendimiento_texto: string | null
          entro_en: string | null
          foto: string | null
          foto_google: string | null
          id: string
          idioma: string
          invitada_en: string
          invitada_por: string | null
          linkedin: string | null
          llega: string | null
          nombre: string | null
          objetivos: string | null
          sacada_en: string | null
          usuario: string | null
          vuelve: string | null
        }
        Insert: {
          administra?: boolean
          avisos?: Json
          bienvenida_en?: string | null
          carrera?: string | null
          correo: string
          emprendimiento?: string | null
          emprendimiento_texto?: string | null
          entro_en?: string | null
          foto?: string | null
          foto_google?: string | null
          id?: string
          idioma?: string
          invitada_en?: string
          invitada_por?: string | null
          linkedin?: string | null
          llega?: string | null
          nombre?: string | null
          objetivos?: string | null
          sacada_en?: string | null
          usuario?: string | null
          vuelve?: string | null
        }
        Update: {
          administra?: boolean
          avisos?: Json
          bienvenida_en?: string | null
          carrera?: string | null
          correo?: string
          emprendimiento?: string | null
          emprendimiento_texto?: string | null
          entro_en?: string | null
          foto?: string | null
          foto_google?: string | null
          id?: string
          idioma?: string
          invitada_en?: string
          invitada_por?: string | null
          linkedin?: string | null
          llega?: string | null
          nombre?: string | null
          objetivos?: string | null
          sacada_en?: string | null
          usuario?: string | null
          vuelve?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personas_invitada_por_fkey"
            columns: ["invitada_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizacion: {
        Row: {
          activa: boolean
          errores: number
          ultima_vez: string | null
          unica: boolean
        }
        Insert: {
          activa?: boolean
          errores?: number
          ultima_vez?: string | null
          unica?: boolean
        }
        Update: {
          activa?: boolean
          errores?: number
          ultima_vez?: string | null
          unica?: boolean
        }
        Relationships: []
      }
      suscripciones: {
        Row: {
          auth: string
          creada_en: string
          endpoint: string
          p256dh: string
          persona: string
        }
        Insert: {
          auth: string
          creada_en?: string
          endpoint: string
          p256dh: string
          persona: string
        }
        Update: {
          auth?: string
          creada_en?: string
          endpoint?: string
          p256dh?: string
          persona?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_persona_fkey"
            columns: ["persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      administro: { Args: never; Returns: boolean }
      antes_de_crear_usuario: { Args: { event: Json }; Returns: Json }
      asignar_calendario: {
        Args: { google_id: string; persona: string }
        Returns: undefined
      }
      buscar_calendarios: { Args: never; Returns: undefined }
      calendario_conectado: { Args: never; Returns: boolean }
      calendarios_del_viaje: {
        Args: never
        Returns: {
          google_id: string
          nombre: string
          permiso: string
          persona: string | null
          visto_en: string
        }[]
        SetofOptions: {
          from: "*"
          to: "calendarios"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      devolver: { Args: { persona: string }; Returns: undefined }
      esperar: { Args: { evento: string }; Returns: number }
      esta_alla: {
        Args: { momento: string; persona: string }
        Returns: boolean
      }
      estado_sincronizacion: {
        Args: never
        Returns: {
          activa: boolean
          errores: number
          ultima_vez: string | null
          unica: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "sincronizacion"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      guardar_acceso_google: { Args: { llave: string }; Returns: undefined }
      invitar: {
        Args: { correo_nuevo: string }
        Returns: {
          administra: boolean
          avisos: Json
          bienvenida_en: string | null
          carrera: string | null
          correo: string
          emprendimiento: string | null
          emprendimiento_texto: string | null
          entro_en: string | null
          foto: string | null
          foto_google: string | null
          id: string
          idioma: string
          invitada_en: string
          invitada_por: string | null
          linkedin: string | null
          llega: string | null
          nombre: string | null
          objetivos: string | null
          sacada_en: string | null
          usuario: string | null
          vuelve: string | null
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ir: { Args: { evento: string }; Returns: string }
      libres: {
        Args: { desde: string; hasta: string }
        Returns: {
          alla: number
          libres: number
        }[]
      }
      llenar_cupos: { Args: { evento: string }; Returns: undefined }
      mi_persona: { Args: never; Returns: string }
      no_ir: { Args: { evento: string }; Returns: undefined }
      pulso: { Args: never; Returns: string }
      sacar: { Args: { persona: string }; Returns: undefined }
      sacar_de_evento: {
        Args: { evento: string; persona: string }
        Returns: undefined
      }
      sincronizar_calendarios: { Args: { activa: boolean }; Returns: undefined }
      sumar_a_evento: {
        Args: { evento: string; persona: string }
        Returns: undefined
      }
    }
    Enums: {
      canal: "correo" | "linkedin" | "telefono"
      etapa:
        | "por_contactar"
        | "contactado"
        | "respondio"
        | "reunion_agendada"
        | "reunion_hecha"
        | "descartado"
      modo_evento: "para_todos" | "con_cupo" | "cerrado"
      tipo_evento: "visita" | "reunion" | "comida" | "otro"
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
      canal: ["correo", "linkedin", "telefono"],
      etapa: [
        "por_contactar",
        "contactado",
        "respondio",
        "reunion_agendada",
        "reunion_hecha",
        "descartado",
      ],
      modo_evento: ["para_todos", "con_cupo", "cerrado"],
      tipo_evento: ["visita", "reunion", "comida", "otro"],
    },
  },
} as const
