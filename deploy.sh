#!/bin/bash
set -e

echo "========================================="
echo " Agentic AI SDLC — Full Deploy"
echo "========================================="

cd ~/enterprise-scrum-agent

# ── Credentials ───────────────────────────────
echo "[1/8] Getting ACR credentials..."
ACR_USER=$(az acr credential show --name scrumagentregistry2 --query username -o tsv)
ACR_PASS=$(az acr credential show --name scrumagentregistry2 --query passwords[0].value -o tsv)
GITHUB_TOKEN=$(grep GITHUB_TOKEN backend/.env | cut -d= -f2)
AZURE_OPENAI_API_KEY=$(grep AZURE_OPENAI_API_KEY backend/.env | cut -d= -f2)
JIRA_API_TOKEN=$(grep JIRA_API_TOKEN backend/.env | cut -d= -f2)

if [ -z "$ACR_USER" ] || [ -z "$ACR_PASS" ]; then
  echo "ERROR: Could not get ACR credentials. Run 'az login' first."
  exit 1
fi
echo "    ACR: $ACR_USER ✓"

# ── Build ─────────────────────────────────────
echo "[2/8] Building backend..."
podman build -t scrumagentregistry2.azurecr.io/scrum-backend:latest ./backend

echo "[3/8] Building frontend..."
podman build --no-cache --build-arg VITE_API_URL="" \
  -t scrumagentregistry2.azurecr.io/scrum-frontend:latest ./frontend

# ── Push ─────────────────────────────────────
echo "[4/8] Pushing backend image..."
podman push scrumagentregistry2.azurecr.io/scrum-backend:latest

echo "[5/8] Pushing frontend image..."
podman push scrumagentregistry2.azurecr.io/scrum-frontend:latest

# ── Delete ────────────────────────────────────
echo "[6/8] Deleting existing containers..."
az container delete --name scrum-backend  --resource-group scrum-agent-rg --yes 2>/dev/null || true
az container delete --name scrum-frontend --resource-group scrum-agent-rg --yes 2>/dev/null || true
echo "    Waiting for deletion to complete..."
sleep 10

# ── Deploy backend ────────────────────────────
echo "[7/8] Deploying backend..."
az container create \
  --name scrum-backend \
  --resource-group scrum-agent-rg \
  --image scrumagentregistry2.azurecr.io/scrum-backend:latest \
  --registry-login-server scrumagentregistry2.azurecr.io \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --os-type Linux --cpu 1 --memory 1.5 \
  --ports 8000 --ip-address Public \
  --dns-name-label scrum-agent-backend \
  --environment-variables \
    AZURE_OPENAI_ENDPOINT=https://swedencentral.api.cognitive.microsoft.com/ \
    AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini \
    OPENAI_API_VERSION=2024-08-01-preview \
    DATABASE_URL=sqlite+aiosqlite:///./scrum_agent.db \
    CORS_ORIGINS=http://scrum-agent-demo.eastus.azurecontainer.io \
    JIRA_URL=https://manitestboard.atlassian.net/ \
    JIRA_USERNAME=sendmail2mani@gmail.com \
    JIRA_PROJECT_KEY=ST \
    GITHUB_REPO=accmani/healthcare-claims \
  --secure-environment-variables \
    AZURE_OPENAI_API_KEY="$AZURE_OPENAI_API_KEY" \
    SECRET_KEY=change-me-in-production \
    JIRA_API_TOKEN="$JIRA_API_TOKEN" \
    GITHUB_TOKEN=$GITHUB_TOKEN \
  -o table

# ── Deploy frontend ───────────────────────────
echo "[8/8] Deploying frontend..."
az container create \
  --name scrum-frontend \
  --resource-group scrum-agent-rg \
  --image scrumagentregistry2.azurecr.io/scrum-frontend:latest \
  --registry-login-server scrumagentregistry2.azurecr.io \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --os-type Linux --cpu 1 --memory 1.5 \
  --ports 80 --ip-address Public \
  --dns-name-label scrum-agent-demo \
  -o table

# ── Verify ────────────────────────────────────
echo ""
echo "========================================="
echo " Verifying deployment..."
echo "========================================="
sleep 15

az container list \
  --resource-group scrum-agent-rg \
  --query '[].{Name:name, State:instanceView.state, FQDN:ipAddress.fqdn}' \
  -o table

echo ""
echo "Smoke testing backend..."
curl -s -X POST http://scrum-agent-backend.eastus.azurecontainer.io:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","history":[],"persona":"tech_lead"}' \
  -w "\nHTTP: %{http_code}" -m 30 2>&1 | tail -3

echo ""
echo "========================================="
echo " Done!"
echo " Frontend: http://scrum-agent-demo.eastus.azurecontainer.io"
echo " Backend:  http://scrum-agent-backend.eastus.azurecontainer.io:8000"
echo "========================================="
