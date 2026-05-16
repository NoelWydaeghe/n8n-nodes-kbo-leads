"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KboLeadsApi = void 0;
class KboLeadsApi {
    constructor() {
        this.name = 'kboLeadsApi';
        this.displayName = 'KBO Leads API';
        this.icon = { light: 'file:kboLeads.light.svg', dark: 'file:kboLeads.dark.svg' };
        this.documentationUrl = 'https://leads.lokalegroei.be/api';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                placeholder: 'kbo_xxxxxxxxxxxxxxxx',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: { 'X-API-Key': '={{$credentials.apiKey}}' },
            },
        };
        this.test = {
            request: {
                baseURL: 'https://api.leads.automatisatiesvlaanderen.be',
                url: '/leads/stats',
            },
        };
    }
}
exports.KboLeadsApi = KboLeadsApi;
//# sourceMappingURL=KboLeadsApi.credentials.js.map