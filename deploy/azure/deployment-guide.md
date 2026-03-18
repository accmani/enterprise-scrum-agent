# Azure Deployment Guide — Enterprise Scrum Agent

This guide deploys the Enterprise Scrum Agent to **Azure Container Apps** using **Azure Container Registry (ACR)** for image storage.

## Prerequisites

- Azure CLI (`az`) >= 2.60
- Azure subscription with Contributor role
- Podman or Docker installed locally
- GitHub repository at `https://github.com/accmani/enterprise-scrum-agent`

## Architecture

```
+-----------------------------------------+
|          Azure Container Apps           |
|                                         |
|  +-----------------+  +--------------+  |
|  |  Frontend App   |  | Backend App  |  |
|  |  (React/nginx)  |  |  (FastAPI)   |  |
|  |   Port 80       |  |  Port 8000   |  |
|  +--------+--------+  +------+-------+  |
|           |   Container Apps |          |
|           |   Environment    |          |
+-----------+------------------+----------+
            |                  |
    Azure Front Door        Azure OpenAI
    (optional CDN)          (or OpenAI)
```

## Step 1 — Set Variables

```bash
RESOURCE_GROUP="rg-scrum-agent"
LOCATION="eastus"
ACR_NAME="scrumacr$(openssl rand -hex 4)"
ACA_ENV="scrum-agent-env"
BACKEND_APP="scrum-agent-backend"
FRONTEND_APP="scrum-agent-frontend"
```

## Step 2 — Create Resource Group & ACR

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION

az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
```

## Step 3 — Build & Push Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push backend
podman build -t $ACR_LOGIN_SERVER/$BACKEND_APP:latest ./backend
podman push $ACR_LOGIN_SERVER/$BACKEND_APP:latest

# Build and push frontend
podman build -t $ACR_LOGIN_SERVER/$FRONTEND_APP:latest ./frontend
podman push $ACR_LOGIN_SERVER/$FRONTEND_APP:latest
```

## Step 4 — Create Container Apps Environment

```bash
az containerapp env create \
  --name $ACA_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

## Step 5 — Deploy Backend

```bash
az containerapp create \
  --name $BACKEND_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV \
  --image $ACR_LOGIN_SERVER/$BACKEND_APP:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8000 \
  --ingress internal \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 5 \
  --env-vars \
    OPENAI_API_KEY=secretref:openai-key \
    DATABASE_URL="sqlite+aiosqlite:///./scrum_agent.db" \
    CORS_ORIGINS="https://$FRONTEND_APP.$(az containerapp env show --name $ACA_ENV --resource-group $RESOURCE_GROUP --query defaultDomain -o tsv)"

BACKEND_FQDN=$(az containerapp show --name $BACKEND_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
```

## Step 6 — Deploy Frontend

```bash
az containerapp create \
  --name $FRONTEND_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV \
  --image $ACR_LOGIN_SERVER/$FRONTEND_APP:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress external \
  --cpu 0.25 --memory 0.5Gi \
  --min-replicas 1 --max-replicas 3
```

## Step 7 — Add Secrets

```bash
az containerapp secret set \
  --name $BACKEND_APP \
  --resource-group $RESOURCE_GROUP \
  --secrets openai-key=<YOUR_OPENAI_API_KEY>
```

## Step 8 — Verify Deployment

```bash
FRONTEND_URL=$(az containerapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Frontend: https://$FRONTEND_URL"
echo "Backend health: https://$BACKEND_FQDN/health"
```

## CI/CD with Azure Pipelines

See `azure-pipelines.yml` in this directory for automated build & deploy.

## Cost Estimate (Consumption Plan)

| Resource | Estimated Monthly |
|---|---|
| Container Apps (2 apps, low traffic) | ~$5-15 |
| Azure Container Registry (Basic) | ~$5 |
| Azure OpenAI (GPT-4o, ~1000 calls) | ~$10-30 |
| **Total** | **~$20-50/month** |

## Cleanup

```bash
az group delete --name $RESOURCE_GROUP --yes --no-wait
```
