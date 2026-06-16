import { parseDuration, uniqueStrings } from "./duration.js";
import { LoginRoleMapping, Protocol, type DurationInput, type ServerConfigOptions } from "./types.js";

const DEFAULT_HOSTNAME = "localhost";
const DEFAULT_CONTEXT_PATH = "/auth";
const DEFAULT_PORT = 8_000;
const DEFAULT_REALM = "master";
const DEFAULT_SCOPE = "openid";
const DEFAULT_AUDIENCE = "server";
const DEFAULT_TOKEN_LIFESPAN = "10h";

export class ServerConfig {
  readonly port: number;
  readonly protocol: Protocol;
  readonly defaultHostname: string;
  readonly contextPath: string;
  readonly defaultRealm: string;
  readonly defaultAudiences: readonly string[];
  readonly defaultScopes: readonly string[];
  readonly defaultTokenLifespanMs: number;
  readonly loginRoleMapping: LoginRoleMapping;

  constructor(options: ServerConfigOptions = {}) {
    const tls = options.tls ?? options.protocol === Protocol.HTTPS;
    this.protocol = tls ? Protocol.HTTPS : Protocol.HTTP;
    this.port = normalizePort(options.port ?? DEFAULT_PORT);
    this.defaultHostname = options.defaultHostname ?? DEFAULT_HOSTNAME;
    this.contextPath = normalizeContextPath(options.contextPath ?? DEFAULT_CONTEXT_PATH);
    this.defaultRealm = options.defaultRealm ?? DEFAULT_REALM;

    const audiences = [...(options.defaultAudiences ?? [])];
    this.defaultAudiences = audiences.length === 0 ? [DEFAULT_AUDIENCE] : uniqueStrings(audiences);
    this.defaultScopes = uniqueStrings([DEFAULT_SCOPE, ...(options.defaultScopes ?? [])]);
    this.defaultTokenLifespanMs = parseDuration(options.defaultTokenLifespan ?? DEFAULT_TOKEN_LIFESPAN, "defaultTokenLifespan");
    this.loginRoleMapping = options.loginRoleMapping ?? LoginRoleMapping.TO_REALM;
  }

  static aServerConfig(): ServerConfigBuilder {
    return new ServerConfigBuilder();
  }

  getPort(): number {
    return this.port;
  }

  getProtocol(): Protocol {
    return this.protocol;
  }

  getDefaultAudiences(): readonly string[] {
    return this.defaultAudiences;
  }

  getDefaultHostname(): string {
    return this.defaultHostname;
  }

  getContextPath(): string {
    return this.contextPath;
  }

  getDefaultRealm(): string {
    return this.defaultRealm;
  }

  getDefaultScopes(): readonly string[] {
    return this.defaultScopes;
  }

  getDefaultTokenLifespanMs(): number {
    return this.defaultTokenLifespanMs;
  }

  getLoginRoleMapping(): LoginRoleMapping {
    return this.loginRoleMapping;
  }
}

export class ServerConfigBuilder {
  private port = DEFAULT_PORT;
  private protocol: Protocol = Protocol.HTTP;
  private defaultHostname = DEFAULT_HOSTNAME;
  private contextPath = DEFAULT_CONTEXT_PATH;
  private defaultRealm = DEFAULT_REALM;
  private readonly defaultAudiences: string[] = [];
  private readonly defaultScopes: string[] = [DEFAULT_SCOPE];
  private defaultTokenLifespan: DurationInput = DEFAULT_TOKEN_LIFESPAN;
  private loginRoleMapping: LoginRoleMapping = LoginRoleMapping.TO_REALM;

  withTls(tls: boolean): this {
    this.protocol = tls ? Protocol.HTTPS : Protocol.HTTP;
    return this;
  }

  withPort(port: number): this {
    this.port = port;
    return this;
  }

  withRandomPort(): this {
    this.port = 0;
    return this;
  }

  withDefaultHostname(defaultHostname: string): this {
    this.defaultHostname = defaultHostname;
    return this;
  }

  withDefaultRealm(defaultRealm: string): this {
    this.defaultRealm = defaultRealm;
    return this;
  }

  withDefaultAudiences(audiences: Iterable<string>): this {
    this.defaultAudiences.push(...audiences);
    return this;
  }

  withDefaultAudience(audience: string): this {
    this.defaultAudiences.push(audience);
    return this;
  }

  withContextPath(contextPath: string): this {
    this.contextPath = contextPath;
    return this;
  }

  withNoContextPath(): this {
    this.contextPath = "";
    return this;
  }

  withDefaultScopes(scopes: Iterable<string>): this {
    this.defaultScopes.push(...scopes);
    return this;
  }

  withDefaultScope(scope: string): this {
    this.defaultScopes.push(scope);
    return this;
  }

  withDefaultTokenLifespan(tokenLifespan: DurationInput): this {
    this.defaultTokenLifespan = tokenLifespan;
    return this;
  }

  withLoginRoleMapping(loginRoleMapping: LoginRoleMapping): this {
    this.loginRoleMapping = loginRoleMapping;
    return this;
  }

  build(): ServerConfig {
    return new ServerConfig({
      port: this.port,
      protocol: this.protocol,
      defaultHostname: this.defaultHostname,
      contextPath: this.contextPath,
      defaultRealm: this.defaultRealm,
      defaultAudiences: this.defaultAudiences,
      defaultScopes: this.defaultScopes,
      defaultTokenLifespan: this.defaultTokenLifespan,
      loginRoleMapping: this.loginRoleMapping
    });
  }
}

export function aServerConfig(): ServerConfigBuilder {
  return ServerConfig.aServerConfig();
}

export function normalizeContextPath(contextPath: string): string {
  if (contextPath === "" || contextPath === "/") {
    return "";
  }
  return contextPath.startsWith("/") ? contextPath.replace(/\/+$/u, "") : `/${contextPath.replace(/\/+$/u, "")}`;
}

export function defaultPortForProtocol(protocol: Protocol): number {
  return protocol === Protocol.HTTPS ? 443 : 80;
}

function normalizePort(port: number): number {
  return port > 0 ? Math.trunc(port) : 0;
}
