import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";
import { randomUUID } from "node:crypto";
import { generate as generateSelfSignedCertificate } from "selfsigned";
import { ServerConfig } from "./config.js";
import { AdHocSession, PersistentSession, SessionRepository, SessionRequest, UserData } from "./session.js";
import { toTokenConfig, type TokenConfig } from "./token-config.js";
import { TokenGenerator } from "./token-generator.js";
import { LoginRoleMapping, Protocol, type JwtClaims, type ServerConfigOptions, type TokenConfigOptions, type TokenResponse } from "./types.js";
import { UrlConfiguration } from "./url-configuration.js";

type NodeServer = HttpServer | HttpsServer;

interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  method: string;
  url: URL;
  path: string;
  form: URLSearchParams;
  realm: string;
  tail: string;
  requestConfiguration: UrlConfiguration;
}

interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

export class MockServerException extends Error {
  readonly name = "MockServerException";
}

export class KeycloakMock {
  private readonly serverConfig: ServerConfig;
  private readonly tokenGenerator: TokenGenerator;
  private readonly sessions = new SessionRepository();
  private server?: NodeServer;

  constructor(serverConfig: ServerConfig | ServerConfigOptions = new ServerConfig()) {
    this.serverConfig = serverConfig instanceof ServerConfig ? serverConfig : new ServerConfig(serverConfig);
    this.tokenGenerator = new TokenGenerator(
      this.serverConfig.defaultScopes,
      this.serverConfig.defaultAudiences,
      this.serverConfig.defaultTokenLifespanMs
    );
  }

  getAccessToken(tokenConfig: TokenConfig | TokenConfigOptions = {}): string {
    const config = toTokenConfig(tokenConfig);
    const requestConfiguration = new UrlConfiguration(
      this.serverConfig,
      config.getHostname(),
      config.getRealm(),
      this.getEffectivePortForIssuer()
    );
    return this.tokenGenerator.getToken(config, requestConfiguration);
  }

  parseToken(token: string): JwtClaims {
    return this.tokenGenerator.parseToken(token);
  }

  getJwks(): { keys: Record<string, unknown>[] } {
    return this.tokenGenerator.getJwks();
  }

  async start(): Promise<void> {
    if (this.server !== undefined) {
      return;
    }

    const listener = (request: IncomingMessage, response: ServerResponse): void => {
      void this.handleRequest(request, response).catch((error: unknown) => {
        if (!response.headersSent) {
          sendJson(response, 500, { error: "mock_server_error", error_description: String(error) });
        } else {
          response.destroy(error instanceof Error ? error : undefined);
        }
      });
    };

    this.server =
      this.serverConfig.protocol === Protocol.HTTPS
        ? createHttpsServer(await createSelfSignedCertificate(this.serverConfig.defaultHostname), listener)
        : createHttpServer(listener);

    await new Promise<void>((resolve, reject) => {
      const server = this.server as NodeServer;
      const onError = (error: Error): void => {
        server.off("listening", onListening);
        reject(new MockServerException(`Error while starting mock server: ${error.message}`));
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.serverConfig.port);
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (server === undefined) {
      return;
    }
    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error !== undefined) {
          reject(new MockServerException(`Error while stopping mock server: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  getActualPort(): number {
    if (this.server === undefined) {
      throw new Error("Server is not running");
    }
    const address = this.server.address();
    if (typeof address === "object" && address !== null) {
      return address.port;
    }
    throw new Error("Server is not listening on a TCP port");
  }

  getIssuer(realm = this.serverConfig.defaultRealm): string {
    return new UrlConfiguration(this.serverConfig, null, realm, this.getEffectivePortForIssuer()).getIssuer();
  }

  getWellKnownUrl(realm = this.serverConfig.defaultRealm): string {
    return `${this.getIssuer(realm)}/.well-known/openid-configuration`;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    setCommonHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const method = request.method ?? "GET";
    const host = request.headers.host ?? `${this.serverConfig.defaultHostname}:${this.getEffectivePortForIssuer()}`;
    const url = new URL(request.url ?? "/", `${this.serverConfig.protocol}://${host}`);
    const path = decodeURIComponent(url.pathname);
    const form = await readForm(request);

    if (path === "/docs") {
      this.handleDocumentation(request, response);
      return;
    }

    if (this.handleStaticResource(path, response)) {
      return;
    }

    const realmRoute = this.matchRealmRoute(path);
    if (realmRoute === undefined) {
      sendText(response, 404, "Not found");
      return;
    }

    const context: RequestContext = {
      request,
      response,
      method,
      url,
      path,
      form,
      realm: realmRoute.realm,
      tail: realmRoute.tail,
      requestConfiguration: new UrlConfiguration(this.serverConfig, host, realmRoute.realm, this.getEffectivePortForIssuer())
    };

    await this.dispatchRealmRoute(context);
  }

  private async dispatchRealmRoute(context: RequestContext): Promise<void> {
    const { method, tail } = context;

    if (method === "GET" && tail.startsWith("/.well-known/")) {
      this.handleWellKnown(context);
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/certs") {
      sendJson(context.response, 200, this.tokenGenerator.getJwks());
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/auth") {
      this.handleLoginPage(context);
      return;
    }
    if (method === "POST" && tail.startsWith("/authenticate/")) {
      this.handleAuthentication(context, tail.slice("/authenticate/".length));
      return;
    }
    if (method === "POST" && tail === "/protocol/openid-connect/token/introspect") {
      this.handleTokenIntrospection(context);
      return;
    }
    if (method === "POST" && tail === "/protocol/openid-connect/token") {
      this.handleToken(context);
      return;
    }
    if ((method === "GET" || method === "POST") && tail === "/protocol/openid-connect/logout") {
      this.handleLogout(context);
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/login-status-iframe.html/init") {
      context.response.writeHead(204).end();
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/login-status-iframe.html") {
      sendHtml(context.response, 200, loginStatusIframeHtml(context.requestConfiguration));
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/3p-cookies/step1.html") {
      sendHtml(context.response, 200, thirdPartyCookiesHtml("step1"));
      return;
    }
    if (method === "GET" && tail === "/protocol/openid-connect/3p-cookies/step2.html") {
      sendHtml(context.response, 200, thirdPartyCookiesHtml("step2"));
      return;
    }
    if (method === "GET" && tail === "/oob") {
      sendHtml(context.response, 200, outOfBandHtml(context.url.searchParams.get("code") ?? "invalid"));
      return;
    }

    sendText(context.response, 404, "Not found");
  }

  private handleWellKnown(context: RequestContext): void {
    sendJson(context.response, 200, {
      issuer: context.requestConfiguration.getIssuer(),
      authorization_endpoint: context.requestConfiguration.getAuthorizationEndpoint(),
      token_endpoint: context.requestConfiguration.getTokenEndpoint(),
      introspection_endpoint: context.requestConfiguration.getTokenIntrospectionEndpoint(),
      jwks_uri: context.requestConfiguration.getJwksUri(),
      end_session_endpoint: context.requestConfiguration.getEndSessionEndpoint(),
      response_types_supported: ["code", "code id_token", "id_token", "token id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"]
    });
  }

  private handleLoginPage(context: RequestContext): void {
    const existingSession = this.getSessionFromCookie(context);
    const clientId = context.url.searchParams.get("client_id");
    const redirectUri = context.url.searchParams.get("redirect_uri");
    const responseType = context.url.searchParams.get("response_type");

    if (clientId === null || redirectUri === null || responseType === null) {
      sendText(context.response, 400, "Mandatory parameter missing");
      return;
    }

    const request = new SessionRequest(
      clientId,
      existingSession?.getSessionId() ?? randomUUID(),
      responseType,
      redirectUri,
      context.url.searchParams.get("state") ?? undefined,
      context.url.searchParams.get("response_mode") ?? undefined,
      context.url.searchParams.get("nonce") ?? undefined
    );

    if (existingSession !== undefined) {
      const newSession = request.toSession(existingSession.getUserData(), existingSession.getRoles());
      this.sessions.updateSession(existingSession, newSession);
      this.redirectToSession(context, newSession);
      return;
    }

    this.sessions.putRequest(request);
    sendHtml(context.response, 200, loginPageHtml(context.requestConfiguration.getAuthenticationCallbackEndpoint(request.sessionId)));
  }

  private handleAuthentication(context: RequestContext, sessionId: string): void {
    const request = this.sessions.getRequest(sessionId);
    if (request === undefined) {
      sendText(context.response, 404, "Unknown session");
      return;
    }
    const username = context.form.get("username");
    if (username === null) {
      sendText(context.response, 400, "Missing username");
      return;
    }
    const roles = context.form.get("password")?.split(",") ?? [];
    const session = request.toSession(UserData.fromUsernameAndHostname(username, context.requestConfiguration.getHostname()), roles);
    this.sessions.upgradeRequest(request, session);
    this.redirectToSession(context, session);
  }

  private handleToken(context: RequestContext): void {
    const grantType = context.form.get("grant_type");
    const credentials = extractClientCredentials(context.request, context.form);

    switch (grantType) {
      case "authorization_code": {
        const sessionId = context.form.get("code");
        const session = this.sessions.getSession(sessionId);
        if (session === undefined) {
          sendText(context.response, 404, "Unknown authorization code");
          return;
        }
        sendJson(context.response, 200, this.toTokenResponse(this.getTokenForSession(session, context.requestConfiguration), session.getSessionId()));
        return;
      }
      case "refresh_token": {
        const refreshToken = context.form.get("refresh_token");
        if (refreshToken === null || refreshToken === "") {
          sendText(context.response, 400, "Missing refresh token");
          return;
        }
        const claims = this.tokenGenerator.parseToken(refreshToken);
        const sessionId = typeof claims.session_state === "string" ? claims.session_state : "";
        sendJson(context.response, 200, this.toTokenResponse(refreshToken, sessionId));
        return;
      }
      case "password": {
        if (credentials.clientId === undefined || credentials.clientId === "") {
          sendText(context.response, 400, "Missing client_id");
          return;
        }
        const username = context.form.get("username");
        if (username === null || username === "") {
          sendText(context.response, 400, "Missing username");
          return;
        }
        const session = AdHocSession.fromClientIdUsernameAndPassword(
          credentials.clientId,
          context.requestConfiguration.getHostname(),
          username,
          context.form.get("password")
        );
        sendJson(context.response, 200, this.toTokenResponse(this.getTokenForSession(session, context.requestConfiguration), session.getSessionId()));
        return;
      }
      case "client_credentials": {
        if (credentials.clientId === undefined || credentials.clientId === "") {
          sendText(context.response, 401, "Missing client authentication");
          return;
        }
        const session = AdHocSession.fromClientIdUsernameAndPassword(
          credentials.clientId,
          context.requestConfiguration.getHostname(),
          credentials.clientId,
          credentials.clientSecret
        );
        sendJson(context.response, 200, this.toTokenResponse(this.getTokenForSession(session, context.requestConfiguration), session.getSessionId()));
        return;
      }
      default:
        sendText(context.response, 400, "Unsupported grant type");
    }
  }

  private handleTokenIntrospection(context: RequestContext): void {
    const credentials = extractClientCredentials(context.request, context.form);
    if (credentials.clientId === undefined || credentials.clientId === "") {
      sendText(context.response, 401, "Missing client authentication");
      return;
    }

    try {
      const token = context.form.get("token") ?? "";
      const claims = this.tokenGenerator.parseToken(token);
      const audience = Array.isArray(claims.aud) ? claims.aud : typeof claims.aud === "string" ? [claims.aud] : [];
      if (audience.includes(credentials.clientId)) {
        sendJson(context.response, 200, { ...claims, active: true });
        return;
      }
    } catch {
      // Introspection returns active false for invalid tokens.
    }
    sendJson(context.response, 200, { active: false });
  }

  private handleLogout(context: RequestContext): void {
    const redirectUri = context.url.searchParams.get("post_logout_redirect_uri") ?? context.url.searchParams.get("redirect_uri");
    const session = this.getSessionFromCookie(context);
    if (session !== undefined) {
      this.sessions.removeSession(session.getSessionId());
    }
    context.response.setHeader("set-cookie", this.invalidateSessionCookie(context.requestConfiguration));
    context.response.writeHead(302, { location: redirectUri ?? "" }).end();
  }

  private handleDocumentation(request: IncomingMessage, response: ServerResponse): void {
    if (request.headers.accept?.includes("application/json") === true) {
      sendJson(response, 200, documentedRoutes(this.serverConfig.contextPath));
      return;
    }
    sendHtml(response, 200, docsHtml(documentedRoutes(this.serverConfig.contextPath)));
  }

  private handleStaticResource(path: string, response: ServerResponse): boolean {
    const jsPath = `${this.serverConfig.contextPath}/js/keycloak.js`;
    const shimPath = `${this.serverConfig.contextPath}/js/vendor/web-crypto-shim/web-crypto-shim.js`;
    if (path === jsPath) {
      sendJs(response, 200, "globalThis.Keycloak ??= function Keycloak(config) { return { config, init: async () => true }; };\n");
      return true;
    }
    if (path === shimPath) {
      sendJs(
        response,
        200,
        "globalThis.crypto ??= {};\nglobalThis.crypto.randomUUID ??= function randomUUID() { return '00000000-0000-4000-8000-000000000000'; };\n"
      );
      return true;
    }
    if (path === "/style.css") {
      sendCss(response, 200, "body{font-family:system-ui,sans-serif;margin:2rem;max-width:36rem}label,input{display:block;margin:.5rem 0}input{padding:.4rem;width:100%}button{padding:.5rem .8rem}");
      return true;
    }
    return false;
  }

  private redirectToSession(context: RequestContext, session: PersistentSession): void {
    const location = this.getRedirectLocation(session, context.requestConfiguration);
    if (location === undefined) {
      sendText(context.response, 400, "Invalid redirect request");
      return;
    }
    context.response.setHeader("set-cookie", this.getSessionCookie(session, context.requestConfiguration));
    context.response.writeHead(302, { location }).end();
  }

  private getRedirectLocation(session: PersistentSession, requestConfiguration: UrlConfiguration): string | undefined {
    const responseType = parseResponseType(session.getResponseType());
    if (responseType === undefined) {
      return undefined;
    }

    const redirectUriBase =
      session.getRedirectUri() === "urn:ietf:wg:oauth:2.0:oob"
        ? requestConfiguration.getOutOfBandLoginLoginEndpoint()
        : session.getRedirectUri();

    let redirectUrl: URL;
    try {
      redirectUrl = new URL(redirectUriBase);
    } catch {
      return undefined;
    }

    const responseMode = validResponseMode(responseType, session.getResponseMode());
    const parameters = this.getRedirectParameters(session, requestConfiguration, responseType);
    if (responseMode === "fragment") {
      redirectUrl.hash = appendParameters(redirectUrl.hash.replace(/^#/u, ""), parameters);
    } else {
      redirectUrl.search = appendParameters(redirectUrl.search.replace(/^\?/u, ""), parameters);
    }
    return redirectUrl.toString();
  }

  private getRedirectParameters(session: PersistentSession, requestConfiguration: UrlConfiguration, responseType: ResponseType): string[] {
    const parameters = [`session_state=${session.getSessionId()}`];
    const state = session.getState();
    if (state !== undefined) {
      parameters.push(`state=${state}`);
    }

    const token = this.getTokenForSession(session, requestConfiguration);
    switch (responseType.kind) {
      case "code":
        parameters.push(`code=${session.getSessionId()}`);
        break;
      case "id_token":
        parameters.push(`id_token=${token}`);
        break;
      case "id_token token":
        parameters.push(`id_token=${token}`, `access_token=${token}`, "token_type=bearer");
        break;
      case "none":
        break;
    }
    return parameters;
  }

  private getSessionCookie(session: PersistentSession, requestConfiguration: UrlConfiguration): string {
    return [
      `KEYCLOAK_SESSION=${requestConfiguration.getRealm()}/dummy-user-id/${session.getSessionId()}`,
      `Path=${new URL(requestConfiguration.getIssuerPath()).pathname}`,
      "Max-Age=36000",
      "SameSite=Lax"
    ].join("; ");
  }

  private invalidateSessionCookie(requestConfiguration: UrlConfiguration): string {
    return [
      `KEYCLOAK_SESSION=${requestConfiguration.getRealm()}/dummy-user-id`,
      `Path=${new URL(requestConfiguration.getIssuerPath()).pathname}`,
      "Max-Age=0",
      "SameSite=Lax"
    ].join("; ");
  }

  private getSessionFromCookie(context: RequestContext): PersistentSession | undefined {
    const value = parseCookies(context.request.headers.cookie).get("KEYCLOAK_SESSION");
    const sessionId = value?.split("/").at(-1);
    return this.sessions.getSession(sessionId);
  }

  private getTokenForSession(session: PersistentSession | AdHocSession, requestConfiguration: UrlConfiguration): string {
    return this.tokenGenerator.getTokenForSession(
      session,
      requestConfiguration,
      this.serverConfig.defaultAudiences,
      this.serverConfig.loginRoleMapping
    );
  }

  private toTokenResponse(token: string, sessionId: string): TokenResponse {
    return {
      access_token: token,
      token_type: "Bearer",
      expires_in: 36_000,
      refresh_token: token,
      refresh_expires_in: 36_000,
      id_token: token,
      session_state: sessionId
    };
  }

  private matchRealmRoute(path: string): { realm: string; tail: string } | undefined {
    const prefix = `${this.serverConfig.contextPath}/realms/`;
    if (!path.startsWith(prefix)) {
      return undefined;
    }
    const remainder = path.slice(prefix.length);
    const slashIndex = remainder.indexOf("/");
    if (slashIndex < 0) {
      return undefined;
    }
    return {
      realm: remainder.slice(0, slashIndex),
      tail: remainder.slice(slashIndex)
    };
  }

  private getEffectivePortForIssuer(): number {
    if (this.serverConfig.port !== 0 || this.server === undefined) {
      return this.serverConfig.port;
    }
    return this.getActualPort();
  }
}

interface ResponseType {
  kind: "code" | "id_token" | "id_token token" | "none";
  defaultMode: "query" | "fragment";
  differentModeAllowed: boolean;
}

function parseResponseType(value: string): ResponseType | undefined {
  switch (value) {
    case "id_token":
      return { kind: "id_token", defaultMode: "fragment", differentModeAllowed: false };
    case "token id_token":
    case "id_token token":
      return { kind: "id_token token", defaultMode: "fragment", differentModeAllowed: false };
    case "code":
      return { kind: "code", defaultMode: "query", differentModeAllowed: true };
    case "none":
      return { kind: "none", defaultMode: "query", differentModeAllowed: true };
    default:
      return undefined;
  }
}

function validResponseMode(responseType: ResponseType, requestedMode: string | undefined): "query" | "fragment" {
  if (!responseType.differentModeAllowed) {
    return responseType.defaultMode;
  }
  return requestedMode === "fragment" || requestedMode === "query" ? requestedMode : responseType.defaultMode;
}

function appendParameters(existingParameters: string, newParameters: readonly string[]): string {
  const parameterString = newParameters.filter(Boolean).join("&");
  if (existingParameters === "") {
    return parameterString;
  }
  if (parameterString === "") {
    return existingParameters;
  }
  return `${existingParameters}&${parameterString}`;
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  if (!["POST", "PUT", "PATCH"].includes(request.method ?? "")) {
    return new URLSearchParams();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] ?? "";
  if (Array.isArray(contentType) ? contentType.some((value) => value.includes("application/json")) : contentType.includes("application/json")) {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
  }
  return new URLSearchParams(body);
}

function extractClientCredentials(request: IncomingMessage, form: URLSearchParams): ClientCredentials {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Basic ") === true) {
    return decodeBasicCredentials(authorization.slice("Basic ".length));
  }
  return {
    clientId: form.get("client_id") ?? undefined,
    clientSecret: form.get("client_secret") ?? undefined
  };
}

function decodeBasicCredentials(encodedValue: string): ClientCredentials {
  const encoded = encodedValue.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded) || encoded.length % 4 === 1) {
    return {};
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const normalizedInput = encoded.replace(/=+$/u, "");
  const normalizedRoundTrip = Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/u, "");
  if (normalizedInput !== normalizedRoundTrip) {
    return {};
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) {
    return { clientId: decoded };
  }
  return {
    clientId: decoded.slice(0, separator),
    clientSecret: decoded.slice(separator + 1)
  };
}

async function createSelfSignedCertificate(hostname: string): Promise<{ key: string; cert: string }> {
  const pems = await generateSelfSignedCertificate([{ name: "commonName", value: hostname }], {
    algorithm: "sha256",
    keySize: 2_048,
    notAfterDate: new Date(Date.now() + 365 * 86_400_000)
  });
  return { key: pems.private, cert: pems.cert };
}

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (cookieHeader === undefined) {
    return cookies;
  }
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name !== undefined && name !== "") {
      cookies.set(name, valueParts.join("="));
    }
  }
  return cookies;
}

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "authorization, content-type");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" }).end(body);
}

function sendText(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(body);
}

function sendJs(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/javascript; charset=utf-8" }).end(body);
}

function sendCss(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/css; charset=utf-8" }).end(body);
}

function loginPageHtml(authenticationUri: string): string {
  return `<!doctype html><html><head><title>Keycloak Mock Login</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>Keycloak Mock</h1><form method="post" action="${escapeHtml(authenticationUri)}"><label>Username<input name="username" autocomplete="username" autofocus></label><label>Roles<input name="password" placeholder="admin,user"></label><button type="submit">Sign in</button></form></main></body></html>`;
}

function outOfBandHtml(code: string): string {
  return `<!doctype html><html><head><title>Keycloak Mock Code</title></head><body><main><h1>Authorization code</h1><input readonly value="${escapeHtml(code)}"></main></body></html>`;
}

function loginStatusIframeHtml(requestConfiguration: UrlConfiguration): string {
  const webCryptoShimPath = new URL("vendor/web-crypto-shim/web-crypto-shim.js", requestConfiguration.getJsPath()).toString();
  return `<!doctype html><html><body><script src="${escapeHtml(webCryptoShimPath)}"></script><script>function getSessionCookie(){return document.cookie}</script></body></html>`;
}

function thirdPartyCookiesHtml(step: string): string {
  const nextStep = step === "step1" ? '<a href="step2.html">step2.html</a>' : '"supported"';
  return `<!doctype html><html><body>3p-cookies ${step} ${nextStep}</body></html>`;
}

function docsHtml(routes: Record<string, { methods: string[]; description: string }>): string {
  const items = Object.entries(routes)
    .map(([path, route]) => `<li><code>${escapeHtml(path)}</code> ${escapeHtml(route.methods.join(","))} ${escapeHtml(route.description)}</li>`)
    .join("");
  return `<!doctype html><html><head><title>Keycloak Mock Routes</title></head><body><h1>Routes</h1><ul>${items}</ul></body></html>`;
}

function documentedRoutes(contextPath: string): Record<string, { methods: string[]; description: string }> {
  return {
    "/docs": {
      methods: ["GET"],
      description: "documentation endpoint"
    },
    [`${contextPath}/realms/:realm/.well-known/openid-configuration`]: {
      methods: ["GET"],
      description: "configuration discovery data"
    },
    [`${contextPath}/realms/:realm/protocol/openid-connect/certs`]: {
      methods: ["GET"],
      description: "key signing data"
    },
    [`${contextPath}/realms/:realm/protocol/openid-connect/auth`]: {
      methods: ["GET"],
      description: "login page"
    },
    [`${contextPath}/realms/:realm/authenticate/:sessionId`]: {
      methods: ["POST"],
      description: "custom authentication endpoint used by login page"
    },
    [`${contextPath}/realms/:realm/protocol/openid-connect/token`]: {
      methods: ["POST"],
      description: "token endpoint"
    },
    [`${contextPath}/realms/:realm/protocol/openid-connect/token/introspect`]: {
      methods: ["POST"],
      description: "token introspection endpoint"
    },
    [`${contextPath}/realms/:realm/protocol/openid-connect/logout`]: {
      methods: ["GET", "POST"],
      description: "logout endpoint"
    }
  };
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
