"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KboLeads = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class KboLeads {
    constructor() {
        this.description = {
            displayName: 'KBO Leads',
            name: 'kboLeads',
            icon: { light: 'file:kboLeads.light.svg', dark: 'file:kboLeads.dark.svg' },
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"]}}',
            description: '1.9M Belgische bedrijven uit de officiële KBO database',
            defaults: { name: 'KBO Leads' },
            usableAsTool: true,
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [{ name: 'kboLeadsApi', required: true }],
            properties: [
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        { name: 'Bedrijf Detail', value: 'detail', description: 'Volledige info op KBO nummer', action: 'Volledige info op KBO nummer' },
                        { name: 'Bedrijven Zoeken', value: 'search', description: 'Filter bedrijven op sector en stad', action: 'Filter bedrijven op sector en stad' },
                        { name: 'NACE Codes', value: 'nace', description: 'Lijst van alle NACE codes', action: 'Lijst van alle NACE codes' },
                        { name: 'Statistieken', value: 'stats', description: 'Statistieken van gefilterde bedrijven', action: 'Statistieken van gefilterde bedrijven' },
                    ],
                    default: 'search',
                },
                {
                    displayName: 'NACE Code',
                    name: 'nace_main',
                    type: 'string',
                    default: '',
                    placeholder: '43220',
                    description: 'NACE activiteitscode (bv. 43220 = loodgieters).',
                    displayOptions: { show: { operation: ['search', 'stats'] } },
                },
                {
                    displayName: 'Stad',
                    name: 'city',
                    type: 'string',
                    default: '',
                    placeholder: 'Gent',
                    description: 'Filter op stad of gemeente',
                    displayOptions: { show: { operation: ['search', 'stats'] } },
                },
                {
                    displayName: 'Postcode',
                    name: 'zipcode',
                    type: 'string',
                    default: '',
                    placeholder: '9000',
                    description: 'Filter op postcode',
                    displayOptions: { show: { operation: ['search'] } },
                },
                {
                    displayName: 'Alleen Met Email',
                    name: 'has_email',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to return only companies with an email address',
                    displayOptions: { show: { operation: ['search'] } },
                },
                {
                    displayName: 'Alleen Met Telefoon',
                    name: 'has_phone',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to return only companies with a phone number',
                    displayOptions: { show: { operation: ['search'] } },
                },
                {
                    displayName: 'Limit',
                    name: 'limit',
                    type: 'number',
                    default: 50,
                    description: 'Max number of results to return',
                    typeOptions: { minValue: 1, maxValue: 500 },
                    displayOptions: { show: { operation: ['search'] } },
                },
                {
                    displayName: 'KBO Nummer',
                    name: 'enterprise_number',
                    type: 'string',
                    default: '',
                    placeholder: '0123.456.789',
                    description: 'Het KBO ondernemingsnummer',
                    displayOptions: { show: { operation: ['detail'] } },
                },
            ],
        };
    }
    async execute() {
        const baseUrl = 'https://api.leads.automatisatiesvlaanderen.be';
        const operation = this.getNodeParameter('operation', 0);
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            try {
                let responseData;
                if (operation === 'search') {
                    const qs = { limit: this.getNodeParameter('limit', i) };
                    const nace = this.getNodeParameter('nace_main', i);
                    const city = this.getNodeParameter('city', i);
                    const zipcode = this.getNodeParameter('zipcode', i);
                    const has_email = this.getNodeParameter('has_email', i);
                    const has_phone = this.getNodeParameter('has_phone', i);
                    if (nace)
                        qs.nace_main = nace;
                    if (city)
                        qs.city = city;
                    if (zipcode)
                        qs.zipcode = zipcode;
                    if (has_email)
                        qs.has_email = true;
                    if (has_phone)
                        qs.has_phone = true;
                    responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'kboLeadsApi', { method: 'GET', url: `${baseUrl}/leads`, qs });
                }
                else if (operation === 'stats') {
                    const qs = {};
                    const nace = this.getNodeParameter('nace_main', i);
                    const city = this.getNodeParameter('city', i);
                    if (nace)
                        qs.nace_main = nace;
                    if (city)
                        qs.city = city;
                    responseData = [await this.helpers.httpRequestWithAuthentication.call(this, 'kboLeadsApi', { method: 'GET', url: `${baseUrl}/leads/stats`, qs })];
                }
                else if (operation === 'detail') {
                    const nr = this.getNodeParameter('enterprise_number', i);
                    responseData = [await this.helpers.httpRequestWithAuthentication.call(this, 'kboLeadsApi', { method: 'GET', url: `${baseUrl}/leads/${encodeURIComponent(nr)}` })];
                }
                else {
                    responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'kboLeadsApi', { method: 'GET', url: `${baseUrl}/nace` });
                }
                returnData.push(...this.helpers.returnJsonArray(responseData));
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: error.message }, pairedItem: i });
                    continue;
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
            }
        }
        return [returnData];
    }
}
exports.KboLeads = KboLeads;
//# sourceMappingURL=KboLeads.node.js.map