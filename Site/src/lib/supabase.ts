import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Credenciais do Supabase não encontradas');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          stripe_customer_id: string | null;
          subscription_status: string;
          subscription_plan: string;
          monthly_message_limit: number;
          monthly_message_usage: number;
          settings: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          stripe_customer_id?: string | null;
          subscription_status?: string;
          subscription_plan?: string;
          monthly_message_limit?: number;
          monthly_message_usage?: number;
          settings?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          stripe_customer_id?: string | null;
          subscription_status?: string;
          subscription_plan?: string;
          monthly_message_limit?: number;
          monthly_message_usage?: number;
          settings?: Record<string, any>;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: string;
          is_active: boolean;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
          is_active?: boolean;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
          is_active?: boolean;
          preferences?: Record<string, any>;
          updated_at?: string;
        };
      };
      gatekit_projects: {
        Row: {
          id: string;
          organization_id: string;
          gatekit_project_id: string;
          name: string;
          slug: string;
          environment: string;
          settings: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          gatekit_project_id: string;
          name: string;
          slug: string;
          environment?: string;
          settings?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          gatekit_project_id?: string;
          name?: string;
          slug?: string;
          environment?: string;
          settings?: Record<string, any>;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Record<string, any>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Record<string, any>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      platform_credentials: {
        Row: {
          id: string;
          organization_id: string;
          gatekit_project_id: string;
          platform_type: string;
          platform_name: string;
          credentials_encrypted: string;
          is_active: boolean;
          last_validated_at: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          gatekit_project_id: string;
          platform_type: string;
          platform_name: string;
          credentials_encrypted: string;
          is_active?: boolean;
          last_validated_at?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          platform_type?: string;
          platform_name?: string;
          credentials_encrypted?: string;
          is_active?: boolean;
          last_validated_at?: string | null;
          metadata?: Record<string, any>;
          updated_at?: string;
        };
      };
    };
  };
};
