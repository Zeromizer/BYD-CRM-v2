-- ============================================
-- RBAC Migration: Role-Based Access Control
-- ============================================
-- Roles:
--   - manager: Full access + user management
--   - admin: View-only access to all data
--   - sales_consultant: Own data only (default)
-- ============================================

-- 1. Create role enum type
CREATE TYPE user_role AS ENUM ('sales_consultant', 'admin', 'manager');

-- 2. Add role column to profiles (default: sales_consultant)
ALTER TABLE profiles
ADD COLUMN role user_role NOT NULL DEFAULT 'sales_consultant';

-- 3. Add invited_by to track who invited the user
ALTER TABLE profiles
ADD COLUMN invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Create index on role for efficient filtering
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- Helper Functions for RLS
-- ============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Update handle_new_user trigger
-- Auto-assign manager role to specific email
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  manager_email TEXT := 'sgshawnlyc@gmail.com';
  new_role user_role;
BEGIN
  -- Check if email matches manager email
  IF NEW.email = manager_email THEN
    new_role := 'manager';
  ELSE
    new_role := 'sales_consultant';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    new_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Update RLS Policies: PROFILES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Managers can view all profiles (for user management)
CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (public.is_manager());

-- Users can update their own profile (but trigger prevents role change)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Managers can update any profile (for role assignment)
CREATE POLICY "Managers can update all profiles" ON profiles
  FOR UPDATE USING (public.is_manager());

-- Users can insert their own profile (via trigger)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- Update RLS Policies: CUSTOMERS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;

-- Managers: Full CRUD on all customers
CREATE POLICY "Managers full access to customers" ON customers
  FOR ALL USING (public.is_manager());

-- Admins: View-only on all customers
CREATE POLICY "Admins can view all customers" ON customers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales Consultants: CRUD on own customers only
CREATE POLICY "Sales consultants view own customers" ON customers
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

CREATE POLICY "Sales consultants insert own customers" ON customers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

CREATE POLICY "Sales consultants update own customers" ON customers
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

CREATE POLICY "Sales consultants delete own customers" ON customers
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

-- ============================================
-- Update RLS Policies: GUARANTORS
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can access guarantors through customers" ON guarantors;

-- Managers: Full access to all guarantors
CREATE POLICY "Managers full access to guarantors" ON guarantors
  FOR ALL USING (public.is_manager());

-- Admins: View-only on all guarantors
CREATE POLICY "Admins can view all guarantors" ON guarantors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales Consultants: Access through own customers
CREATE POLICY "Sales consultants access own guarantors" ON guarantors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = guarantors.customer_id
      AND customers.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant'
    )
  );

-- ============================================
-- Update RLS Policies: DOCUMENT_TEMPLATES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage own document templates" ON document_templates;

-- Managers: Full access to all templates
CREATE POLICY "Managers full access to document templates" ON document_templates
  FOR ALL USING (public.is_manager());

-- Admins: View-only on all templates
CREATE POLICY "Admins can view all document templates" ON document_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales Consultants: Manage own templates only
CREATE POLICY "Sales consultants manage own document templates" ON document_templates
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

-- ============================================
-- Update RLS Policies: EXCEL_TEMPLATES
-- ============================================

-- Drop existing policy (if exists)
DROP POLICY IF EXISTS "Users can manage own excel templates" ON excel_templates;

-- Managers: Full access to all excel templates
CREATE POLICY "Managers full access to excel templates" ON excel_templates
  FOR ALL USING (public.is_manager());

-- Admins: View-only on all excel templates
CREATE POLICY "Admins can view all excel templates" ON excel_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales Consultants: Manage own excel templates only
CREATE POLICY "Sales consultants manage own excel templates" ON excel_templates
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

-- ============================================
-- Update RLS Policies: TODOS
-- ============================================

-- Drop existing policy (if exists)
DROP POLICY IF EXISTS "Users can manage own todos" ON todos;

-- Managers: Full access to all todos
CREATE POLICY "Managers full access to todos" ON todos
  FOR ALL USING (public.is_manager());

-- Admins: View-only on all todos
CREATE POLICY "Admins can view all todos" ON todos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales Consultants: Manage own todos only
CREATE POLICY "Sales consultants manage own todos" ON todos
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_consultant')
  );

-- ============================================
-- Prevent role changes by non-managers
-- ============================================

CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only allow if current user is a manager
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Only managers can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_change();
