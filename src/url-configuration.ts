import { defaultPortForProtocol, type ServerConfig } from "./config.js";

const ISSUER_PATH = "/realms/";
const AUTHENTICATION_CALLBACK_PATH = "authenticate/";
const OUT_OF_BAND_PATH = "oob";
const ISSUER_OPEN_ID_PATH = "protocol/openid-connect/";
const OPEN_ID_TOKEN_PATH = "token";
const OPEN_ID_TOKEN_INTROSPECTION_PATH = `${OPEN_ID_TOKEN_PATH}/introspect`;
const OPEN_ID_JWKS_PATH = "certs";
const OPEN_ID_AUTHORIZATION_PATH = "auth";
const OPEN_ID_END_SESSION_PATH = "logout";

export class UrlConfiguration {
  readonly protocol: string;
  readonly hostname: string;
  readonly contextPath: string;
  readonly realm: string;

  constructor(serverConfig: ServerConfig, requestHost?: string | null, requestRealm?: string | null, actualPort?: number) {
    this.protocol = serverConfig.protocol;
    const effectivePort = actualPort ?? serverConfig.port;
    if (requestHost !== undefined && requestHost !== null && requestHost !== "") {
      this.hostname = requestHost;
    } else if (defaultPortForProtocol(serverConfig.protocol) === effectivePort || serverConfig.defaultHostname.includes(":")) {
      this.hostname = serverConfig.defaultHostname;
    } else {
      this.hostname = `${serverConfig.defaultHostname}:${effectivePort}`;
    }
    this.contextPath = serverConfig.contextPath;
    this.realm = requestRealm ?? serverConfig.defaultRealm;
  }

  getBaseUrl(): string {
    return `${this.protocol}://${this.hostname}`;
  }

  getJs(): string {
    return this.withContextPath("/js");
  }

  getJsPath(): string {
    return `${this.getJs()}/`;
  }

  getIssuer(): string {
    return this.withContextPath(`${ISSUER_PATH}${this.realm}`);
  }

  getIssuerPath(): string {
    return `${this.getIssuer()}/`;
  }

  getOpenIdPath(path: string): string {
    return new URL(`${ISSUER_OPEN_ID_PATH}${path}`, this.getIssuerPath()).toString();
  }

  getAuthenticationCallbackEndpoint(sessionId: string): string {
    return new URL(`${AUTHENTICATION_CALLBACK_PATH}${sessionId}`, this.getIssuerPath()).toString();
  }

  getOutOfBandLoginLoginEndpoint(): string {
    return new URL(OUT_OF_BAND_PATH, this.getIssuerPath()).toString();
  }

  getAuthorizationEndpoint(): string {
    return this.getOpenIdPath(OPEN_ID_AUTHORIZATION_PATH);
  }

  getEndSessionEndpoint(): string {
    return this.getOpenIdPath(OPEN_ID_END_SESSION_PATH);
  }

  getTokenEndpoint(): string {
    return this.getOpenIdPath(OPEN_ID_TOKEN_PATH);
  }

  getTokenIntrospectionEndpoint(): string {
    return this.getOpenIdPath(OPEN_ID_TOKEN_INTROSPECTION_PATH);
  }

  getJwksUri(): string {
    return this.getOpenIdPath(OPEN_ID_JWKS_PATH);
  }

  getProtocol(): string {
    return this.protocol;
  }

  getHostname(): string {
    return this.hostname;
  }

  getRealm(): string {
    return this.realm;
  }

  private withContextPath(path: string): string {
    return `${this.getBaseUrl()}${this.contextPath}${path}`;
  }
}
