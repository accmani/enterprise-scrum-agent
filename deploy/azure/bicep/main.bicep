@description('Location for all resources')
param location string = resourceGroup().location

@description('Container registry name — must be globally unique')
param acrName string = 'scrumacr${uniqueString(resourceGroup().id)}'

@description('Container Apps environment name')
param acaEnvName string = 'scrum-agent-env'

@description('Azure OpenAI or OpenAI API key')
@secure()
param openAiApiKey string

@description('Azure OpenAI endpoint — e.g. https://<name>.openai.azure.com/  Leave empty for public OpenAI')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI deployment name')
param azureOpenAiDeployment string = 'gpt-4o-mini'

@description('Image tag to deploy — CI/CD passes Build.BuildId; manual deploy uses latest')
param imageTag string = 'latest'

@description('Jira base URL')
param jiraUrl string = ''

@description('Jira username (email)')
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

module acr 'modules/acr.bicep' = {
  name: 'acr-deploy'
  params: {
    acrName: acrName
    location: location
  }
}

module aca 'modules/aca.bicep' = {
  name: 'aca-deploy'
  params: {
    location: location
    acaEnvName: acaEnvName
    acrLoginServer: acr.outputs.loginServer
    acrAdminUsername: acr.outputs.adminUsername
    acrAdminPassword: acr.outputs.adminPassword
    openAiApiKey: openAiApiKey
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiDeployment: azureOpenAiDeployment
    imageTag: imageTag
    jiraUrl: jiraUrl
    jiraUsername: jiraUsername
    jiraApiToken: jiraApiToken
    jiraProjectKey: jiraProjectKey
    githubToken: githubToken
    githubRepo: githubRepo
  }
}

output frontendUrl string = aca.outputs.frontendUrl
output backendInternalFqdn string = aca.outputs.backendInternalFqdn
output acrLoginServer string = acr.outputs.loginServer
