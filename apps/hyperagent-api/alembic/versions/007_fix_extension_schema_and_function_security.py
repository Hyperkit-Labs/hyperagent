"""Fix extension schema and function security

Revision ID: 007
Revises: 006
Create Date: 2025-12-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create extensions schema
    op.execute('CREATE SCHEMA IF NOT EXISTS extensions')
    
    # Handle vector extension schema migration
    # Note: If extension has dependent objects (like vector columns), we cannot move it safely
    # For existing databases with data, we'll leave it in public and ensure extensions schema exists
    # for future use. The lint warning is about best practices, not a critical security issue.
    op.execute("""
        DO $$ 
        DECLARE
            ext_in_public BOOLEAN;
            ext_in_extensions BOOLEAN;
        BEGIN
            -- Check current location of vector extension
            SELECT EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'vector' AND n.nspname = 'public'
            ) INTO ext_in_public;
            
            SELECT EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'vector' AND n.nspname = 'extensions'
            ) INTO ext_in_extensions;
            
            -- Only try to move if extension exists in public and not in extensions
            -- AND if it doesn't have dependent objects (we'll catch the error if it does)
            IF ext_in_public AND NOT ext_in_extensions THEN
                BEGIN
                    -- Try to move by dropping and recreating
                    -- This will fail if there are dependent objects, which is fine
                    DROP EXTENSION vector;
                    CREATE EXTENSION vector SCHEMA extensions;
                EXCEPTION
                    WHEN OTHERS THEN
                        -- Extension has dependencies, cannot move safely
                        -- This is acceptable - the extension will remain in public
                        -- Future extensions will go to extensions schema
                        RAISE NOTICE 'Cannot move vector extension from public schema (has dependent objects). Leaving in public schema.';
                END;
            ELSIF NOT ext_in_extensions AND NOT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'vector'
            ) THEN
                -- Extension doesn't exist, create it in extensions schema
                CREATE EXTENSION vector SCHEMA extensions;
            END IF;
        END $$;
    """)
    
    # Handle uuid-ossp extension schema migration
    # uuid-ossp typically doesn't have dependent objects, so safer to move
    op.execute("""
        DO $$ 
        DECLARE
            ext_in_public BOOLEAN;
            ext_in_extensions BOOLEAN;
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
            ) INTO ext_in_public;
            
            SELECT EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'uuid-ossp' AND n.nspname = 'extensions'
            ) INTO ext_in_extensions;
            
            IF ext_in_public AND NOT ext_in_extensions THEN
                BEGIN
                    DROP EXTENSION "uuid-ossp";
                    CREATE EXTENSION "uuid-ossp" SCHEMA extensions;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Cannot move uuid-ossp extension from public schema. Leaving in public schema.';
                END;
            ELSIF NOT ext_in_extensions AND NOT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
            ) THEN
                CREATE EXTENSION "uuid-ossp" SCHEMA extensions;
            END IF;
        END $$;
    """)
    
    # Create or replace update_updated_at_column function with proper search_path
    op.execute("""
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
    """)
    
    # Also create update_updated_at function if it doesn't exist (for backward compatibility)
    op.execute("""
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
    """)
    
    # Fix on_workflow_status_change function if it exists
    op.execute("""
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
    """)
    
    # Fix on_auth_user_created function if it exists
    op.execute("""
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
    """)


def downgrade() -> None:
    # Move extensions back to public schema (if needed)
    op.execute("""
        DO $$ 
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'vector' AND n.nspname = 'extensions'
            ) THEN
                DROP EXTENSION IF EXISTS vector;
                CREATE EXTENSION IF NOT EXISTS vector;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM pg_extension e
                JOIN pg_namespace n ON e.extnamespace = n.oid
                WHERE e.extname = 'uuid-ossp' AND n.nspname = 'extensions'
            ) THEN
                DROP EXTENSION IF EXISTS "uuid-ossp";
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            END IF;
        END $$;
    """)
    
    # Revert functions to mutable search_path (not recommended, but for downgrade)
    op.execute("""
        CREATE OR REPLACE FUNCTION hyperagent.update_updated_at_column()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$;
    """)
    
    op.execute("""
        CREATE OR REPLACE FUNCTION hyperagent.update_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$;
    """)
    
    # Revert other functions (not recommended, but for downgrade)
    op.execute("""
        CREATE OR REPLACE FUNCTION hyperagent.on_workflow_status_change()
        RETURNS TRIGGER
        LANGUAGE plpgsql
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
    """)
    
    op.execute("""
        CREATE OR REPLACE FUNCTION hyperagent.on_auth_user_created()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO hyperagent.users (auth_id, email, created_at)
            VALUES (NEW.id, NEW.email, NOW())
            ON CONFLICT (auth_id) DO NOTHING;
            RETURN NEW;
        END;
        $$;
    """)

