# Deployment "Failed to Fetch" Error Fix

This document explains the "Failed to fetch" error and how to resolve it.

## Error Details

```
Console TypeError: Failed to fetch
at handleDeploy (components/deployment/DeploymentModal.tsx:142:30)
```

## Root Cause

The "Failed to fetch" error occurs when the frontend cannot reach the backend API. This typically happens when:

1. **Backend is not running**
2. **Frontend is trying to connect to wrong URL**
3. **CORS configuration issue**
4. **Network/firewall blocking the request**

## Solutions

### 1. Verify Backend is Running

Check if the backend is accessible:

```bash
# Check backend health
curl http://localhost:8000/api/v1/x402/deployments/deploy -X POST

# Should return validation errors (proving endpoint exists):
# {"detail":[{"type":"missing","loc":["body","compiled_contract"],"msg":"Field required"...
```

If the backend isn't responding, start it:

```bash
docker-compose up -d
```

### 2. Verify Frontend Environment Variables

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

### 3. Check Backend Logs

If the backend is running but still getting errors:

```bash
# Check for errors
docker-compose logs hyperagent --tail 50

# Follow logs in real-time
docker-compose logs -f hyperagent
```

### 4. Verify CORS Configuration

The backend should have CORS enabled for `http://localhost:3000`. Check `hyperagent/api/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

## Enhanced Error Handling

The `DeploymentModal` component now includes better error messages:

### Before:
```typescript
const response = await fetch(`${API_BASE_URL}/x402/deployments/deploy`, {
  // ... request config
});
```

### After:
```typescript
let response: Response;
try {
  response = await fetch(`${API_BASE_URL}/x402/deployments/deploy`, {
    // ... request config
  });
} catch (fetchError) {
  console.error('Network error:', fetchError);
  throw new Error(
    'Cannot connect to backend API. Please ensure the backend is running at ' + API_BASE_URL
  );
}
```

Now users will see a clear error message:
```
Cannot connect to backend API. Please ensure the backend is running at http://localhost:8000/api/v1
```

## Complete Startup Procedure

Follow these steps to ensure everything is running:

### 1. Start Backend Services

```bash
# From project root
docker-compose up -d

# Verify all services are running
docker-compose ps

# You should see:
# - hyperagent_app (port 8000)
# - postgres
# - redis
# - mlflow
# - x402-verifier
```

### 2. Verify Backend is Accessible

```bash
# Test the deployment endpoint
curl -X POST http://localhost:8000/api/v1/x402/deployments/deploy \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return validation error (proving endpoint works)
```

### 3. Start Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Frontend should be at http://localhost:3000
```

### 4. Verify Frontend Configuration

Check browser console for:
- API URL being used
- Any CORS errors
- Network tab showing failed requests

## Common Issues

### Issue: "Cannot connect to backend API"

**Solution:** Backend isn't running or environment variable is wrong

```bash
# Check backend
curl http://localhost:8000/api/v1/x402/deployments/deploy -X POST

# If no response, restart backend
docker-compose restart hyperagent
```

### Issue: CORS Error in Browser Console

**Solution:** Add your frontend URL to CORS origins

Edit `hyperagent/api/main.py` and add your origin:
```python
allow_origins=[
    "http://localhost:3000",  # Your frontend URL
    # ... other origins
]
```

### Issue: 404 Not Found

**Solution:** Check the API route registration

Verify in `hyperagent/api/main.py`:
```python
from hyperagent.api.routes.x402 import deployments as x402_deployments
# ...
app.include_router(x402_deployments.router)
```

## Testing the Fix

1. Start backend: `docker-compose up -d`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser: http://localhost:3000
4. Navigate to Studio page
5. Generate a contract
6. Click "Deploy"
7. Should now see a clear error if backend is unreachable

## Related Files

- `frontend/components/deployment/DeploymentModal.tsx` - Improved error handling
- `hyperagent/api/main.py` - CORS configuration
- `hyperagent/api/routes/x402/deployments.py` - Deployment endpoint
- `frontend/.env.local` - Environment variables

