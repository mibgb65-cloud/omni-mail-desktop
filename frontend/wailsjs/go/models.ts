export namespace main {
	
	export class APIUser {
	    id: string;
	    email: string;
	    role: string;
	    authType: string;
	    clientType: string;
	    label: string;
	    scope: string;
	
	    static createFrom(source: any = {}) {
	        return new APIUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.email = source["email"];
	        this.role = source["role"];
	        this.authType = source["authType"];
	        this.clientType = source["clientType"];
	        this.label = source["label"];
	        this.scope = source["scope"];
	    }
	}
	export class Account {
	    id: string;
	    domain: string;
	    address: string;
	    name: string;
	    label: string;
	    subject: string;
	    preview: string;
	    latestSubject: string;
	    latestPreview: string;
	    time: string;
	    latestAt: string;
	    unread: number;
	
	    static createFrom(source: any = {}) {
	        return new Account(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.domain = source["domain"];
	        this.address = source["address"];
	        this.name = source["name"];
	        this.label = source["label"];
	        this.subject = source["subject"];
	        this.preview = source["preview"];
	        this.latestSubject = source["latestSubject"];
	        this.latestPreview = source["latestPreview"];
	        this.time = source["time"];
	        this.latestAt = source["latestAt"];
	        this.unread = source["unread"];
	    }
	}
	export class Attachment {
	    id: string;
	    filename: string;
	    mimeType: string;
	    size: number;
	    downloadable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Attachment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.filename = source["filename"];
	        this.mimeType = source["mimeType"];
	        this.size = source["size"];
	        this.downloadable = source["downloadable"];
	    }
	}
	export class AuthStatus {
	    storage: string;
	    requiresSetup: boolean;
	    authenticated: boolean;
	    user?: APIUser;
	
	    static createFrom(source: any = {}) {
	        return new AuthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.storage = source["storage"];
	        this.requiresSetup = source["requiresSetup"];
	        this.authenticated = source["authenticated"];
	        this.user = this.convertValues(source["user"], APIUser);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HealthData {
	    service: string;
	    runtime: string;
	    storage: string;
	
	    static createFrom(source: any = {}) {
	        return new HealthData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.service = source["service"];
	        this.runtime = source["runtime"];
	        this.storage = source["storage"];
	    }
	}
	export class ConnectionStatus {
	    baseUrl: string;
	    ok: boolean;
	    message: string;
	    authError: string;
	    health?: HealthData;
	    authStatus?: AuthStatus;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseUrl = source["baseUrl"];
	        this.ok = source["ok"];
	        this.message = source["message"];
	        this.authError = source["authError"];
	        this.health = this.convertValues(source["health"], HealthData);
	        this.authStatus = this.convertValues(source["authStatus"], AuthStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DeviceAuthInput {
	    profileId: string;
	    email: string;
	    password: string;
	    deviceLabel: string;
	    setup: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DeviceAuthInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.email = source["email"];
	        this.password = source["password"];
	        this.deviceLabel = source["deviceLabel"];
	        this.setup = source["setup"];
	    }
	}
	export class DownloadAttachmentInput {
	    profileId: string;
	    attachmentId: string;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadAttachmentInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.attachmentId = source["attachmentId"];
	        this.filename = source["filename"];
	    }
	}
	export class DownloadResult {
	    path: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new DownloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	    }
	}
	
	export class Profile {
	    id: string;
	    name: string;
	    baseUrl: string;
	    deviceLabel: string;
	    hasToken: boolean;
	    tokenPreview: string;
	    createdAt: string;
	    updatedAt: string;
	    lastUsedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	        this.deviceLabel = source["deviceLabel"];
	        this.hasToken = source["hasToken"];
	        this.tokenPreview = source["tokenPreview"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.lastUsedAt = source["lastUsedAt"];
	    }
	}
	export class InitialState {
	    profiles: Profile[];
	    selectedProfileId: string;
	    storagePath: string;
	
	    static createFrom(source: any = {}) {
	        return new InitialState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profiles = this.convertValues(source["profiles"], Profile);
	        this.selectedProfileId = source["selectedProfileId"];
	        this.storagePath = source["storagePath"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Message {
	    id: string;
	    accountId: string;
	    direction: string;
	    author: string;
	    email: string;
	    subject: string;
	    body: string;
	    preview: string;
	    time: string;
	    archivedAt: string;
	    deletedAt: string;
	    attachments: Attachment[];
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.accountId = source["accountId"];
	        this.direction = source["direction"];
	        this.author = source["author"];
	        this.email = source["email"];
	        this.subject = source["subject"];
	        this.body = source["body"];
	        this.preview = source["preview"];
	        this.time = source["time"];
	        this.archivedAt = source["archivedAt"];
	        this.deletedAt = source["deletedAt"];
	        this.attachments = this.convertValues(source["attachments"], Attachment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MailboxPayload {
	    profile: Profile;
	    domains: string[];
	    accounts: Account[];
	    messages: Message[];
	    selectedDomain: string;
	    selectedAccountId: string;
	
	    static createFrom(source: any = {}) {
	        return new MailboxPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profile = this.convertValues(source["profile"], Profile);
	        this.domains = source["domains"];
	        this.accounts = this.convertValues(source["accounts"], Account);
	        this.messages = this.convertValues(source["messages"], Message);
	        this.selectedDomain = source["selectedDomain"];
	        this.selectedAccountId = source["selectedAccountId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MailboxRequest {
	    profileId: string;
	    domain: string;
	    accountId: string;
	
	    static createFrom(source: any = {}) {
	        return new MailboxRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.domain = source["domain"];
	        this.accountId = source["accountId"];
	    }
	}
	
	export class MessageActionInput {
	    profileId: string;
	    messageId: string;
	
	    static createFrom(source: any = {}) {
	        return new MessageActionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.messageId = source["messageId"];
	    }
	}
	
	export class ProfileInput {
	    id: string;
	    name: string;
	    baseUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new ProfileInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	    }
	}
	export class SendMessageInput {
	    profileId: string;
	    accountId: string;
	    to: string;
	    subject: string;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new SendMessageInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.accountId = source["accountId"];
	        this.to = source["to"];
	        this.subject = source["subject"];
	        this.text = source["text"];
	    }
	}
	export class SendResult {
	    queued: boolean;
	    provider: string;
	    messageId: string;
	
	    static createFrom(source: any = {}) {
	        return new SendResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queued = source["queued"];
	        this.provider = source["provider"];
	        this.messageId = source["messageId"];
	    }
	}
	export class TokenInput {
	    profileId: string;
	    deviceToken: string;
	    deviceLabel: string;
	
	    static createFrom(source: any = {}) {
	        return new TokenInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.deviceToken = source["deviceToken"];
	        this.deviceLabel = source["deviceLabel"];
	    }
	}

}

