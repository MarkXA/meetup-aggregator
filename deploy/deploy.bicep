param functionAppName string = 'meetup-aggregator'
param location string = 'northeurope'
param storageAccountName string = 'nidcinternal'
param outputStorageAccountName string = 'nidc'
param analyticsWorkspaceName string = 'nidc'

var hostingPlanName = functionAppName
var applicationInsightsName = functionAppName

resource outputStorageAccount 'Microsoft.Storage/storageAccounts@2021-02-01' existing = {
  name: outputStorageAccountName
}

resource analyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' existing = {
  name: analyticsWorkspaceName
}

resource appInsights 'microsoft.insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
    IngestionMode: 'LogAnalytics'
    WorkspaceResourceId: analyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-02-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'Storage'
}

resource hostingPlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: hostingPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2021-02-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    reserved: true
    serverFarmId: hostingPlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|16'
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${listKeys(storageAccount.id, storageAccount.apiVersion).keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'BlobStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${outputStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${listKeys(outputStorageAccount.id, outputStorageAccount.apiVersion).keys[0].value}'
        }
        {
          name: 'UpdateCron'
          value: '3 3 3 * * *'
        }
      ]
    }
  }
}
