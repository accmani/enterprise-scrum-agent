@description('Location for all resources')
param location string = resourceGroup().location

@description('Container registry name')
param acrName string = 'scrumacr${uniqueString(resourceGroup().id)}'

@description('Container Apps environment name')
param acaEnvName string = 'scrum-agent-env'

@description('OpenAI API Key')
@secure()
param openAiApiKey string

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
  }
}

output frontendUrl string = aca.outputs.frontendUrl
output backendUrl string = aca.outputs.backendUrl
