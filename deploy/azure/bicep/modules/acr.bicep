@description('ACR name')
param acrName string

@description('Location')
param location string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

output loginServer string = acr.properties.loginServer
output adminUsername string = acr.name
#disable-next-line outputs-should-not-contain-secrets
output adminPassword string = acr.listCredentials().passwords[0].value
