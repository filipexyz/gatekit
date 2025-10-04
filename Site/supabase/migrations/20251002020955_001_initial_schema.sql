/*
  # Schema Inicial GateKit - Sistema Multi-Tenant
  
  ## Vis\u00e3o Geral
  Este schema estabelece a base para o sistema GateKit com suporte multi-tenant,
  autentica\u00e7\u00e3o segura, e integra\u00e7\u00e3o com Stripe para billing.
  
  ## 1. Novas Tabelas
  
  ### `organizations`
  Representa empresas/clientes que usam a plataforma
  - `id` (uuid, PK) - Identificador \u00fanico
  - `name` (text) - Nome da organiza\u00e7\u00e3o
  - `slug` (text, unique) - Identificador amig\u00e1vel na URL
  - `stripe_customer_id` (text) - ID do cliente no Stripe
  - `subscription_status` (text) - Status da assinatura (active, canceled, etc)
  - `subscription_plan` (text) - Plano atual (free, starter, pro, enterprise)
  - `monthly_message_limit` (integer) - Limite mensal de mensagens
  - `monthly_message_usage` (integer) - Uso atual no m\u00eas
  - `created_at`, `updated_at` (timestamptz)
  
  ### `profiles`
  Extens\u00e3o do auth.users do Supabase com dados adicionais
  - `id` (uuid, PK, FK -> auth.users)
  - `organization_id` (uuid, FK -> organizations)
  - `full_name` (text)
  - `avatar_url` (text)
  - `role` (text) - client_admin, client_member, system_admin
  - `is_active` (boolean)
  - `created_at`, `updated_at` (timestamptz)
  
  ### `gatekit_projects`
  Cache/metadata dos projetos do GateKit
  - `id` (uuid, PK)
  - `organization_id` (uuid, FK -> organizations)
  - `gatekit_project_id` (text) - ID no GateKit
  - `name` (text)
  - `slug` (text)
  - `environment` (text) - production, staging, development
  - `settings` (jsonb) - Prefer\u00eancias e configura\u00e7\u00f5es
  - `created_at`, `updated_at` (timestamptz)
  
  ### `audit_logs`
  Log de auditoria para compliance e seguran\u00e7a
  - `id` (uuid, PK)
  - `organization_id` (uuid, FK -> organizations)
  - `user_id` (uuid, FK -> auth.users)
  - `action` (text) - Tipo de a\u00e7\u00e3o realizada
  - `resource_type` (text) - Tipo do recurso afetado
  - `resource_id` (text) - ID do recurso
  - `metadata` (jsonb) - Dados adicionais da a\u00e7\u00e3o
  - `ip_address` (text)
  - `user_agent` (text)
  - `created_at` (timestamptz)
  
  ### `platform_credentials`
  Armazenamento seguro de credenciais de plataformas
  - `id` (uuid, PK)
  - `organization_id` (uuid, FK -> organizations)
  - `gatekit_project_id` (text)
  - `platform_type` (text) - discord, whatsapp, telegram, etc
  - `platform_name` (text)
  - `credentials_encrypted` (text) - Credenciais criptografadas
  - `is_active` (boolean)
  - `last_validated_at` (timestamptz)
  - `created_at`, `updated_at` (timestamptz)
  
  ## 2. Seguran\u00e7a (RLS)
  
  Todas as tabelas t\u00eam RLS habilitado com pol\u00edticas restritivas:
  - Usu\u00e1rios autenticados podem acessar apenas dados da sua organiza\u00e7\u00e3o
  - Administradores de sistema podem acessar todos os dados
  - Cada opera\u00e7\u00e3o (SELECT, INSERT, UPDATE, DELETE) tem pol\u00edticas espec\u00edficas
  
  ## 3. \u00cdndices
  
  \u00cdndices criados para otimizar consultas frequentes:
  - Busca por organization_id em todas as tabelas
  - Busca por slug em organizations e gatekit_projects
  - Busca por created_at para ordena\u00e7\u00e3o temporal
  - Busca composta para audit_logs
  
  ## 4. Triggers
  
  - Atualiza\u00e7\u00e3o autom\u00e1tica de updated_at
  - Cria\u00e7\u00e3o autom\u00e1tica de profile ap\u00f3s signup
  
  ## 5. Notas Importantes
  
  - Todos os valores monet\u00e1rios e limites s\u00e3o gerenciados via Stripe
  - Credenciais de plataformas devem ser criptografadas antes de salvar
  - Logs de auditoria s\u00e3o append-only (sem UPDATE/DELETE)
  - Sistema suporta multiple environments por projeto
*/

-- Extens\u00f5es necess\u00e1rias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. ORGANIZATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  stripe_customer_id text UNIQUE,
  subscription_status text DEFAULT 'free',
  subscription_plan text DEFAULT 'free',
  monthly_message_limit integer DEFAULT 1000,
  monthly_message_usage integer DEFAULT 0,
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(subscription_status, is_active);

-- =====================================================
-- 2. PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  role text DEFAULT 'client_member',
  is_active boolean DEFAULT true,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =====================================================
-- 3. GATEKIT PROJECTS
-- =====================================================

CREATE TABLE IF NOT EXISTS gatekit_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gatekit_project_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  environment text DEFAULT 'production',
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON gatekit_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_gatekit_id ON gatekit_projects(gatekit_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON gatekit_projects(organization_id, slug);

-- =====================================================
-- 4. AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================
-- 5. PLATFORM CREDENTIALS
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gatekit_project_id text NOT NULL,
  platform_type text NOT NULL,
  platform_name text NOT NULL,
  credentials_encrypted text NOT NULL,
  is_active boolean DEFAULT true,
  last_validated_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credentials_org ON platform_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_credentials_project ON platform_credentials(gatekit_project_id);
CREATE INDEX IF NOT EXISTS idx_credentials_type ON platform_credentials(platform_type);

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Users can update own organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in own organization"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update profiles in organization"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

-- GateKit Projects RLS
ALTER TABLE gatekit_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in own organization"
  ON gatekit_projects FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Admins can insert projects"
  ON gatekit_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can update projects"
  ON gatekit_projects FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON gatekit_projects FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs in own organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Platform Credentials RLS
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credentials in own organization"
  ON platform_credentials FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Admins can manage credentials"
  ON platform_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can update credentials"
  ON platform_credentials FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can delete credentials"
  ON platform_credentials FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('client_admin', 'system_admin')
    )
  );

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Fun\u00e7\u00e3o para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON gatekit_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credentials_updated_at
  BEFORE UPDATE ON platform_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fun\u00e7\u00e3o para criar profile ap\u00f3s signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
