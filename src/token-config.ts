import { randomUUID } from "node:crypto";
import { addMilliseconds, parseDuration, toDate } from "./duration.js";
import type { DurationInput, InstantInput, TokenConfigOptions } from "./types.js";

export class Access {
  private readonly roles = new Set<string>();

  constructor(roles: Iterable<string> = []) {
    this.addRoles(roles);
  }

  getRoles(): readonly string[] {
    return [...this.roles];
  }

  addRole(role: string): void {
    this.roles.add(role);
  }

  addRoles(roles: Iterable<string>): void {
    for (const role of roles) {
      this.roles.add(role);
    }
  }

  toJSON(): { roles: string[] } {
    return { roles: this.getRoles() as string[] };
  }
}

export class TokenConfig {
  static readonly CLAIM_AUDIENCE = "aud";
  static readonly CLAIM_AUTHORIZED_PARTY = "azp";
  static readonly CLAIM_SUBJECT = "sub";
  static readonly CLAIM_TYPE = "typ";
  static readonly CLAIM_ISSUER = "iss";
  static readonly CLAIM_SESSION_ID = "sid";
  static readonly CLAIM_ISSUED_AT = "iat";
  static readonly CLAIM_NOT_BEFORE = "nbf";
  static readonly CLAIM_EXPIRES_AT = "exp";
  static readonly CLAIM_NAME = "name";
  static readonly CLAIM_GIVEN_NAME = "given_name";
  static readonly CLAIM_FAMILY_NAME = "family_name";
  static readonly CLAIM_EMAIL = "email";
  static readonly CLAIM_PREFERRED_USERNAME = "preferred_username";
  static readonly CLAIM_REALM_ACCESS = "realm_access";
  static readonly CLAIM_RESOURCE_ACCESS = "resource_access";
  static readonly CLAIM_AUTHENTICATION_CONTEXT_REFERENCE = "acr";
  static readonly CLAIM_SCOPE = "scope";
  static readonly CLAIM_SESSION_STATE = "session_state";
  static readonly CLAIM_AUTH_TIME = "auth_time";

  readonly audience: ReadonlySet<string>;
  readonly authorizedParty: string;
  readonly subject: string;
  readonly scopes: readonly string[];
  readonly claims: Readonly<Record<string, unknown>>;
  readonly realmAccess: Access;
  readonly resourceAccess: ReadonlyMap<string, Access>;
  readonly sessionId: string;
  readonly issuedAt: Date;
  readonly authenticationTime: Date;
  readonly generateUserDataFromSubject: boolean;
  readonly notBefore?: Date;
  readonly expiration?: Date;
  readonly hostname?: string;
  readonly realm?: string;
  readonly name?: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly email?: string;
  readonly preferredUsername?: string;
  readonly authenticationContextClassReference?: string;

  constructor(options: TokenConfigOptions = {}, snapshot?: TokenConfigSnapshot) {
    const source = snapshot ?? buildFromOptions(options);
    this.audience = source.audience;
    this.authorizedParty = source.authorizedParty;
    this.subject = source.subject;
    this.scopes = source.scopes;
    this.claims = source.claims;
    this.realmAccess = source.realmAccess;
    this.resourceAccess = source.resourceAccess;
    this.sessionId = source.sessionId;
    this.issuedAt = source.issuedAt;
    this.authenticationTime = source.authenticationTime;
    this.generateUserDataFromSubject = source.generateUserDataFromSubject;
    this.notBefore = source.notBefore;
    this.expiration = source.expiration;
    this.hostname = source.hostname;
    this.realm = source.realm;
    this.name = source.name;
    this.givenName = source.givenName;
    this.familyName = source.familyName;
    this.email = source.email;
    this.preferredUsername = source.preferredUsername;
    this.authenticationContextClassReference = source.authenticationContextClassReference;
  }

  static aTokenConfig(): TokenConfigBuilder {
    return new TokenConfigBuilder();
  }

  getAudience(): ReadonlySet<string> {
    return new Set(this.audience);
  }

  getAuthorizedParty(): string {
    return this.authorizedParty;
  }

  getSubject(): string {
    return this.subject;
  }

  isGenerateUserDataFromSubject(): boolean {
    return this.generateUserDataFromSubject;
  }

  getScopes(): readonly string[] {
    return [...this.scopes];
  }

  getClaims(): Record<string, unknown> {
    return { ...this.claims };
  }

  getRealmAccess(): Access {
    return new Access(this.realmAccess.getRoles());
  }

  getResourceAccess(): Record<string, Access> {
    return Object.fromEntries([...this.resourceAccess].map(([resource, access]) => [resource, new Access(access.getRoles())]));
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getIssuedAt(): Date {
    return new Date(this.issuedAt.getTime());
  }

  getAuthenticationTime(): Date {
    return new Date(this.authenticationTime.getTime());
  }

  getNotBefore(): Date | undefined {
    return this.notBefore === undefined ? undefined : new Date(this.notBefore.getTime());
  }

  getExpiration(): Date | undefined {
    return this.expiration === undefined ? undefined : new Date(this.expiration.getTime());
  }

  getHostname(): string | undefined {
    return this.hostname;
  }

  getRealm(): string | undefined {
    return this.realm;
  }

  getName(): string | undefined {
    return this.name;
  }

  getGivenName(): string | undefined {
    return this.givenName;
  }

  getFamilyName(): string | undefined {
    return this.familyName;
  }

  getEmail(): string | undefined {
    return this.email;
  }

  getPreferredUsername(): string | undefined {
    return this.preferredUsername;
  }

  getAuthenticationContextClassReference(): string | undefined {
    return this.authenticationContextClassReference;
  }
}

interface TokenConfigSnapshot {
  audience: ReadonlySet<string>;
  authorizedParty: string;
  subject: string;
  scopes: readonly string[];
  claims: Readonly<Record<string, unknown>>;
  realmAccess: Access;
  resourceAccess: ReadonlyMap<string, Access>;
  sessionId: string;
  issuedAt: Date;
  authenticationTime: Date;
  generateUserDataFromSubject: boolean;
  notBefore?: Date;
  expiration?: Date;
  hostname?: string;
  realm?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  preferredUsername?: string;
  authenticationContextClassReference?: string;
}

export class TokenConfigBuilder {
  private readonly audience = new Set<string>();
  private authorizedParty = "client";
  private subject = "user";
  private readonly scopes: string[] = [];
  private readonly claims: Record<string, unknown> = {};
  private readonly realmRoles = new Access();
  private readonly resourceAccess = new Map<string, Access>();
  private sessionId: string = randomUUID();
  private issuedAt = new Date();
  private authenticationTime = new Date();
  private generateUserDataFromSubject = false;
  private notBefore?: Date;
  private expiration?: Date;
  private hostname?: string;
  private realm?: string;
  private givenName?: string;
  private familyName?: string;
  private name?: string;
  private email?: string;
  private preferredUsername?: string;
  private authenticationContextClassReference?: string;

  withSourceToken(originalToken: string): this {
    const payload = decodeJwtPayload(originalToken);
    for (const [key, value] of Object.entries(payload)) {
      switch (key) {
        case TokenConfig.CLAIM_AUDIENCE:
          if (typeof value === "string") {
            this.withAudience(value);
          } else if (Array.isArray(value)) {
            this.withAudiences(value.map(String));
          }
          break;
        case TokenConfig.CLAIM_AUTHORIZED_PARTY:
          this.withAuthorizedParty(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_SUBJECT:
          this.withSubject(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_NAME:
          this.withName(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_GIVEN_NAME:
          this.withGivenName(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_FAMILY_NAME:
          this.withFamilyName(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_EMAIL:
          this.withEmail(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_PREFERRED_USERNAME:
          this.withPreferredUsername(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_REALM_ACCESS:
          this.withRealmRoles(extractRoles(value, key));
          break;
        case TokenConfig.CLAIM_RESOURCE_ACCESS:
          for (const [resource, access] of Object.entries(expectRecord(value, key))) {
            this.withResourceRoles(resource, extractRoles(access, `${key}.${resource}`));
          }
          break;
        case TokenConfig.CLAIM_SCOPE:
          this.withScopes(expectType(value, "string", key).split(" ").filter(Boolean));
          break;
        case TokenConfig.CLAIM_AUTHENTICATION_CONTEXT_REFERENCE:
          this.withAuthenticationContextClassReference(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_TYPE:
          if (expectType(value, "string", key) !== "Bearer") {
            throw new TypeError("Only bearer tokens are allowed here");
          }
          break;
        case TokenConfig.CLAIM_ISSUER:
          this.applyIssuer(expectType(value, "string", key));
          break;
        case TokenConfig.CLAIM_SESSION_ID:
        case TokenConfig.CLAIM_SESSION_STATE:
        case TokenConfig.CLAIM_ISSUED_AT:
        case TokenConfig.CLAIM_NOT_BEFORE:
        case TokenConfig.CLAIM_EXPIRES_AT:
        case TokenConfig.CLAIM_AUTH_TIME:
          break;
        default:
          this.withClaim(key, value);
      }
    }
    return this;
  }

  withAudience(audience: string): this {
    this.audience.add(audience);
    return this;
  }

  withAudiences(audiences: Iterable<string>): this {
    for (const audience of audiences) {
      this.audience.add(audience);
    }
    return this;
  }

  withAuthorizedParty(authorizedParty: string): this {
    this.authorizedParty = authorizedParty;
    return this;
  }

  withSubject(subject: string): this {
    this.subject = subject;
    return this;
  }

  withSubjectAndGeneratedUserData(subject: string): this {
    this.subject = subject;
    this.generateUserDataFromSubject = true;
    return this;
  }

  withScope(scope: string): this {
    this.scopes.push(scope);
    return this;
  }

  withScopes(scopes: Iterable<string>): this {
    this.scopes.push(...scopes);
    return this;
  }

  withHostname(hostname: string): this {
    this.hostname = hostname;
    return this;
  }

  withRealm(realm: string): this {
    this.realm = realm;
    return this;
  }

  withRealmRoles(roles: Iterable<string>): this {
    this.realmRoles.addRoles(roles);
    return this;
  }

  withRealmRole(role: string): this {
    this.realmRoles.addRole(role);
    return this;
  }

  withResourceRoles(resource: string, roles: Iterable<string>): this {
    this.getOrCreateResourceAccess(resource).addRoles(roles);
    return this;
  }

  withResourceRole(resource: string, role: string): this {
    this.getOrCreateResourceAccess(resource).addRole(role);
    return this;
  }

  withSessionId(sessionId: string): this {
    this.sessionId = sessionId;
    return this;
  }

  withClaims(claims: Record<string, unknown>): this {
    Object.assign(this.claims, claims);
    return this;
  }

  withClaim(key: string, value: unknown): this {
    this.claims[key] = value;
    return this;
  }

  withIssuedAt(issuedAt: InstantInput): this {
    this.issuedAt = toDate(issuedAt, "issuedAt");
    return this;
  }

  withAuthenticationTime(authenticationTime: InstantInput): this {
    this.authenticationTime = toDate(authenticationTime, "authenticationTime");
    return this;
  }

  withExpiration(expiration: InstantInput): this {
    this.expiration = toDate(expiration, "expiration");
    return this;
  }

  withTokenLifespan(tokenLifespan: DurationInput): this {
    this.expiration = addMilliseconds(this.issuedAt, parseDuration(tokenLifespan, "tokenLifespan"));
    return this;
  }

  withNotBefore(notBefore: InstantInput | null | undefined): this {
    this.notBefore = notBefore == null ? undefined : toDate(notBefore, "notBefore");
    return this;
  }

  withGivenName(givenName: string | null | undefined): this {
    this.givenName = givenName ?? undefined;
    return this;
  }

  withFamilyName(familyName: string | null | undefined): this {
    this.familyName = familyName ?? undefined;
    return this;
  }

  withName(name: string | null | undefined): this {
    this.name = name ?? undefined;
    return this;
  }

  withEmail(email: string | null | undefined): this {
    this.email = email ?? undefined;
    return this;
  }

  withPreferredUsername(preferredUsername: string | null | undefined): this {
    this.preferredUsername = preferredUsername ?? undefined;
    return this;
  }

  withAuthenticationContextClassReference(authenticationContextClassReference: string | null | undefined): this {
    this.authenticationContextClassReference = authenticationContextClassReference ?? undefined;
    return this;
  }

  build(): TokenConfig {
    const name = this.name ?? deriveName(this.givenName, this.familyName);
    return new TokenConfig({}, {
      audience: new Set(this.audience),
      authorizedParty: this.authorizedParty,
      subject: this.subject,
      scopes: [...this.scopes],
      claims: { ...this.claims },
      realmAccess: new Access(this.realmRoles.getRoles()),
      resourceAccess: new Map([...this.resourceAccess].map(([resource, access]) => [resource, new Access(access.getRoles())])),
      sessionId: this.sessionId,
      issuedAt: new Date(this.issuedAt.getTime()),
      authenticationTime: new Date(this.authenticationTime.getTime()),
      generateUserDataFromSubject: this.generateUserDataFromSubject,
      notBefore: cloneOptionalDate(this.notBefore),
      expiration: cloneOptionalDate(this.expiration),
      hostname: this.hostname,
      realm: this.realm,
      name,
      givenName: this.givenName,
      familyName: this.familyName,
      email: this.email,
      preferredUsername: this.preferredUsername,
      authenticationContextClassReference: this.authenticationContextClassReference
    });
  }

  private getOrCreateResourceAccess(resource: string): Access {
    const existing = this.resourceAccess.get(resource);
    if (existing !== undefined) {
      return existing;
    }
    const access = new Access();
    this.resourceAccess.set(resource, access);
    return access;
  }

  private applyIssuer(issuer: string): void {
    let issuerUrl: URL;
    try {
      issuerUrl = new URL(issuer);
    } catch (error) {
      throw new TypeError(`Issuer '${issuer}' is not a valid URL`, { cause: error });
    }
    const match = issuerUrl.pathname.match(/^.*\/realms\/([^/]+)$/u);
    if (match === null) {
      throw new TypeError(
        `The issuer '${issuer}' did not conform to the expected format 'http[s]://$HOSTNAME[:$PORT][/$CONTEXT_PATH]/realms/$REALM'.`
      );
    }
    this.withHostname(issuerUrl.host);
    this.withRealm(match[1] as string);
  }
}

export function aTokenConfig(): TokenConfigBuilder {
  return TokenConfig.aTokenConfig();
}

export function toTokenConfig(input: TokenConfig | TokenConfigOptions | undefined): TokenConfig {
  if (input instanceof TokenConfig) {
    return input;
  }
  return new TokenConfig(input);
}

function buildFromOptions(options: TokenConfigOptions): TokenConfigSnapshot {
  const builder = TokenConfig.aTokenConfig();
  applyOptions(builder, options);
  const built = builder.build();
  return {
    audience: built.audience,
    authorizedParty: built.authorizedParty,
    subject: built.subject,
    scopes: built.scopes,
    claims: built.claims,
    realmAccess: built.realmAccess,
    resourceAccess: built.resourceAccess,
    sessionId: built.sessionId,
    issuedAt: built.issuedAt,
    authenticationTime: built.authenticationTime,
    generateUserDataFromSubject: built.generateUserDataFromSubject,
    notBefore: built.notBefore,
    expiration: built.expiration,
    hostname: built.hostname,
    realm: built.realm,
    name: built.name,
    givenName: built.givenName,
    familyName: built.familyName,
    email: built.email,
    preferredUsername: built.preferredUsername,
    authenticationContextClassReference: built.authenticationContextClassReference
  };
}

function applyOptions(builder: TokenConfigBuilder, options: TokenConfigOptions): void {
  if (typeof options.audience === "string") {
    builder.withAudience(options.audience);
  } else if (options.audience !== undefined) {
    builder.withAudiences(options.audience);
  }
  if (options.authorizedParty !== undefined) builder.withAuthorizedParty(options.authorizedParty);
  if (options.subject !== undefined) {
    if (options.generateUserDataFromSubject === true) {
      builder.withSubjectAndGeneratedUserData(options.subject);
    } else {
      builder.withSubject(options.subject);
    }
  } else if (options.generateUserDataFromSubject === true) {
    builder.withSubjectAndGeneratedUserData("user");
  }
  if (options.scopes !== undefined) builder.withScopes(options.scopes);
  if (options.claims !== undefined) builder.withClaims(options.claims);
  if (options.realmRoles !== undefined) builder.withRealmRoles(options.realmRoles);
  if (options.resourceRoles !== undefined) {
    for (const [resource, roles] of Object.entries(options.resourceRoles)) {
      builder.withResourceRoles(resource, roles);
    }
  }
  if (options.sessionId !== undefined) builder.withSessionId(options.sessionId);
  if (options.issuedAt !== undefined) builder.withIssuedAt(options.issuedAt);
  if (options.authenticationTime !== undefined) builder.withAuthenticationTime(options.authenticationTime);
  if (options.tokenLifespan !== undefined) builder.withTokenLifespan(options.tokenLifespan);
  if (options.notBefore !== undefined) builder.withNotBefore(options.notBefore);
  if (options.expiration !== undefined && options.expiration !== null) builder.withExpiration(options.expiration);
  if (options.hostname !== undefined) builder.withHostname(options.hostname);
  if (options.realm !== undefined) builder.withRealm(options.realm);
  if (options.name !== undefined) builder.withName(options.name);
  if (options.givenName !== undefined) builder.withGivenName(options.givenName);
  if (options.familyName !== undefined) builder.withFamilyName(options.familyName);
  if (options.email !== undefined) builder.withEmail(options.email);
  if (options.preferredUsername !== undefined) builder.withPreferredUsername(options.preferredUsername);
  if (options.authenticationContextClassReference !== undefined) {
    builder.withAuthenticationContextClassReference(options.authenticationContextClassReference);
  }
}

function deriveName(givenName: string | undefined, familyName: string | undefined): string | undefined {
  if (givenName !== undefined && familyName !== undefined) return `${givenName} ${familyName}`;
  return givenName ?? familyName;
}

function cloneOptionalDate(date: Date | undefined): Date | undefined {
  return date === undefined ? undefined : new Date(date.getTime());
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  const payload = parts[1];
  if (payload === undefined) {
    throw new TypeError("Token must contain a JWT payload");
  }
  const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return expectRecord(parsed, "payload");
}

function extractRoles(value: unknown, key: string): string[] {
  const roles = expectRecord(value, key).roles;
  if (!Array.isArray(roles)) {
    throw new TypeError(`Expected roles array for key ${key}`);
  }
  return roles.map(String);
}

function expectRecord(value: unknown, key: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`Expected object for key ${key}, but found ${typeof value}`);
}

function expectType(value: unknown, type: "string", key: string): string {
  if (type === "string" && typeof value === "string") {
    return value;
  }
  throw new TypeError(`Expected ${type} for key ${key}, but found ${typeof value}`);
}
