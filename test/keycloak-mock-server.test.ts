import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { describe, expect, it } from "vitest";
import { KeycloakMock, LoginRoleMapping, aServerConfig, aTokenConfig } from "../src/index.js";
import {
  basicAuth,
  extractFormAction,
  getSetCookie,
  mockBaseUrl,
  parseCookieValue,
  postForm,
  startMock
} from "./helpers.js";

describe("KeycloakMock HTTP server", () => {
  it("starts, stops, and starts again", async () => {
    const mock = new KeycloakMock(aServerConfig().withRandomPort().build());
    await expect(fetch(`http://localhost:1/auth/realms/master/protocol/openid-connect/certs`)).rejects.toThrow();

    await mock.start();
    const url = `http://localhost:${mock.getActualPort()}/auth/realms/master/protocol/openid-connect/certs`;
    await expect(fetch(url).then((response) => response.status)).resolves.toBe(200);

    await mock.stop();
    await expect(fetch(url)).rejects.toThrow();

    await mock.start();
    const restartedUrl = `http://localhost:${mock.getActualPort()}/auth/realms/master/protocol/openid-connect/certs`;
    await expect(fetch(restartedUrl).then((response) => response.status)).resolves.toBe(200);
    await mock.stop();
  });

  it("fails when the configured port is already claimed", async () => {
    const first = await startMock(aServerConfig().withRandomPort().build());
    const second = new KeycloakMock(aServerConfig().withPort(first.getActualPort()).build());

    await expect(second.start()).rejects.toThrow(/Error while starting mock server/u);
  });

  it("serves HTTPS with a generated self-signed certificate", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withTls(true).build());

    const response = await httpsGet(`https://localhost:${mock.getActualPort()}/auth/realms/master/protocol/openid-connect/certs`);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body) as Record<string, unknown>).toHaveProperty("keys");
  });

  it("returns discovery metadata using the request host", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const response = await httpGet(
      `http://localhost:${mock.getActualPort()}/auth/realms/realm/.well-known/openid-configuration`,
      { host: "server" }
    );
    const discovery = JSON.parse(response.body) as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(discovery).toMatchObject({
      issuer: "http://server/auth/realms/realm",
      authorization_endpoint: "http://server/auth/realms/realm/protocol/openid-connect/auth",
      token_endpoint: "http://server/auth/realms/realm/protocol/openid-connect/token",
      introspection_endpoint: "http://server/auth/realms/realm/protocol/openid-connect/token/introspect",
      jwks_uri: "http://server/auth/realms/realm/protocol/openid-connect/certs",
      end_session_endpoint: "http://server/auth/realms/realm/protocol/openid-connect/logout",
      response_types_supported: ["code", "code id_token", "id_token", "token id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"]
    });
  });

  it("serves JWKS and compatibility resources", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);

    const jwks = (await (await fetch(`${base}/protocol/openid-connect/certs`)).json()) as { keys: Array<Record<string, unknown>> };
    expect(jwks.keys[0]).toMatchObject({ kid: "keyId", kty: "RSA", use: "sig", alg: "RS256" });

    const iframeInit = await fetch(`${base}/protocol/openid-connect/login-status-iframe.html/init`);
    expect(iframeInit.status).toBe(204);
    expect(await iframeInit.text()).toBe("");

    await expectResource(`${base}/protocol/openid-connect/login-status-iframe.html`, "text/html", [
      "getSessionCookie()",
      `/auth/js/vendor/web-crypto-shim/web-crypto-shim.js`
    ]);
    await expectResource(`${base}/protocol/openid-connect/3p-cookies/step1.html`, "text/html", ["step2.html"]);
    await expectResource(`${base}/protocol/openid-connect/3p-cookies/step2.html`, "text/html", ['"supported"']);
    await expectResource(`http://localhost:${mock.getActualPort()}/auth/js/keycloak.js`, "text/javascript", ["function Keycloak"]);
    await expectResource(`http://localhost:${mock.getActualPort()}/auth/js/vendor/web-crypto-shim/web-crypto-shim.js`, "text/javascript", [
      "crypto.randomUUID"
    ]);

    expect((await fetch(`http://localhost:${mock.getActualPort()}/i-do-not-exist`)).status).toBe(404);
  });

  it("supports implicit login flow, session reuse, and GET logout", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);

    const firstLogin = await openLoginPage(base, "http://app.local/callback", "state", "nonce", "id_token");
    const firstAuth = await authenticate(firstLogin.action, "username", "role1,role2,role3");
    const firstCookie = getSetCookie(firstAuth, "KEYCLOAK_SESSION");
    const firstRedirect = firstAuth.headers.get("location");
    expect(firstRedirect).toBeTruthy();
    const sessionId = expectSessionCookie(firstCookie, "realm");
    expectImplicitRedirect(mock, firstRedirect as string, {
      redirectUri: "http://app.local/callback",
      state: "state",
      nonce: "nonce",
      sessionId,
      roles: ["role1", "role2", "role3"]
    });

    const secondLogin = await fetch(
      `${base}/protocol/openid-connect/auth?${new URLSearchParams({
        client_id: "client",
        redirect_uri: "http://app.local/again",
        state: "state2",
        nonce: "nonce2",
        response_type: "id_token"
      })}`,
      { headers: { cookie: firstCookie.split(";", 1)[0] ?? "" }, redirect: "manual" }
    );
    expect(secondLogin.status).toBe(302);
    expectImplicitRedirect(mock, secondLogin.headers.get("location") as string, {
      redirectUri: "http://app.local/again",
      state: "state2",
      nonce: "nonce2",
      sessionId,
      roles: ["role1", "role2", "role3"]
    });

    const logout = await fetch(`${base}/protocol/openid-connect/logout?post_logout_redirect_uri=redirect_uri`, {
      headers: { cookie: firstCookie.split(";", 1)[0] ?? "" },
      redirect: "manual"
    });
    expect(logout.status).toBe(302);
    expect(logout.headers.get("location")).toBe("redirect_uri");
    expect(getSetCookie(logout, "KEYCLOAK_SESSION")).toContain("KEYCLOAK_SESSION=realm/dummy-user-id;");
  });

  it("supports authorization-code login flow, refresh tokens, and POST logout", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);

    const login = await openLoginPage(base, "http://app.local/callback", "state", "nonce", "code");
    const auth = await authenticate(login.action, "username", "role1,role2,role3");
    const authCookie = getSetCookie(auth, "KEYCLOAK_SESSION");
    const redirect = new URL(auth.headers.get("location") as string);
    const sessionId = expectSessionCookie(authCookie, "realm");

    expect(redirect.origin + redirect.pathname).toBe("http://app.local/callback");
    expect(redirect.searchParams.get("state")).toBe("state");
    expect(redirect.searchParams.get("session_state")).toBe(sessionId);
    const code = redirect.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await postForm(`${base}/protocol/openid-connect/token`, {
      grant_type: "authorization_code",
      code: code as string
    });
    expectLoginClaims(mock, tokenResponse.access_token as string, {
      preferredUsername: "username",
      nonce: "nonce",
      roles: ["role1", "role2", "role3"]
    });

    const refreshResponse = await postForm(`${base}/protocol/openid-connect/token`, {
      grant_type: "refresh_token",
      refresh_token: tokenResponse.refresh_token as string
    });
    expectLoginClaims(mock, refreshResponse.access_token as string, {
      preferredUsername: "username",
      nonce: "nonce",
      roles: ["role1", "role2", "role3"]
    });

    const logout = await fetch(`${base}/protocol/openid-connect/logout?post_logout_redirect_uri=redirect_uri`, {
      method: "POST",
      headers: { cookie: authCookie.split(";", 1)[0] ?? "" },
      redirect: "manual"
    });
    expect(logout.status).toBe(302);
    expect(logout.headers.get("location")).toBe("redirect_uri");
    expect(getSetCookie(logout, "KEYCLOAK_SESSION")).toContain("KEYCLOAK_SESSION=realm/dummy-user-id;");
  });

  it("returns login and authentication request errors", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);

    expect((await fetch(`${base}/protocol/openid-connect/auth`)).status).toBe(400);
    expect((await fetch(`${base}/authenticate/unknown`, { method: "POST" })).status).toBe(404);

    const login = await openLoginPage(base, "http://app.local/callback", "state", "nonce", "code");
    const missingUsername = await fetch(login.action, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "role" }),
      redirect: "manual"
    });
    expect(missingUsername.status).toBe(400);
  });

  it("applies response modes, existing redirect parameters, and out-of-band redirects", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);

    const fragmentLogin = await openLoginPageWithParams(base, {
      client_id: "client",
      redirect_uri: "http://app.local/callback?existingQuery=true#existingFragment",
      state: "state",
      nonce: "nonce",
      response_type: "code",
      response_mode: "fragment"
    });
    const fragmentAuth = await authenticate(fragmentLogin.action, "username", "role");
    const fragmentLocation = fragmentAuth.headers.get("location") as string;
    expect(fragmentLocation).toContain("?existingQuery=true#existingFragment&");
    expect(fragmentLocation).toContain("session_state=");
    expect(fragmentLocation).toContain("state=state");
    expect(fragmentLocation).toContain("code=");

    const ignoredQueryModeLogin = await openLoginPageWithParams(base, {
      client_id: "client",
      redirect_uri: "http://app.local/id-token",
      state: "state2",
      nonce: "nonce2",
      response_type: "id_token",
      response_mode: "query"
    });
    const ignoredQueryModeAuth = await authenticate(ignoredQueryModeLogin.action, "username", "role");
    const ignoredQueryModeLocation = ignoredQueryModeAuth.headers.get("location") as string;
    expect(ignoredQueryModeLocation).toContain("#");
    expect(ignoredQueryModeLocation).not.toContain("?");
    expect(ignoredQueryModeLocation).toContain("id_token=");

    const oobLogin = await openLoginPageWithParams(base, {
      client_id: "client",
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      state: "state3",
      nonce: "nonce3",
      response_type: "code"
    });
    const oobAuth = await authenticate(oobLogin.action, "username", "role");
    const oobLocation = new URL(oobAuth.headers.get("location") as string);
    expect(oobLocation.origin + oobLocation.pathname).toBe(`${base}/oob`);
    expect(oobLocation.searchParams.get("state")).toBe("state3");
    expect(oobLocation.searchParams.get("code")).toBeTruthy();
  });

  it("supports password and client-credentials token grants", async () => {
    const mock = await startMock(
      aServerConfig().withRandomPort().withDefaultRealm("realm").withLoginRoleMapping(LoginRoleMapping.TO_BOTH).build()
    );
    const tokenUrl = `${mockBaseUrl(mock)}/protocol/openid-connect/token`;

    const passwordByForm = await postForm(tokenUrl, {
      client_id: "client",
      username: "username",
      password: "role1,role2,role3",
      grant_type: "password"
    });
    expectGrantClaims(mock, passwordByForm.access_token as string, "username", ["client", "server"], ["role1", "role2", "role3"]);

    const passwordByBasic = await postForm(
      tokenUrl,
      {
        username: "username",
        password: "role1,role2,role3",
        grant_type: "password"
      },
      { authorization: basicAuth("client", "does not matter") }
    );
    expectGrantClaims(mock, passwordByBasic.access_token as string, "username", ["client", "server"], ["role1", "role2", "role3"]);

    const clientCredentialsByBasic = await postForm(
      tokenUrl,
      { grant_type: "client_credentials" },
      { authorization: basicAuth("client", "role1,role2,role3") }
    );
    expectGrantClaims(mock, clientCredentialsByBasic.access_token as string, "client", ["client", "server"], ["role1", "role2", "role3"]);

    const clientCredentialsByBasicUsernameOnly = await postForm(
      tokenUrl,
      { grant_type: "client_credentials" },
      { authorization: basicAuth("client") }
    );
    expectGrantClaims(mock, clientCredentialsByBasicUsernameOnly.access_token as string, "client", ["client", "server"], []);

    const clientCredentialsByForm = await postForm(tokenUrl, {
      client_id: "client",
      client_secret: "role1,role2,role3",
      grant_type: "client_credentials"
    });
    expectGrantClaims(mock, clientCredentialsByForm.access_token as string, "client", ["client", "server"], ["role1", "role2", "role3"]);

    const clientCredentialsByFormClientOnly = await postForm(tokenUrl, {
      client_id: "client",
      grant_type: "client_credentials"
    });
    expectGrantClaims(mock, clientCredentialsByFormClientOnly.access_token as string, "client", ["client", "server"], []);
  });

  it("returns Java-compatible token grant errors", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const tokenUrl = `${mockBaseUrl(mock)}/protocol/openid-connect/token`;

    await expectFormStatus(tokenUrl, {}, 400);
    await expectFormStatus(tokenUrl, { grant_type: "authorization_code" }, 404);
    await expectFormStatus(tokenUrl, { grant_type: "refresh_token" }, 400);
    await expectFormStatus(tokenUrl, { grant_type: "password", username: "username" }, 400);
    await expectFormStatus(tokenUrl, { grant_type: "password", client_id: "client" }, 400);
    await expectFormStatus(tokenUrl, { grant_type: "client_credentials" }, 401);
    await expectFormStatus(tokenUrl, { grant_type: "client_credentials" }, 401, { authorization: "Basic but not base64" });
  });

  it("rejects unsupported redirect response types after authentication", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const base = mockBaseUrl(mock);
    const login = await openLoginPageWithParams(base, {
      client_id: "client",
      redirect_uri: "http://app.local/callback",
      response_type: "unsupported"
    });

    const response = await fetch(login.action, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "username", password: "role" }),
      redirect: "manual"
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid redirect request");
  });

  it("serves documentation as HTML and JSON", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().build());
    const docsUrl = `http://localhost:${mock.getActualPort()}/docs`;

    const html = await (await fetch(docsUrl)).text();
    expect(html).toContain("/docs");
    expect(html).toContain("/auth/realms/:realm/protocol/openid-connect/token");

    const json = (await (await fetch(docsUrl, { headers: { accept: "application/json" } })).json()) as Record<string, unknown>;
    expect(json).toHaveProperty("/docs");
    expect(json).toHaveProperty("/auth/realms/:realm/protocol/openid-connect/token/introspect");
  });

  it("introspects active tokens and hides claims for invalid tokens", async () => {
    const mock = await startMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    const introspectionUrl = `${mockBaseUrl(mock)}/protocol/openid-connect/token/introspect`;
    const activeToken = mock.getAccessToken(aTokenConfig().withAudience("myclient").withClaim("foo", "bar").build());

    const active = await postForm(introspectionUrl, {
      token: activeToken,
      client_id: "myclient"
    });
    expect(active).toMatchObject({ active: true, foo: "bar", aud: ["myclient"] });

    const wrongAudience = await postForm(introspectionUrl, {
      token: activeToken,
      client_id: "other-client"
    });
    expect(wrongAudience).toEqual({ active: false });

    const expiredToken = mock.getAccessToken(aTokenConfig().withAudience("myclient").withExpiration(new Date(Date.now() - 3_600_000)).build());
    const inactive = await postForm(introspectionUrl, {
      token: expiredToken,
      client_id: "myclient"
    });
    expect(inactive).toEqual({ active: false });

    const missingAuth = await fetch(introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: activeToken })
    });
    expect(missingAuth.status).toBe(401);
  });
});

async function expectResource(url: string, contentType: string, expectedContent: string[]): Promise<void> {
  const response = await fetch(url);
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain(contentType);
  for (const content of expectedContent) {
    expect(body).toContain(content);
  }
}

async function openLoginPage(
  base: string,
  redirectUri: string,
  state: string,
  nonce: string,
  responseType: string
): Promise<{ action: string; html: string }> {
  const response = await fetch(
    `${base}/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: "client",
      redirect_uri: redirectUri,
      state,
      nonce,
      response_type: responseType
    })}`
  );
  const html = await response.text();

  expect(response.status).toBe(200);
  return { action: extractFormAction(html), html };
}

async function openLoginPageWithParams(base: string, params: Record<string, string>): Promise<{ action: string; html: string }> {
  const response = await fetch(`${base}/protocol/openid-connect/auth?${new URLSearchParams(params)}`);
  const html = await response.text();

  expect(response.status).toBe(200);
  return { action: extractFormAction(html), html };
}

async function authenticate(action: string, username: string, password: string): Promise<Response> {
  const response = await fetch(action, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    redirect: "manual"
  });
  expect(response.status).toBe(302);
  return response;
}

function expectSessionCookie(cookie: string, realm: string): string {
  expect(cookie).toContain(`Path=/auth/realms/${realm}/`);
  expect(cookie).toContain("Max-Age=36000");
  const value = parseCookieValue(cookie);
  const components = value.split("/");
  expect(components).toHaveLength(3);
  expect(components[0]).toBe(realm);
  expect(components[1]).toBe("dummy-user-id");
  expect(components[2]).toBeTruthy();
  return components[2] as string;
}

function expectImplicitRedirect(
  mock: KeycloakMock,
  location: string,
  expected: { redirectUri: string; state: string; nonce: string; sessionId: string; roles: string[] }
): void {
  expect(location).toContain("#");
  expect(location).not.toContain("?");
  const redirect = new URL(location);
  const fragment = new URLSearchParams(redirect.hash.slice(1));

  expect(redirect.origin + redirect.pathname).toBe(expected.redirectUri);
  expect(fragment.get("state")).toBe(expected.state);
  expect(fragment.get("session_state")).toBe(expected.sessionId);
  const token = fragment.get("id_token");
  expect(token).toBeTruthy();
  expectLoginClaims(mock, token as string, {
    preferredUsername: "username",
    nonce: expected.nonce,
    roles: expected.roles
  });
}

function expectLoginClaims(
  mock: KeycloakMock,
  token: string,
  expected: { preferredUsername: string; nonce: string; roles: string[] }
): void {
  const claims = mock.parseToken(token);
  expect(claims.iss).toMatch(/\/auth\/realms\/realm$/u);
  expect(claims.preferred_username).toBe(expected.preferredUsername);
  expect(claims.nonce).toBe(expected.nonce);
  expect(claims.realm_access).toEqual({ roles: expected.roles });
}

function expectGrantClaims(
  mock: KeycloakMock,
  token: string,
  preferredUsername: string,
  audience: string[],
  roles: string[]
): void {
  const claims = mock.parseToken(token);
  expect(claims.preferred_username).toBe(preferredUsername);
  expect(claims.aud).toEqual(audience);
  expect(claims.realm_access).toEqual({ roles });
  expect(claims.resource_access).toEqual({
    client: { roles },
    server: { roles }
  });
}

async function expectFormStatus(
  url: string,
  data: Record<string, string>,
  status: number,
  headers: Record<string, string> = {}
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(data)
  });
  expect(response.status).toBe(status);
}

function httpsGet(url: string): Promise<{ statusCode: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { rejectUnauthorized: false }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end();
  });
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ statusCode: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end();
  });
}
