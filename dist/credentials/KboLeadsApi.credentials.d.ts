import { ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class KboLeadsApi implements ICredentialType {
    name: string;
    displayName: string;
    icon: {
        readonly light: "file:kboLeads.light.svg";
        readonly dark: "file:kboLeads.dark.svg";
    };
    documentationUrl: string;
    properties: INodeProperties[];
    authenticate: {
        type: "generic";
        properties: {
            headers: {
                'X-API-Key': string;
            };
        };
    };
    test: {
        request: {
            baseURL: string;
            url: string;
        };
    };
}
