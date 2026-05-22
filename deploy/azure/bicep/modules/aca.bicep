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

@description('Azure OpenAI or OpenAI API key')
@secure()
param openAiApiKey string

@description('Azure OpenAI endpoint — leave empty to fall back to public OpenAI')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI deployment name')
param azureOpenAiDeployment string = 'gpt-4o-mini'

@description('Image tag — defaults to latest; CI/CD passes Build.BuildId')
param imageTag string = 'latest'

@description('Jira base URL — e.g. https://your-org.atlassian.net/')
param jiraUrl string = ''

@description('Jira username (email address)')
param jiraUsername string = ''

@description('Jira API token')
@secure()
param jiraApiToken string = ''

@description('Jira project key')
param jiraProjectKey string = 'ST'

@description('GitHub personal access token')
@secure()
param githubToken string = ''

@description('GitHub repository in org/repo format')
param githubRepo string = ''

// ── Managed environment ────────────────────────────────────────────────────────

resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: acaEnvName
  location: location
  properties: {
    zoneRedundant: false
  }
}

// ── Backend (internal ingress — nginx proxies /api/ to this) ───────────────────

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'scrum-agent-backend'
  location: location
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 8000
        transport: 'http'
      }
      registries: [
        {
          server: acrLoginServer
          username: acrAdminUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password',  value: acrAdminPassword }
        { name: 'openai-key',    value: openAiApiKey     }
        { name: 'jira-token',    value: jiraApiToken     }
        { name: 'github-token',  value: githubToken      }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${acrLoginServer}/scrum-agent-backend:${imageTag}'
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
          env: [
            // OpenAI / Azure OpenAI
            { name: 'OPENAI_API_KEY',          secretRef: 'openai-key'            }
            { name: 'AZURE_OPENAI_API_KEY',     secretRef: 'openai-key'            }
            { name: 'AZURE_OPENAI_ENDPOINT',    value: azureOpenAiEndpoint         }
            { name: 'AZURE_OPENAI_DEPLOYMENT',  value: azureOpenAiDeployment       }
            { name: 'OPENAI_API_VERSION',       value: '2024-02-01'                }
            { name: 'OPENAI_MODEL',             value: azureOpenAiDeployment       }
            // Database (SQLite is ephemeral in ACA — replace with Azure SQL/Postgres for stateful prod)
            { name: 'DATABASE_URL',             value: 'sqlite+aiosqlite:///./scrum_agent.db' }
            // CORS — frontend is same ACA environment; browsers call nginx, not backend directly,
            // so wildcard is safe. Tighten to frontend FQDN after first deploy if needed.
            { name: 'CORS_ORIGINS',             value: '*'                         }
            { name: 'DEBUG',                    value: 'false'                     }
            // Jira integration
            { name: 'JIRA_URL',                 value: jiraUrl                     }
            { name: 'JIRA_USERNAME',            value: jiraUsername                }
            { name: 'JIRA_API_TOKEN',           secretRef: 'jira-token'            }
            { name: 'JIRA_PROJECT_KEY',         value: jiraProjectKey              }
            // GitHub integration
            { name: 'GITHUB_TOKEN',             secretRef: 'github-token'          }
            { name: 'GITHUB_REPO',              value: githubRepo                  }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8000, scheme: 'HTTP' }
              initialDelaySeconds: 15
              periodSeconds: 20
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: 8000, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
    }
  }
}

// ── Frontend (external ingress — public HTTPS) ─────────────────────────────────

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'scrum-agent-frontend'
  location: location
  dependsOn: [ backendApp ]  // ensures backend internal DNS exists before nginx resolves it
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
        allowInsecure: false
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
          image: '${acrLoginServer}/scrum-agent-frontend:${imageTag}'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/', port: 80, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 30
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────

output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'
output backendInternalFqdn string = backendApp.properties.configuration.ingress.fqdn
output environmentDefaultDomain string = acaEnv.properties.defaultDomain
