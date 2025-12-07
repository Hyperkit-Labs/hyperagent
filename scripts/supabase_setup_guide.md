# Supabase Database Setup Guide

## Quick Setup

### Option 1: Run Complete Schema SQL (Recommended)

1. **Open Supabase SQL Editor**
   - Go to Supabase Dashboard → SQL Editor
   - Click "New Query"

2. **Copy and Run Schema**
   ```sql
   -- Copy entire contents of scripts/supabase_complete_schema.sql
   -- Paste into SQL Editor
   -- Click "Run" or press Ctrl+Enter
   ```

3. **Verify Tables**
   - Go to Table Editor
   - You should see 6 tables in `hyperagent` schema:
     - users
     - workflows
     - generated_contracts
     - deployments
     - security_audits
     - contract_templates

4. **Mark Alembic as Up-to-Date**
   ```bash
   alembic stamp head
   ```
   This tells Alembic that all migrations are already applied.

### Option 2: Use Alembic Migrations (Alternative)

If you prefer to use Alembic migrations:

1. **Fix the duplicate table issue first:**
   ```bash
   # Check current migration state
   alembic current
   
   # If contract_templates already exists, you can:
   # Option A: Drop and recreate (if no important data)
   # Option B: Manually mark migration as applied
   ```

2. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

## Schema Overview

### Tables Created

1. **users** - Platform users
   - id, email, username, wallet_address
   - Links to workflows

2. **workflows** - AI contract generation workflows
   - id, user_id, nlp_input, network, status
   - Tracks workflow progress

3. **generated_contracts** - Generated Solidity contracts
   - id, workflow_id, source_code, abi, bytecode
   - Stores compiled contract data

4. **deployments** - On-chain deployments
   - id, contract_id, contract_address, transaction_hash
   - Tracks deployment status

5. **security_audits** - Security audit results
   - id, contract_id, tool_used, vulnerabilities
   - Stores Slither/Mythril/Echidna results

6. **contract_templates** - Contract templates with embeddings
   - id, name, template_code, embedding (vector)
   - Used for RAG similarity search

### Extensions

- **uuid-ossp** - UUID generation
- **vector** (pgvector) - Vector embeddings for similarity search

### Indexes

- Standard indexes on foreign keys and common queries
- Vector index on `contract_templates.embedding` for fast similarity search

## Troubleshooting

### Error: "relation already exists"

If you get duplicate table errors:

```sql
-- Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'hyperagent';

-- If tables exist, you can either:
-- 1. Drop and recreate (if no important data)
-- 2. Use IF NOT EXISTS (already in script)
-- 3. Mark Alembic as up-to-date: alembic stamp head
```

### Error: "extension vector does not exist"

Supabase should have pgvector enabled by default. If not:

1. Go to Supabase Dashboard → Database → Extensions
2. Enable "vector" extension
3. Or contact Supabase support

### Error: "permission denied"

The script grants permissions to `authenticated` and `service_role` roles.
If you need different permissions, adjust the GRANT statements.

## Verification

After running the schema, verify:

```sql
-- Check tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'hyperagent';
-- Should return 6

-- Check extensions
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');
-- Should show both extensions

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'hyperagent';
-- Should show multiple indexes
```

## Next Steps

1. ✅ Schema created
2. ✅ Run `alembic stamp head` to mark migrations as applied
3. ✅ Update `.env` with Supabase connection string
4. ✅ Test connection: `alembic current`
5. ✅ Start using HyperAgent!

