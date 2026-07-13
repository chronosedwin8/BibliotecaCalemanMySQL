export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'teacher' | 'student'
          codigo_identificacion: string | null
          telefono: string | null
          estado: 'activo' | 'inactivo' | 'suspendido'
          avatar_url: string | null
          section: string | null
          course: string | null
          level: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'teacher' | 'student'
          codigo_identificacion?: string | null
          telefono?: string | null
          estado?: 'activo' | 'inactivo' | 'suspendido'
          avatar_url?: string | null
          section?: string | null
          course?: string | null
          level?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'teacher' | 'student'
          codigo_identificacion?: string | null
          telefono?: string | null
          estado?: 'activo' | 'inactivo' | 'suspendido'
          avatar_url?: string | null
          section?: string | null
          course?: string | null
          level?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: number
          nombre: string
          descripcion: string | null
          color_hex: string
          created_at: string
        }
        Insert: {
          id?: number
          nombre: string
          descripcion?: string | null
          color_hex?: string
          created_at?: string
        }
        Update: {
          id?: number
          nombre?: string
          descripcion?: string | null
          color_hex?: string
          created_at?: string
        }
      }
      locations: {
        Row: {
          id: number
          shelf_name: string
          section: string | null
          row: string | null
          capacity: number
          current_occupancy: number
          created_at: string
        }
        Insert: {
          id?: number
          shelf_name: string
          section?: string | null
          row?: string | null
          capacity?: number
          current_occupancy?: number
          created_at?: string
        }
        Update: {
          id?: number
          shelf_name?: string
          section?: string | null
          row?: string | null
          capacity?: number
          current_occupancy?: number
          created_at?: string
        }
      }
      books: {
        Row: {
          id: string
          titulo: string
          autor: string
          isbn: string | null
          editorial: string | null
          anio_publicacion: number | null
          categoria_id: number | null
          ubicacion_id: number | null
          cantidad_total: number
          cantidad_disponible: number
          codigo_barras: string | null
          imagen_portada_url: string | null
          estado: 'disponible' | 'prestado' | 'dañado' | 'perdido'
          created_at: string
          // Extended fields from Biblioteca_Consolidada.xlsx
          coleccion: string | null
          numero_inventario: string | null
          fecha_ingreso: string | null
          formato_material: string | null
          idioma: string | null
          numero_clasificacion: string | null
          titulo_paralelo: string | null
          numero_ejemplar: number | null
          lugar_publicacion: string | null
          mencion_serie: string | null
          numero_paginas: string | null
          terminos_tematicos: string | null
          fecha_adquisicion: string | null
          precio: number | null
          orden_compra: string | null
          nota: string | null
          resena: string | null
        }
        Insert: {
          id?: string
          titulo: string
          autor: string
          isbn?: string | null
          editorial?: string | null
          anio_publicacion?: number | null
          categoria_id?: number | null
          ubicacion_id?: number | null
          cantidad_total?: number
          cantidad_disponible?: number
          codigo_barras?: string | null
          imagen_portada_url?: string | null
          estado?: 'disponible' | 'prestado' | 'dañado' | 'perdido'
          created_at?: string
          // Extended fields from Biblioteca_Consolidada.xlsx
          coleccion?: string | null
          numero_inventario?: string | null
          fecha_ingreso?: string | null
          formato_material?: string | null
          idioma?: string | null
          numero_clasificacion?: string | null
          titulo_paralelo?: string | null
          numero_ejemplar?: number | null
          lugar_publicacion?: string | null
          mencion_serie?: string | null
          numero_paginas?: string | null
          terminos_tematicos?: string | null
          fecha_adquisicion?: string | null
          precio?: number | null
          orden_compra?: string | null
          nota?: string | null
          resena?: string | null
        }
        Update: {
          id?: string
          titulo?: string
          autor?: string
          isbn?: string | null
          editorial?: string | null
          anio_publicacion?: number | null
          categoria_id?: number | null
          ubicacion_id?: number | null
          cantidad_total?: number
          cantidad_disponible?: number
          codigo_barras?: string | null
          imagen_portada_url?: string | null
          estado?: 'disponible' | 'prestado' | 'dañado' | 'perdido'
          created_at?: string
          // Extended fields from Biblioteca_Consolidada.xlsx
          coleccion?: string | null
          numero_inventario?: string | null
          fecha_ingreso?: string | null
          formato_material?: string | null
          idioma?: string | null
          numero_clasificacion?: string | null
          titulo_paralelo?: string | null
          numero_ejemplar?: number | null
          lugar_publicacion?: string | null
          mencion_serie?: string | null
          numero_paginas?: string | null
          terminos_tematicos?: string | null
          fecha_adquisicion?: string | null
          precio?: number | null
          orden_compra?: string | null
          nota?: string | null
          resena?: string | null
        }
      }
      loans: {
        Row: {
          id: string
          libro_id: string
          usuario_id: string
          fecha_prestamo: string
          fecha_devolucion_estimada: string
          fecha_devolucion_real: string | null
          estado: 'active' | 'returned' | 'overdue'
          renovaciones: number
          created_at: string
        }
        Insert: {
          id?: string
          libro_id: string
          usuario_id: string
          fecha_prestamo?: string
          fecha_devolucion_estimada: string
          fecha_devolucion_real?: string | null
          estado?: 'active' | 'returned' | 'overdue'
          renovaciones?: number
          created_at?: string
        }
        Update: {
          id?: string
          libro_id?: string
          usuario_id?: string
          fecha_prestamo?: string
          fecha_devolucion_estimada?: string
          fecha_devolucion_real?: string | null
          estado?: 'active' | 'returned' | 'overdue'
          renovaciones?: number
          created_at?: string
        }
      }
      reservas: {
        Row: {
          id: string
          libro_id: string
          usuario_id: string
          fecha_reserva: string
          fecha_expiracion: string
          estado: 'pendiente' | 'completada' | 'cancelada' | 'expirada'
          created_at: string
        }
        Insert: {
          id?: string
          libro_id: string
          usuario_id: string
          fecha_reserva?: string
          fecha_expiracion: string
          estado?: 'pendiente' | 'completada' | 'cancelada' | 'expirada'
          created_at?: string
        }
        Update: {
          id?: string
          libro_id?: string
          usuario_id?: string
          fecha_reserva?: string
          fecha_expiracion?: string
          estado?: 'pendiente' | 'completada' | 'cancelada' | 'expirada'
          created_at?: string
        }
      }
      multas: {
        Row: {
          id: string
          prestamo_id: string | null
          usuario_id: string
          monto: number
          motivo: string | null
          estado: 'pendiente' | 'pagada' | 'condonada'
          fecha_generacion: string
          fecha_pago: string | null
        }
        Insert: {
          id?: string
          prestamo_id?: string | null
          usuario_id: string
          monto: number
          motivo?: string | null
          estado?: 'pendiente' | 'pagada' | 'condonada'
          fecha_generacion?: string
          fecha_pago?: string | null
        }
        Update: {
          id?: string
          prestamo_id?: string | null
          usuario_id?: string
          monto?: number
          motivo?: string | null
          estado?: 'pendiente' | 'pagada' | 'condonada'
          fecha_generacion?: string
          fecha_pago?: string | null
        }
      }
      notificaciones: {
        Row: {
          id: string
          usuario_id: string
          tipo: string
          mensaje: string
          leida: boolean
          created_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          tipo: string
          mensaje: string
          leida?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          tipo?: string
          mensaje?: string
          leida?: boolean
          created_at?: string
        }
      }
      configuracion_sistema: {
        Row: {
          id: number
          clave: string
          valor: string
          tipo_dato: string | null
          descripcion: string | null
        }
        Insert: {
          id?: number
          clave: string
          valor: string
          tipo_dato?: string | null
          descripcion?: string | null
        }
        Update: {
          id?: number
          clave?: string
          valor?: string
          tipo_dato?: string | null
          descripcion?: string | null
        }
      }
      cached_books: {
        Row: {
          id: string
          query: string
          results: Json
          cached_at: string
        }
        Insert: {
          id?: string
          query: string
          results: Json
          cached_at?: string
        }
        Update: {
          id?: string
          query?: string
          results?: Json
          cached_at?: string
        }
      }
      cached_recommendations: {
        Row: {
          id: string
          results: Json
          cached_at: string
        }
        Insert: {
          id?: string
          results: Json
          cached_at?: string
        }
        Update: {
          id?: string
          results?: Json
          cached_at?: string
        }
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
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
