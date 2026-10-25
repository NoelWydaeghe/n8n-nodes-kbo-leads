import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

export const DEFAULT_BASE_URL = 'https://api.lokalegroei.be';

/** Largest page the API accepts on GET /leads. */
export const PAGE_SIZE = 1000;

/** Retries after a 429 (rate limit) before giving up. */
const MAX_RETRIES = 3;

type Context = IExecuteFunctions | ILoadOptionsFunctions;

async function getBaseUrl(this: Context): Promise<string> {
	const credentials = await this.getCredentials('kboLeadsApi');
	const baseUrl = (credentials.baseUrl as string | undefined) || DEFAULT_BASE_URL;
	return baseUrl.replace(/\/+$/, '');
}

function parseBody(data: unknown): IDataObject | undefined {
	if (data === undefined || data === null) return undefined;
	if (Buffer.isBuffer(data)) data = data.toString('utf8');
	if (typeof data === 'string') {
		try {
			return JSON.parse(data) as IDataObject;
		} catch {
			return { detail: data };
		}
	}
	if (typeof data === 'object') return data as IDataObject;
	return undefined;
}

/**
 * Turn an API error into a message a workflow builder can act on. The API
 * answers with FastAPI's `{ detail: ... }`, where detail is a string, an object
 * with an `error` code, or a list of validation errors.
 */
function describeError(status: number | undefined, body: IDataObject | undefined) {
	const detail = body?.detail as IDataObject | IDataObject[] | string | undefined;

	if (status === 401) {
		return {
			message: 'Invalid or missing API key',
			description:
				'Check the API key in the KBO Leads credential. Create a new key in your dashboard at https://leads.lokalegroei.be/dashboard.',
		};
	}

	if (status === 429) {
		return {
			message: 'Rate limit reached (60 requests per minute per API key)',
			description: typeof body?.detail === 'string' ? body.detail : undefined,
		};
	}

	if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
		const code = detail.error as string | undefined;
		if (code === 'monthly_view_limit_reached') {
			return {
				message: `Monthly limit reached: the ${detail.plan as string} plan shows ${detail.limit as number} companies per month`,
				description: `This filter matches ${detail.total as number} companies. Upgrade at ${
					(detail.upgrade_url as string) || 'https://leads.lokalegroei.be/pricing'
				} to see all of them.`,
			};
		}
		if (code === 'filter_not_available') {
			return {
				message: `Filter "${detail.filter as string}" is not available yet`,
				description: detail.message as string,
			};
		}
		if (code) {
			return {
				message: `KBO Leads API: ${code.replace(/_/g, ' ')}`,
				description: detail.upgrade_url
					? `Upgrade at ${detail.upgrade_url as string}`
					: JSON.stringify(detail),
			};
		}
	}

	if (Array.isArray(detail)) {
		const parts = detail.map((d) => {
			const loc = Array.isArray(d.loc) ? (d.loc as string[]).slice(1).join('.') : '';
			return loc ? `${loc}: ${d.msg as string}` : (d.msg as string);
		});
		return { message: 'Invalid parameter', description: parts.join('; ') };
	}

	if (typeof detail === 'string') {
		if (status === 404) return { message: 'Company not found', description: detail };
		return { message: detail, description: undefined };
	}

	return { message: undefined, description: undefined };
}

export async function kboApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
	extra: Partial<IHttpRequestOptions> = {},
	itemIndex?: number,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	const options: IHttpRequestOptions = {
		method,
		url: `${await getBaseUrl.call(this)}${endpoint}`,
		qs,
		json: true,
		...extra,
	};

	for (let attempt = 0; ; attempt++) {
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, 'kboLeadsApi', options);
		} catch (error) {
			const e = error as JsonObject & {
				httpCode?: string;
				response?: { status?: number; data?: unknown; headers?: IDataObject };
				cause?: { response?: { status?: number; data?: unknown; headers?: IDataObject } };
				context?: { data?: unknown };
			};
			const response = e.response ?? e.cause?.response;
			const status = response?.status ?? (e.httpCode ? Number(e.httpCode) : undefined);

			// 60 requests per minute per key: wait as long as the API asks, then retry.
			if (status === 429 && attempt < MAX_RETRIES) {
				const retryAfter = Number(response?.headers?.['retry-after']) || 10;
				await sleep(Math.min(retryAfter, 60) * 1000);
				continue;
			}

			const body = parseBody(response?.data ?? e.context?.data);
			const { message, description } = describeError(status, body);
			throw new NodeApiError(this.getNode(), (body ?? e) as JsonObject, {
				message,
				description,
				httpCode: status ? String(status) : undefined,
				itemIndex,
			});
		}
	}
}

/** Split "8500, 8510;9000" or an array into clean values. */
export function toList(value: unknown): string[] {
	if (value === undefined || value === null || value === '') return [];
	const raw = Array.isArray(value) ? value : String(value).split(/[,;\s]+/);
	return raw.map((v) => String(v).trim()).filter((v) => v !== '');
}

/**
 * Read the shared search parameters (sector, region, filters) of the
 * Search, Count and Export operations and turn them into API query params.
 */
export function buildLeadsQuery(this: IExecuteFunctions, i: number): IDataObject {
	const qs: IDataObject = {};

	const nace = [
		...toList(this.getNodeParameter('sectors', i, [])),
		...toList(this.getNodeParameter('naceCodes', i, '')).map((c) => c.replace(/\./g, '')),
	];
	if (nace.length) qs.nace = [...new Set(nace)].join(',');

	const prefixes = toList(this.getNodeParameter('provinces', i, [])).flatMap((p) => p.split('|'));
	if (prefixes.length) qs.zipcode_prefix = [...new Set(prefixes)].join(',');

	const zipcodes = [
		...toList(this.getNodeParameter('municipalities', i, [])),
		...toList(this.getNodeParameter('zipcode', i, '')),
	];
	if (zipcodes.length) qs.zipcode = [...new Set(zipcodes)].join(',');

	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;

	if (filters.nameContains) qs.name_contains = filters.nameContains;
	if (filters.onlyWithContact) qs.alleen_met_contact = true;
	for (const [key, param] of [
		['hasEmail', 'has_email'],
		['hasPhone', 'has_phone'],
		['hasWebsite', 'has_website'],
		['hasTradeName', 'heeft_handelsnaam'],
	] as const) {
		const v = filters[key] as string | undefined;
		if (v === 'yes') qs[param] = true;
		if (v === 'no') qs[param] = false;
	}
	if (filters.startersOnly) qs.starters = true;
	if (filters.foundedAfter) qs.founded_after = String(filters.foundedAfter).slice(0, 10);
	if (filters.foundedBefore) qs.founded_before = String(filters.foundedBefore).slice(0, 10);
	if (filters.minEstablishments !== undefined && filters.minEstablishments !== '')
		qs.min_vestigingen = filters.minEstablishments;
	if (filters.maxEstablishments !== undefined && filters.maxEstablishments !== '')
		qs.max_vestigingen = filters.maxEstablishments;
	const legalForms = toList(filters.legalForms);
	if (legalForms.length) qs.rechtsvorm_groep = legalForms.join(',');
	if (filters.entityType === 'legal') qs.alleen_rechtspersonen = true;
	if (filters.entityType === 'natural') qs.alleen_eenmanszaken = true;
	const languages = toList(filters.languages);
	if (languages.length) qs.taal = languages.join(',');
	if (filters.includeInactive) qs.include_inactive = true;
	if (filters.headOfficeOnly) qs.met_vestigingen = false;

	return qs;
}
