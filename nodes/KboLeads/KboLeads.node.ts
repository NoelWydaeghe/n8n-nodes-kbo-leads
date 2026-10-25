import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { buildLeadsQuery, kboApiRequest, PAGE_SIZE } from './GenericFunctions';
import { GEMEENTEN } from './data/gemeenten';
import { NACE_CODES } from './data/naceCodes';

// Fixed Belgian postcode ranges per province (same table as the API's /regions).
const PROVINCES: Array<{ name: string; code: string; prefixes: string[] }> = [
	{ name: 'Antwerpen', code: 'ANT', prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'] },
	{ name: 'Brabant Wallon', code: 'BWL', prefixes: ['13', '14'] },
	{ name: 'Brussel-Hoofdstad', code: 'BXL', prefixes: ['10', '11', '12'] },
	{ name: 'Hainaut', code: 'HAI', prefixes: ['60', '61', '62', '63', '64', '65', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'] },
	{ name: 'Liège', code: 'LIE', prefixes: ['40', '41', '42', '43', '44', '45', '46', '47', '48', '49'] },
	{ name: 'Limburg', code: 'LIM', prefixes: ['35', '36', '37', '38', '39'] },
	{ name: 'Luxembourg', code: 'LUX', prefixes: ['66', '67', '68', '69'] },
	{ name: 'Namur', code: 'NAM', prefixes: ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'] },
	{ name: 'Oost-Vlaanderen', code: 'OVL', prefixes: ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'] },
	{ name: 'Vlaams-Brabant', code: 'VBR', prefixes: ['15', '16', '17', '18', '19', '30', '31', '32', '33', '34'] },
	{ name: 'West-Vlaanderen', code: 'WVL', prefixes: ['80', '81', '82', '83', '84', '85', '86', '87', '88', '89'] },
];

const NACE_LEVEL: Record<number, string> = { 2: 'division', 3: 'group', 4: 'class', 5: 'subclass', 7: 'subclass' };

const leadOps = ['search', 'stats', 'export'];

const searchFields: INodeProperties[] = [
	{
		displayName: 'Sector Names or IDs',
		name: 'sectors',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getNaceCodes' },
		default: [],
		description:
			'Sectors to search in (NACE-BEL 2025). Type a word such as "kapper", "loodgieter" or "boekhouder" to find the code. A division (2 digits) or class (4 digits) includes all its subclasses. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
	},
	{
		displayName: 'Extra NACE Codes',
		name: 'naceCodes',
		type: 'string',
		default: '',
		placeholder: '43221, 9621',
		description:
			'Comma-separated NACE codes, in addition to the sectors above. NACE 2008 codes are mapped to their 2025 successor by the API.',
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
	},
	{
		displayName: 'Provinces',
		name: 'provinces',
		type: 'multiOptions',
		options: PROVINCES.map((p) => ({ name: p.name, value: p.prefixes.join('|') })),
		default: [],
		description:
			'Companies with their head office or a branch in these provinces. Combined with municipalities as OR.',
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
	},
	{
		displayName: 'Municipality Names or IDs',
		name: 'municipalities',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getMunicipalities' },
		default: [],
		description:
			'Municipalities (by postcode). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
	},
	{
		displayName: 'Postcodes',
		name: 'zipcode',
		type: 'string',
		default: '',
		placeholder: '8500, 8501, 9000',
		description: 'Comma-separated 4-digit Belgian postcodes, in addition to the municipalities above',
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['company'], operation: leadOps } },
		options: [
			{
				displayName: 'Entity Type',
				name: 'entityType',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Legal Entities Only', value: 'legal', description: 'BV, NV, VZW, … (no sole traders)' },
					{ name: 'Sole Traders Only', value: 'natural', description: 'Natural persons (eenmanszaken)' },
				],
				default: 'all',
			},
			{
				displayName: 'Founded After',
				name: 'foundedAfter',
				type: 'dateTime',
				default: '',
				description: 'Only companies founded on or after this date',
			},
			{
				displayName: 'Founded Before',
				name: 'foundedBefore',
				type: 'dateTime',
				default: '',
				description: 'Only companies founded on or before this date',
			},
			{
				displayName: 'Has Email',
				name: 'hasEmail',
				type: 'options',
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value: 'no' },
				],
				default: 'any',
			},
			{
				displayName: 'Has Phone',
				name: 'hasPhone',
				type: 'options',
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value: 'no' },
				],
				default: 'any',
			},
			{
				displayName: 'Has Trade Name',
				name: 'hasTradeName',
				type: 'options',
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value: 'no' },
				],
				default: 'any',
				description: 'Whether the company has a commercial name (handelsnaam) in the KBO',
			},
			{
				displayName: 'Has Website',
				name: 'hasWebsite',
				type: 'options',
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value: 'no' },
				],
				default: 'any',
			},
			{
				displayName: 'Head Office Only',
				name: 'headOfficeOnly',
				type: 'boolean',
				default: false,
				description:
					'Whether to match the region on the head office address only. By default a company also matches when one of its branches is in the region.',
			},
			{
				displayName: 'Include Inactive',
				name: 'includeInactive',
				type: 'boolean',
				default: false,
				description: 'Whether to include bankrupt, dissolved and liquidated companies',
			},
			{
				displayName: 'Languages',
				name: 'languages',
				type: 'multiOptions',
				options: [
					{ name: 'Dutch', value: 'NL' },
					{ name: 'English', value: 'EN' },
					{ name: 'French', value: 'FR' },
					{ name: 'German', value: 'DE' },
				],
				default: [],
				description: 'Language of the company in the KBO',
			},
			{
				displayName: 'Legal Forms',
				name: 'legalForms',
				type: 'multiOptions',
				options: [
					{ name: 'Buitenlands (Foreign)', value: 'buitenlands' },
					{ name: 'BV', value: 'bv' },
					{ name: 'CommV', value: 'commv' },
					{ name: 'CV', value: 'cv' },
					{ name: 'Eenmanszaak (Sole Trader)', value: 'eenmanszaak' },
					{ name: 'Maatschap', value: 'maatschap' },
					{ name: 'NV', value: 'nv' },
					{ name: 'Overheid (Public Body)', value: 'overheid' },
					{ name: 'Overig (Other)', value: 'overig' },
					{ name: 'Stichting', value: 'stichting' },
					{ name: 'VOF', value: 'vof' },
					{ name: 'VZW', value: 'vzw' },
				],
				default: [],
				description: 'Group of legal forms (rechtsvorm)',
			},
			{
				displayName: 'Max Establishments',
				name: 'maxEstablishments',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 1,
				description: 'Maximum number of establishment units (vestigingen)',
			},
			{
				displayName: 'Min Establishments',
				name: 'minEstablishments',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 2,
				description: 'Minimum number of establishment units (vestigingen), e.g. 2 for chains',
			},
			{
				displayName: 'Name Contains',
				name: 'nameContains',
				type: 'string',
				default: '',
				description: 'Part of the company name',
			},
			{
				displayName: 'Only With Contact Details',
				name: 'onlyWithContact',
				type: 'boolean',
				default: false,
				description: 'Whether to return only companies with an email address or phone number',
			},
			{
				displayName: 'Starters Only',
				name: 'startersOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to return only companies founded in the year before the KBO snapshot',
			},
		],
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'options',
		options: [
			{ name: 'Alphabetical', value: 'alphabetical' },
			{ name: 'Newest First', value: 'newest' },
			{ name: 'Oldest First', value: 'oldest' },
			{ name: 'Relevance', value: 'relevance', description: 'Companies with email and phone first' },
		],
		default: 'relevance',
		displayOptions: { show: { resource: ['company'], operation: ['search', 'export'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['company'], operation: ['search'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['company'], operation: ['search'], returnAll: [false] } },
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the output binary field to put the CSV file in',
		displayOptions: { show: { resource: ['company'], operation: ['export'] } },
	},
];

export class KboLeads implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'KBO Leads',
		name: 'kboLeads',
		icon: { light: 'file:kboLeads.light.svg', dark: 'file:kboLeads.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Search 1.8M Belgian companies from the official KBO/BCE register',
		defaults: { name: 'KBO Leads' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'kboLeadsApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Company', value: 'company' },
					{ name: 'Reference Data', value: 'reference' },
				],
				default: 'company',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'Get Usage',
						value: 'usage',
						description: 'Get your plan and how many views and exports you used this month',
						action: 'Get account usage',
					},
				],
				default: 'usage',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['company'] } },
				options: [
					{
						name: 'Count',
						value: 'stats',
						description: 'Count companies matching a filter, with and without contact details',
						action: 'Count companies',
					},
					{
						name: 'Export CSV',
						value: 'export',
						description: 'Export companies matching a filter as a CSV file (uses one export credit)',
						action: 'Export companies as CSV',
					},
					{
						name: 'Get',
						value: 'detail',
						description: 'Get one company by enterprise number',
						action: 'Get a company',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search companies by sector, region and filters',
						action: 'Search companies',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['reference'] } },
				options: [
					{
						name: 'List Municipalities',
						value: 'municipalities',
						description: 'Belgian postcodes and municipality names, with the number of companies',
						action: 'List municipalities',
					},
					{
						name: 'List NACE Codes',
						value: 'nace',
						description:
							'NACE-BEL 2025 sector codes. With a search term in plain language ("kapper") you get the matching sectors and the codes to search with.',
						action: 'List NACE codes',
					},
					{
						name: 'List Provinces',
						value: 'provinces',
						description: 'Belgian provinces with their postcode ranges and the number of companies',
						action: 'List provinces',
					},
				],
				default: 'nace',
			},
			{
				displayName: 'Enterprise Number',
				name: 'enterprise_number',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0403.170.701',
				description:
					'KBO/BCE enterprise number (with or without dots, BE prefix allowed) or the "lg_…" ID returned on the free plan',
				displayOptions: { show: { resource: ['company'], operation: ['detail'] } },
			},
			...searchFields,
			{
				displayName: 'Search',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'kapper',
				description:
					'Search term (at least 2 characters), e.g. "kapper", "4322" or "Kortrijk". Leave empty for the full list.',
				displayOptions: { show: { resource: ['reference'], operation: ['nace', 'municipalities'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getNaceCodes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Live counts when the API answers; the built-in list otherwise.
				let counts: Record<string, number> = {};
				try {
					const res = (await kboApiRequest.call(this, 'GET', '/nace')) as {
						codes: Array<{ code: string; enterprise_count: number }>;
					};
					counts = Object.fromEntries(res.codes.map((c) => [c.code, c.enterprise_count]));
				} catch {
					counts = {};
				}
				return NACE_CODES.map(([code, description]) => ({
					name: counts[code]
						? `${code} · ${description} (${counts[code].toLocaleString('nl-BE')})`
						: `${code} · ${description}`,
					value: code,
				}));
			},
			async getMunicipalities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return GEMEENTEN.filter(([, city]) => city).map(([zipcode, city]) => ({
					name: `${zipcode} ${city}`,
					value: zipcode,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'account') {
					const me = (await kboApiRequest.call(this, 'GET', '/me', {}, {}, i)) as IDataObject;
					returnData.push({ json: me, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'reference') {
					const query = ((this.getNodeParameter('query', i, '') as string) || '').trim();
					let rows: IDataObject[];
					if (operation === 'nace' && query.length >= 2) {
						// Plain-language search ("kapper", "loodgieter") with synonyms and counts.
						const res = (await kboApiRequest.call(this, 'GET', '/nace/search', { q: query, limit: 50 }, {}, i)) as {
							hits: IDataObject[];
						};
						rows = res.hits;
					} else if (operation === 'nace') {
						rows = NACE_CODES.map(([code, description]) => ({
							code,
							description,
							level: NACE_LEVEL[code.length] ?? String(code.length),
						}));
					} else if (operation === 'municipalities' && query.length >= 2) {
						const res = (await kboApiRequest.call(this, 'GET', '/regions/gemeenten', { q: query, limit: 50 }, {}, i)) as {
							gemeenten: IDataObject[];
						};
						rows = res.gemeenten.map(({ salesable_count, ...g }) => ({ ...g, enterprise_count: salesable_count }));
					} else if (operation === 'municipalities') {
						rows = GEMEENTEN.filter(([, city]) => city).map(([zipcode, city]) => ({ zipcode, city }));
					} else {
						const res = (await kboApiRequest.call(this, 'GET', '/regions', {}, {}, i)) as {
							provinces: IDataObject[];
						};
						rows = res.provinces.map(({ salesable_count, ...p }) => ({ ...p, enterprise_count: salesable_count }));
					}
					returnData.push(...rows.map((json) => ({ json, pairedItem: { item: i } })));
					continue;
				}

				if (operation === 'detail') {
					const id = (this.getNodeParameter('enterprise_number', i) as string).trim();
					if (!id) {
						throw new NodeOperationError(this.getNode(), 'Enterprise number is empty', { itemIndex: i });
					}
					const lead = (await kboApiRequest.call(
						this,
						'GET',
						`/leads/${encodeURIComponent(id)}`,
						{},
						{},
						i,
					)) as IDataObject;
					returnData.push({ json: lead, pairedItem: { item: i } });
					continue;
				}

				const qs = buildLeadsQuery.call(this, i);

				if (operation === 'stats') {
					const stats = (await kboApiRequest.call(this, 'GET', '/leads/stats', qs, {}, i)) as IDataObject;
					returnData.push({ json: stats, pairedItem: { item: i } });
					continue;
				}

				qs.sort = this.getNodeParameter('sort', i, 'relevance') as string;

				if (operation === 'export') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const response = (await kboApiRequest.call(
						this,
						'GET',
						'/leads/export',
						qs,
						{ json: false, encoding: 'arraybuffer', returnFullResponse: true },
						i,
					)) as { body: ArrayBuffer | Buffer; headers: IDataObject };
					const disposition = String(response.headers['content-disposition'] ?? '');
					const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'kbo_leads.csv';
					const binary = await this.helpers.prepareBinaryData(
						Buffer.from(response.body as ArrayBuffer),
						fileName,
						'text/csv',
					);
					returnData.push({
						json: { fileName, ...qs },
						binary: { [binaryPropertyName]: binary },
						pairedItem: { item: i },
					});
					continue;
				}

				// Search, with pagination
				const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
				const max = returnAll ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
				let offset = 0;
				let total = Infinity;
				const leads: IDataObject[] = [];
				while (leads.length < max && offset < total) {
					const pageSize = Math.min(PAGE_SIZE, max - leads.length);
					const page = (await kboApiRequest.call(
						this,
						'GET',
						'/leads',
						{ ...qs, limit: pageSize, offset },
						{},
						i,
					)) as { total: number; results: IDataObject[] };
					total = page.total;
					leads.push(...page.results);
					offset += page.results.length;
					// Fewer rows than asked: last page, or the plan's monthly cap.
					if (page.results.length < pageSize) break;
				}
				returnData.push(...leads.map((json) => ({ json, pairedItem: { item: i } })));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message, description: (error as { description?: string }).description },
						pairedItem: { item: i },
					});
					continue;
				}
				// kboApiRequest already throws a NodeApiError with a readable message.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						message: error.message,
						description: error.description ?? undefined,
						httpCode: error.httpCode ?? undefined,
						itemIndex: i,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
