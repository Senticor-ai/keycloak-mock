import { afterEach, describe, expect, it } from "vitest";
import { KeycloakMock, LoginRoleMapping, aServerConfig, aTokenConfig } from "../src/index.js";

const runningMocks: KeycloakMock[] = [];

afterEach(async () => {
  await Promise.all(runningMocks.splice(0).map((mock) => mock.stop()));
});

describe("KeycloakMock", () => {
  it("generates signed tokens with Keycloak-shaped claims", () => {
    const mock = new KeycloakMock(
      aServerConfig()
        .withDefaultHostname("default-host")
        .withDefaultRealm("default-realm")
        .withDefaultAudience("api")
        .withDefaultScope("profile")
        .build()
    );

    const token = mock.getAccessToken(
      aTokenConfig()
        .withHostname("token-host")
        .withRealm("token-realm")
        .withSubjectAndGeneratedUserData("jane.doe")
        .withRealmRole("admin")
        .withResourceRole("api", "read")
        .build()
    );

    const claims = mock.parseToken(token);

    expect(claims).toMatchObject({
      iss: "http://token-host/auth/realms/token-realm",
      sub: "jane.doe",
      aud: ["api"],
      scope: "openid profile",
      typ: "Bearer",
      name: "Jane Doe",
      given_name: "Jane",
      family_name: "Doe",
      email: "jane.doe@token-host",
      preferred_username: "jane.doe",
      realm_access: { roles: ["admin"] },
      resource_access: { api: { roles: ["read"] } }
    });
  });

  it("copies supported claims from a source token without trusting its signature", () => {
    const mock = new KeycloakMock();
    const sourceToken = mock.getAccessToken(
      aTokenConfig()
        .withHostname("localhost")
        .withRealm("realm")
        .withAudience("account")
        .withAuthorizedParty("client")
        .withSubject("subject")
        .withRealmRole("offline_access")
        .withResourceRole("account", "view-profile")
        .withScope("email")
        .withClaim("email_verified", false)
        .build()
    );

    const config = aTokenConfig().withSourceToken(sourceToken).build();

    expect([...config.getAudience()]).toEqual(["account"]);
    expect(config.getAuthorizedParty()).toBe("client");
    expect(config.getSubject()).toBe("subject");
    expect(config.getHostname()).toBe("localhost");
    expect(config.getRealm()).toBe("realm");
    expect(config.getRealmAccess().getRoles()).toEqual(["offline_access"]);
    expect(config.getResourceAccess().account?.getRoles()).toEqual(["view-profile"]);
    expect(config.getScopes()).toEqual(["openid", "email"]);
    expect(config.getClaims()).toMatchObject({ email_verified: false });
  });

  it("serves discovery, password grant tokens, JWKS, and token introspection", async () => {
    const mock = new KeycloakMock(
      aServerConfig().withRandomPort().withDefaultRealm("realm").withLoginRoleMapping(LoginRoleMapping.TO_BOTH).build()
    );
    await mock.start();
    runningMocks.push(mock);

    const base = `http://localhost:${mock.getActualPort()}/auth/realms/realm`;
    const discoveryResponse = await fetch(`${base}/.well-known/openid-configuration`);
    const discovery = (await discoveryResponse.json()) as Record<string, unknown>;

    expect(discovery).toMatchObject({
      issuer: base,
      authorization_endpoint: `${base}/protocol/openid-connect/auth`,
      token_endpoint: `${base}/protocol/openid-connect/token`,
      introspection_endpoint: `${base}/protocol/openid-connect/token/introspect`,
      jwks_uri: `${base}/protocol/openid-connect/certs`,
      end_session_endpoint: `${base}/protocol/openid-connect/logout`,
      id_token_signing_alg_values_supported: ["RS256"]
    });

    const jwks = (await (await fetch(`${base}/protocol/openid-connect/certs`)).json()) as { keys: Array<Record<string, unknown>> };
    expect(jwks.keys[0]).toMatchObject({ kid: "keyId", kty: "RSA", use: "sig", alg: "RS256" });

    const tokenResponse = await postForm(`${base}/protocol/openid-connect/token`, {
      grant_type: "password",
      client_id: "client",
      username: "jane.doe",
      password: "admin,user"
    });

    expect(tokenResponse.token_type).toBe("Bearer");
    const claims = mock.parseToken(tokenResponse.access_token);
    expect(claims).toMatchObject({
      sub: "jane.doe",
      azp: "client",
      aud: ["client", "server"],
      realm_access: { roles: ["admin", "user"] },
      resource_access: {
        client: { roles: ["admin", "user"] },
        server: { roles: ["admin", "user"] }
      },
      acr: "1"
    });

    const introspection = await postForm(`${base}/protocol/openid-connect/token/introspect`, {
      client_id: "client",
      token: tokenResponse.access_token
    });

    expect(introspection).toMatchObject({ active: true, sub: "jane.doe", azp: "client" });
  });

  it("supports login page authorization-code flow", async () => {
    const mock = new KeycloakMock(aServerConfig().withRandomPort().withDefaultRealm("realm").build());
    await mock.start();
    runningMocks.push(mock);

    const base = `http://localhost:${mock.getActualPort()}/auth/realms/realm`;
    const loginResponse = await fetch(
      `${base}/protocol/openid-connect/auth?client_id=client&redirect_uri=http://app.local/callback&state=state123&nonce=nonce123&response_type=code`
    );
    const loginHtml = await loginResponse.text();
    const action = /action="([^"]+)"/u.exec(loginHtml)?.[1];
    expect(action).toBeDefined();

    const authenticateResponse = await fetch(action as string, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "user@example.test", password: "writer" }),
      redirect: "manual"
    });

    expect(authenticateResponse.status).toBe(302);
    const redirectLocation = authenticateResponse.headers.get("location");
    expect(redirectLocation).not.toBeNull();
    const redirectUrl = new URL(redirectLocation as string);
    expect(redirectUrl.origin + redirectUrl.pathname).toBe("http://app.local/callback");
    expect(redirectUrl.searchParams.get("state")).toBe("state123");
    const code = redirectUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await postForm(`${base}/protocol/openid-connect/token`, {
      grant_type: "authorization_code",
      code: code as string
    });
    const claims = mock.parseToken(tokenResponse.access_token);

    expect(claims).toMatchObject({
      sub: "user@example.test",
      email: "user@example.test",
      preferred_username: "user",
      nonce: "nonce123",
      realm_access: { roles: ["writer"] }
    });
  });
});

async function postForm(url: string, data: Record<string, string>): Promise<Record<string, any>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data)
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as Record<string, any>;
}
