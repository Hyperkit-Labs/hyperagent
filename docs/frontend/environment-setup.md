# Frontend Environment Configuration for Dynamic Island UI

## Required Environment Variables

Create or update `frontend/.env.local` with the following:

```bash
# WebSocket URL for real-time workflow progress
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: Enable debug logging
NEXT_PUBLIC_DEBUG_WEBSOCKET=true
```

## Production Configuration

For production deployment, update to your actual domain:

```bash
# Production WebSocket (secure)
NEXT_PUBLIC_WS_URL=wss://api.hyperagent.com

# Production API
NEXT_PUBLIC_API_URL=https://api.hyperagent.com

# Disable debug logging
NEXT_PUBLIC_DEBUG_WEBSOCKET=false
```

## Vercel Deployment

Add these environment variables in your Vercel project settings:

| Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | `wss://api.hyperagent.com` | WebSocket endpoint |
| `NEXT_PUBLIC_API_URL` | `https://api.hyperagent.com` | REST API endpoint |

## Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Update the URLs if your backend runs on a different port:
   ```bash
   NEXT_PUBLIC_WS_URL=ws://localhost:8001
   NEXT_PUBLIC_API_URL=http://localhost:8001
   ```

3. Restart the Next.js dev server:
   ```bash
   npm run dev
   ```

## Testing WebSocket Connection

You can test the WebSocket connection in the browser console:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/workflow/test-id');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', event.data);
```

Expected output:
```json
{
  "type": "WORKFLOW_PROGRESSED",
  "data": {
    "workflow_id": "test-id",
    "stage": "generation",
    "progress_percentage": 25.5,
    "status": "in_progress"
  }
}
```

## Troubleshooting

### WebSocket Connection Fails

If the Dynamic Island shows "Reconnecting...":

1. Verify backend is running: `curl http://localhost:8000/health`
2. Check WebSocket endpoint: `wscat -c ws://localhost:8000/ws/workflow/test`
3. Verify CORS settings allow WebSocket connections
4. Check browser console for connection errors

### Components Not Found

If you get import errors:

```bash
# Reinstall dependencies
cd frontend
npm install framer-motion@^10.16.16 --legacy-peer-deps
npm run dev
```

### Progress Not Updating

If the progress bar doesn't move:

1. Check backend is emitting WORKFLOW_PROGRESSED events
2. Verify `update_stage_progress()` is called in orchestrator
3. Enable debug logging: `NEXT_PUBLIC_DEBUG_WEBSOCKET=true`
4. Check browser Network tab for WebSocket messages

