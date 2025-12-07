-- ============================================================================
-- HyperAgent Complete Database Schema for Supabase
-- ============================================================================
-- This script creates the complete database schema for HyperAgent
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS hyperagent;
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable required extensions in extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA extensions;  -- pgvector for embeddings

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Workflow status enum
DO $$ BEGIN
    CREATE TYPE hyperagent.workflow_status AS ENUM (
        'created', 'nlp_parsing', 'generating', 'auditing',
        'testing', 'deploying', 'completed', 'failed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS hyperagent.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    wallet_address VARCHAR(42) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Workflows table
CREATE TABLE IF NOT EXISTS hyperagent.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hyperagent.users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'created',
    progress_percentage INTEGER DEFAULT 0,
    nlp_input TEXT NOT NULL,
    nlp_tokens INTEGER,
    network VARCHAR(50) NOT NULL,
    is_testnet BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_stacktrace TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Generated contracts table
CREATE TABLE IF NOT EXISTS hyperagent.generated_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES hyperagent.workflows(id),
    contract_name VARCHAR(255) NOT NULL,
    contract_type VARCHAR(50),
    solidity_version VARCHAR(20) DEFAULT '0.8.27',
    source_code TEXT NOT NULL,
    source_code_hash VARCHAR(66),
    abi JSONB,
    bytecode TEXT,
    deployed_bytecode TEXT,
    line_count INTEGER,
    function_count INTEGER,
    security_flags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Deployments table
CREATE TABLE IF NOT EXISTS hyperagent.deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES hyperagent.generated_contracts(id),
    deployment_network VARCHAR(50) NOT NULL,
    is_testnet BOOLEAN NOT NULL,
    contract_address VARCHAR(42) UNIQUE NOT NULL,
    deployer_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    gas_used BIGINT,
    gas_price BIGINT,
    total_cost_wei BIGINT,
    deployment_status VARCHAR(50) DEFAULT 'pending',
    block_number BIGINT,
    confirmation_blocks INTEGER DEFAULT 0,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    eigenda_commitment VARCHAR(256),
    eigenda_batch_header JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Security audits table
CREATE TABLE IF NOT EXISTS hyperagent.security_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES hyperagent.generated_contracts(id),
    tool_used VARCHAR(50) NOT NULL,  -- slither, mythril, echidna
    vulnerabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_issues INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    overall_risk_score FLOAT,
    audit_status VARCHAR(50) DEFAULT 'passed',
    audit_duration_ms INTEGER,
    audit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    full_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Contract templates table (with pgvector support)
CREATE TABLE IF NOT EXISTS hyperagent.contract_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    contract_type VARCHAR(50),
    template_code TEXT NOT NULL,
    ipfs_hash VARCHAR(100) UNIQUE,
    embedding vector(1536),  -- pgvector for Gemini embeddings (1536 dimensions)
    version VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tags VARCHAR[],
    template_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON hyperagent.users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON hyperagent.users(wallet_address);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON hyperagent.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON hyperagent.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_network ON hyperagent.workflows(network);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON hyperagent.workflows(created_at);

-- Generated contracts indexes
CREATE INDEX IF NOT EXISTS idx_generated_contracts_workflow_id ON hyperagent.generated_contracts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_generated_contracts_contract_type ON hyperagent.generated_contracts(contract_type);

-- Deployments indexes
CREATE INDEX IF NOT EXISTS idx_deployments_contract_id ON hyperagent.deployments(contract_id);
CREATE INDEX IF NOT EXISTS idx_deployments_contract_address ON hyperagent.deployments(contract_address);
CREATE INDEX IF NOT EXISTS idx_deployments_transaction_hash ON hyperagent.deployments(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_deployments_network ON hyperagent.deployments(deployment_network);
CREATE INDEX IF NOT EXISTS idx_deployments_deployer_address ON hyperagent.deployments(deployer_address);

-- Security audits indexes
CREATE INDEX IF NOT EXISTS idx_security_audits_contract_id ON hyperagent.security_audits(contract_id);
CREATE INDEX IF NOT EXISTS idx_security_audits_tool_used ON hyperagent.security_audits(tool_used);
CREATE INDEX IF NOT EXISTS idx_security_audits_audit_status ON hyperagent.security_audits(audit_status);

-- Contract templates indexes
CREATE INDEX IF NOT EXISTS idx_contract_templates_contract_type ON hyperagent.contract_templates(contract_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_is_active ON hyperagent.contract_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_contract_templates_tags ON hyperagent.contract_templates USING gin(tags);

-- Vector similarity index for embeddings (pgvector)
-- This enables fast similarity search for RAG
CREATE INDEX IF NOT EXISTS idx_contract_templates_embedding 
ON hyperagent.contract_templates 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- GRANTS (Adjust based on your Supabase setup)
-- ============================================================================

-- Grant permissions to authenticated users (Supabase default)
GRANT USAGE ON SCHEMA hyperagent TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hyperagent TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hyperagent TO authenticated;

-- Grant permissions to service role (for backend access)
GRANT USAGE ON SCHEMA hyperagent TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hyperagent TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hyperagent TO service_role;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON SCHEMA hyperagent IS 'HyperAgent main schema for workflows, contracts, and deployments';
COMMENT ON TABLE hyperagent.users IS 'Platform users with wallet addresses';
COMMENT ON TABLE hyperagent.workflows IS 'AI-powered contract generation workflows';
COMMENT ON TABLE hyperagent.generated_contracts IS 'Generated Solidity contracts with ABI and bytecode';
COMMENT ON TABLE hyperagent.deployments IS 'On-chain contract deployments';
COMMENT ON TABLE hyperagent.security_audits IS 'Security audit results from Slither, Mythril, Echidna';
COMMENT ON TABLE hyperagent.contract_templates IS 'Contract templates with vector embeddings for RAG';

COMMENT ON COLUMN hyperagent.contract_templates.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search';
COMMENT ON COLUMN hyperagent.deployments.eigenda_commitment IS 'EigenDA data availability commitment (for Mantle)';
COMMENT ON COLUMN hyperagent.workflows.metadata IS 'Workflow-specific metadata and feature flags';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp function with secure search_path
CREATE OR REPLACE FUNCTION hyperagent.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = hyperagent, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Backward compatibility function
CREATE OR REPLACE FUNCTION hyperagent.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = hyperagent, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Workflow status change function with secure search_path
CREATE OR REPLACE FUNCTION hyperagent.on_workflow_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = hyperagent, audit, pg_catalog
AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO audit.event_log (user_id, event_type, resource_type, resource_id, action_description)
        VALUES (NEW.user_id, 'workflow_status_changed'::audit.event_type, 'workflow', NEW.id, 
                'Workflow status changed from ' || OLD.status || ' to ' || NEW.status);
    END IF;
    RETURN NEW;
END;
$$;

-- Auth user created function with secure search_path
CREATE OR REPLACE FUNCTION hyperagent.on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = hyperagent, pg_catalog
AS $$
BEGIN
    INSERT INTO hyperagent.users (auth_id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (auth_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
    table_name_var TEXT;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'hyperagent';
    
    RAISE NOTICE 'Created % tables in hyperagent schema', table_count;
    
    -- List all tables
    RAISE NOTICE 'Tables:';
    FOR table_name_var IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'hyperagent'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '  - %', table_name_var;
    END LOOP;
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- Schema setup complete!
-- Next steps:
-- 1. Verify tables in Supabase Dashboard → Table Editor
-- 2. Run: alembic stamp head (to mark migrations as applied)
-- 3. Or continue using Alembic for future migrations
-- ============================================================================

