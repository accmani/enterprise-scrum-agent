# Enterprise Scrum Agent

An AI-powered Scrum management platform using MRKL (Modular Reasoning, Knowledge and Language) agents to assist Scrum Masters and Product Owners.

## Architecture

- **Backend**: FastAPI + LangChain MRKL Agent + SQLite/PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS
- **Container**: Podman / Docker
- **Deployment**: Azure Container Apps

## Features

- AI Scrum Master chat assistant (MRKL agent with tools)
- Sprint planning & management
- User story creation and estimation
- Velocity tracking
- Jira integration (optional)

## Quick Start

### Local Development (Podman Compose)

```bash
cd deploy/podman
podman-compose up --build
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your values.

## Deployment

See [Azure Deployment Guide](deploy/azure/deployment-guide.md) for production deployment to Azure Container Apps.

## Project Structure

```
enterprise-scrum-agent/
├── backend/          # FastAPI + MRKL agent
├── frontend/         # React TypeScript SPA
├── deploy/
│   ├── azure/        # Azure Bicep + Pipelines
│   └── podman/       # Local Podman Compose
└── README.md
```
