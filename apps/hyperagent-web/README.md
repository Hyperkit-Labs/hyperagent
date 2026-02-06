# HyperAgent Frontend

Next.js frontend application for HyperAgent - AI Agent Platform for On-Chain Smart Contract Generation.

## Features

- **Workflow Management**: Create, view, and monitor smart contract generation workflows
- **Real-time Updates**: WebSocket integration for live workflow progress
- **Contract Viewer**: Syntax-highlighted Solidity code display with ABI viewer
- **Deployment Tracking**: View deployment details with explorer links
- **Template Browser**: Browse and search contract templates
- **System Monitoring**: Integration with Prometheus for metrics collection

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python backend (HyperAgent) running on `http://localhost:8000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

**IMPORTANT:** The frontend uses the root `.env` file as the single source of truth.  
All environment variables should be configured in the root `.env` file, not in the frontend directory.

Required variables in root `.env`:
```
# Thirdweb (Required for wallet connect and x402 payments)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# API URLs (Optional - defaults shown)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_X402_VERIFIER_URL=http://localhost:3001
```

The `next.config.ts` automatically loads these variables from the root `.env` file.

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── workflows/         # Workflow pages
│   ├── contracts/         # Contract pages
│   ├── deployments/       # Deployment pages
│   ├── templates/         # Template pages
│   └── monitoring/        # Monitoring page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── workflows/        # Workflow-specific components
│   ├── contracts/        # Contract components
│   ├── deployments/      # Deployment components
│   ├── templates/        # Template components
│   └── layout/           # Layout components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and API client
│   ├── api.ts           # API client functions
│   ├── types.ts         # TypeScript type definitions
│   ├── utils.ts         # Utility functions
│   └── websocket.ts     # WebSocket client
└── public/              # Static assets
```

## API Integration

The frontend communicates with the HyperAgent API through:

- **REST API**: HTTP requests via `lib/api.ts`
- **WebSocket**: Real-time updates via `lib/websocket.ts`

### Key API Endpoints

- `POST /api/v1/workflows/generate` - Create new workflow
- `GET /api/v1/workflows/{id}` - Get workflow details
- `GET /api/v1/templates` - List templates
- `POST /api/v1/templates/search` - Search templates
- `GET /api/v1/networks` - List supported networks
- `GET /api/v1/health/detailed` - System health status

## Components

### UI Components

- `Button` - Primary, secondary, danger, outline, ghost variants
- `Card` - Container with optional header and footer
- `Input` - Text input with label and error states
- `Textarea` - Multi-line text input
- `Select` - Dropdown select
- `ProgressBar` - Progress indicator (0-100%)
- `StatusBadge` - Status indicators
- `Badge` - General purpose badge
- `LoadingSpinner` - Loading indicator

### Workflow Components

- `WorkflowForm` - Create workflow form
- `WorkflowCard` - Workflow summary card
- `WorkflowProgress` - Real-time progress display

### Contract Components

- `ContractViewer` - Syntax-highlighted code display with ABI viewer

### Deployment Components

- `ExplorerLink` - Network-specific explorer links

## Hooks

- `useWorkflow` - Fetch and poll workflow status
- `useWebSocket` - WebSocket connection for real-time updates
- `usePolling` - Generic polling hook
- `useHealth` - System health status

## Styling

The project uses Tailwind CSS v4 for styling. Custom theme configuration can be found in `tailwind.config.ts` (if using v3) or `globals.css` (v4).

## License

MIT
