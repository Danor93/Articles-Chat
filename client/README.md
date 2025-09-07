# React Frontend

The web interface for Clarticle. Built with React, TypeScript, and shadcn/ui components.

## What it does

- Chat interface for asking questions about articles
- Article management UI for adding new URLs
- Dark/light theme support
- Real-time chat with loading states
- Responsive design for mobile and desktop

## Requirements

- Node.js 20 or higher
- npm or yarn

## Setup

1. Copy the environment file:
```bash
cd client
cp .env.example .env
```

2. Install dependencies:
```bash
npm install
```

## Running locally

For development with hot reload:
```bash
npm run dev
```

The app will open at http://localhost:5173

**Note**: The development server proxies `/api` requests to `http://localhost:8080` automatically.

To build and preview production build:
```bash
npm run build
npm run preview
```

To check TypeScript types:
```bash
npm run lint
```

## Environment variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:8080)

## Features

- **Chat tab** - Ask questions and get AI responses based on your articles
- **Add Articles tab** - Add new articles by URL
- **Theme toggle** - Switch between light and dark mode
- **Responsive design** - Works on desktop and mobile