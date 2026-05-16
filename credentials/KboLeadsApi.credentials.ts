import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class KboLeadsApi implements ICredentialType {
  name = 'kboLeadsApi';
  displayName = 'KBO Leads API';
  icon = { light: 'file:kboLeads.light.svg', dark: 'file:kboLeads.dark.svg' } as const;
  documentationUrl = 'https://leads.lokalegroei.be/api';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      placeholder: 'kbo_xxxxxxxxxxxxxxxx',
    },
  ];
  authenticate = {
    type: 'generic' as const,
    properties: {
      headers: { 'X-API-Key': '={{$credentials.apiKey}}' },
    },
  };
  test = {
    request: {
      baseURL: 'https://api.leads.automatisatiesvlaanderen.be',
      url: '/leads/stats',
    },
  };
}
