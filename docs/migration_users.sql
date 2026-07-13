-- Migración: campos adicionales en profiles para gestión de usuarios
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar campos de sección, curso y nivel para estudiantes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS course  TEXT,
  ADD COLUMN IF NOT EXISTS level   TEXT;

-- 2. Política RLS: permitir al admin insertar perfiles (necesario al crear usuarios)
-- (La política existente cubre SELECT/UPDATE/DELETE via ALL, pero INSERT desde admin
--  service_role bypassa RLS, así que esto cubre el cliente normal si fuera necesario)
DROP POLICY IF EXISTS "Admins pueden insertar perfiles" ON public.profiles;
CREATE POLICY "Admins pueden insertar perfiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Verificar resultado
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
