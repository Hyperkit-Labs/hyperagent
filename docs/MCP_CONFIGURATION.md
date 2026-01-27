# MCP (Model Context Protocol) Configuration

This document outlines the MCP server configuration variables required for HyperKit Agent.

## Overview

HyperKit Agent supports multiple MCP servers for enhanced functionality. Add these variables to your `.env` file to enable MCP features.

## MCP Server Configuration

### MongoDB MCP Server

For database operations and analytics:

```bash
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017

# Default database name
MONGODB_DATABASE=hyperagent_mcp
```

**Features:**
- Query workflows and contracts
- Aggregate analytics
- Collection management

### Netlify MCP Server

For automated deployments to Netlify:

```bash
# Netlify personal access token
NETLIFY_AUTH_TOKEN=your_netlify_token_here

# Optional: Default site ID
NETLIFY_SITE_ID=your_site_id_here
```

**Features:**
- Deploy static sites
- Manage DNS records
- Environment variable management
- Build configuration

### Railway MCP Server

For Railway.app deployment automation:

```bash
# Railway API token
RAILWAY_TOKEN=your_railway_token_here

# Optional: Default project ID
RAILWAY_PROJECT_ID=your_project_id_here
```

**Features:**
- Deploy services
- Manage environments
- Create projects
- Set environment variables
- View logs and metrics

### Render MCP Server

For Render.com deployment automation:

```bash
# Render API key
RENDER_API_KEY=your_render_api_key_here

# Owner ID (team or user)
RENDER_OWNER_ID=your_owner_id_here
```

**Features:**
- Create web services
- Deploy static sites
- Manage databases
- Configure PostgreSQL
- Create cron jobs

### Postman MCP Server

For API testing automation:

```bash
# Postman API key
POSTMAN_API_KEY=your_postman_api_key_here
```

**Features:**
- Create collections
- Run tests
- Generate API documentation
- Manage environments
- Execute collection runs

## Complete .env Template

Add this section to your `.env` file:

```bash
# ----------------------------------------------------------------------------
# MCP (Model Context Protocol) Configuration
# ----------------------------------------------------------------------------

# MongoDB MCP Server
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=hyperagent_mcp

# Netlify MCP Server (for deployment automation)
NETLIFY_AUTH_TOKEN=
NETLIFY_SITE_ID=

# Railway MCP Server (for deployment)
RAILWAY_TOKEN=
RAILWAY_PROJECT_ID=

# Render MCP Server (for deployment)
RENDER_API_KEY=
RENDER_OWNER_ID=

# Postman MCP Server (for API testing)
POSTMAN_API_KEY=
```

## Getting API Keys

### MongoDB
1. Install MongoDB locally or use MongoDB Atlas
2. Connection string format: `mongodb://username:password@host:port/database`
3. For Atlas: Get connection string from cluster dashboard

### Netlify
1. Go to https://app.netlify.com/user/applications
2. Create new personal access token
3. Copy token to `NETLIFY_AUTH_TOKEN`

### Railway
1. Visit https://railway.app/account/tokens
2. Create new token
3. Copy to `RAILWAY_TOKEN`

### Render
1. Go to https://dashboard.render.com/u/settings#api-keys
2. Generate new API key
3. Copy to `RENDER_API_KEY`
4. Get owner ID from account settings

### Postman
1. Visit https://web.postman.co/settings/me/api-keys
2. Generate API key
3. Copy to `POSTMAN_API_KEY`

## Usage Examples

### MongoDB Query

```typescript
// Query workflows from MongoDB
const workflows = await mcp.mongodb.query({
  collection: 'workflows',
  filter: { status: 'completed' }
});
```

### Netlify Deploy

```typescript
// Deploy to Netlify
await mcp.netlify.deploy({
  siteId: process.env.NETLIFY_SITE_ID,
  directory: './dist'
});
```

### Railway Deploy

```typescript
// Create service on Railway
await mcp.railway.createService({
  projectId: process.env.RAILWAY_PROJECT_ID,
  name: 'hyperagent-api',
  source: { repo: 'github.com/user/repo' }
});
```

### Render Deploy

```typescript
// Create web service on Render
await mcp.render.createWebService({
  name: 'hyperagent-backend',
  runtime: 'node',
  buildCommand: 'npm install && npm run build',
  startCommand: 'npm start'
});
```

### Postman Test

```typescript
// Run Postman collection
await mcp.postman.runCollection({
  collectionId: 'your-collection-id',
  environmentId: 'your-environment-id'
});
```

## Security Notes

- Never commit API keys to version control
- Use environment-specific `.env` files
- Rotate keys regularly
- Use minimal permissions for each key
- Consider using secret management services (AWS Secrets Manager, HashiCorp Vault)

## Troubleshooting

### MongoDB Connection Failed
- Verify MongoDB is running: `mongosh`
- Check connection string format
- Ensure database exists

### Netlify 401 Unauthorized
- Verify token hasn't expired
- Check token has correct permissions
- Regenerate token if needed

### Railway/Render 403 Forbidden
- Verify API key is correct
- Check account has required permissions
- Ensure project/owner ID is valid

### Postman Rate Limit
- Free tier: 1000 requests/month
- Upgrade to Pro for higher limits
- Implement request caching

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MongoDB MCP Server](https://github.com/mongodb/mcp-server)
- [Netlify MCP Server](https://github.com/netlify/mcp-server)
- [Railway MCP](https://docs.railway.app/reference/mcp)
- [Render API Docs](https://api-docs.render.com/)
- [Postman API](https://learning.postman.com/docs/developer/postman-api/)

