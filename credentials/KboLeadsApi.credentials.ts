import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class KboLeadsApi implements ICredentialType {
	name = 'kboLeadsApi';

	displayName = 'KBO Leads API';

	icon = {
		light: 'file:../nodes/KboLeads/kboLeads.light.svg',
		dark: 'file:../nodes/KboLeads/kboLeads.dark.svg',
	} as const;

	documentationUrl = 'https://leads.lokalegroei.be/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'kbo_…',
			description: 'Create a key in your dashboard at https://leads.lokalegroei.be/dashboard',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.lokalegroei.be',
			description: 'Only change this for a test environment',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { 'X-API-Key': '={{$credentials.apiKey}}' },
		},
	};

	// GET /api-keys/me accepts an API key and does not use any quota.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{($credentials.baseUrl || "https://api.lokalegroei.be").replace(/\\/+$/, "")}}',
			url: '/api-keys/me',
			method: 'GET',
		},
	};
}
