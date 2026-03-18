@description('Location')
param location string

@description('Container Apps environment name')
param acaEnvName string

@description('ACR login server')
param acrLoginServer string

@description('ACR admin username')
param acrAdminUsername string

@description('ACR admin password')
@secure()
param acrAdminPassword string

@description('OpenAI API Key')
@secure()
param openAiApiKey string

resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: acaEnvName
  location: location
  properties: {
    zoneRedundant: false
  }
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'scrum-agent-backend'
  location: location
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 8000
      }
      registries: [
        {
          server: acrLoginServer
          username: acrAdminUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acrAdminPassword }
        { name: 'openai-key', value: openAiApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${acrLoginServer}/scrum-agent-backend:latest'
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
          env: [
            { name: 'OPENAI_API_KEY', secretRef: 'openai-key' }
            { name: 'DATABASE_URL', value: 'sqlite+aiosqlite:///./scrum_agent.db' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 5 }
    }
  }
}

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'scrum-agent-frontend'
  location: location
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
      }
      registries: [
        {
          server: acrLoginServer
          username: acrAdminUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acrAdminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: '${acrLoginServer}/scrum-agent-frontend:latest'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'
output backendUrl string = 'https://${backendApp.properties.configuration.ingress.fqdn}'
