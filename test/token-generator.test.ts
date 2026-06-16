import { describe, expect, it } from "vitest";
import { KeycloakMock, aServerConfig, aTokenConfig } from "../src/index.js";
import { decodeJwt, expectEpochCloseTo } from "./helpers.js";

describe("TokenGenerator", () => {
  it("applies token config values to signed JWTs", () => {
    const mock = new KeycloakMock(aServerConfig().withDefaultAudiences([]).withDefaultScopes([]).withDefaultTokenLifespan("10h").build());
    const authenticationTime = new Date("2026-01-01T00:00:00.000Z");
    const issuedAt = new Date(Date.now() - 60_000);
    const notBefore = new Date(Date.now());
    const expiration = new Date(Date.now() + 600_000);

    const token = mock.getAccessToken(
      aTokenConfig()
        .withAudience("audience")
        .withAuthorizedParty("authorized_party")
        .withSubject("subject")
        .withScope("scope")
        .withRealmRoles(["peter", "paul"])
        .withResourceRoles("audience", ["user", "admin"])
        .withResourceRole("authorized_party", "party")
        .withHostname("hostname")
        .withRealm("realm")
        .withFamilyName("family")
        .withGivenName("given")
        .withName("name")
        .withEmail("email")
        .withPreferredUsername("username")
        .withClaim("claim", "my claim")
        .withAuthenticationTime(authenticationTime)
        .withIssuedAt(issuedAt)
        .withNotBefore(notBefore)
        .withExpiration(expiration)
        .withAuthenticationContextClassReference("acc ref")
        .withSessionId("session ID")
        .build()
    );

    const decoded = decodeJwt(token);
    const claims = mock.parseToken(token);

    expect(decoded.header).toMatchObject({ alg: "RS256", kid: "keyId", typ: "JWT" });
    expectEpochCloseTo(claims.exp, expiration);
    expectEpochCloseTo(claims.iat, issuedAt);
    expectEpochCloseTo(claims.nbf, notBefore);
    expect(claims.auth_time).toBe(Math.floor(authenticationTime.getTime() / 1_000));
    expect(claims).toMatchObject({
      iss: "http://hostname/auth/realms/realm",
      sub: "subject",
      aud: ["audience"],
      azp: "authorized_party",
      scope: "openid scope",
      name: "name",
      given_name: "given",
      family_name: "family",
      email: "email",
      preferred_username: "username",
      claim: "my claim",
      acr: "acc ref",
      sid: "session ID",
      session_state: "session ID",
      realm_access: { roles: ["peter", "paul"] },
      resource_access: {
        audience: { roles: ["user", "admin"] },
        authorized_party: { roles: ["party"] }
      }
    });
  });

  it("does not generate user data unless requested", () => {
    const mock = new KeycloakMock();
    const claims = mock.parseToken(mock.getAccessToken(aTokenConfig().withSubject("foo.bar").build()));

    expect(claims.sub).toBe("foo.bar");
    expect(claims).not.toHaveProperty("name");
    expect(claims).not.toHaveProperty("given_name");
    expect(claims).not.toHaveProperty("family_name");
    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("preferred_username");
  });

  it.each([
    ["jane.doe@example.com", "jane.doe", "Jane", "Doe", "Jane Doe", "jane.doe@example.com"],
    ["jAnE.DoE@example.com", "jAnE.DoE", "JAnE", "DoE", "JAnE DoE", "jAnE.DoE@example.com"],
    ["john.frederic.doe", "john.frederic.doe", "John Frederic", "Doe", "John Frederic Doe", "john.frederic.doe@example.org"],
    ["jane", "jane", undefined, "Jane", "Jane", "jane@example.org"],
    ["john_doe@example", "john_doe", "John", "Doe", "John Doe", "john_doe@example"],
    ["Jane_Doe", "Jane_Doe", "Jane", "Doe", "Jane Doe", "Jane_Doe@example.org"],
    ["john doe", "john doe", "John", "Doe", "John Doe", "john+doe@example.org"],
    ["j", "j", undefined, "J", "J", "j@example.org"],
    ["J", "J", undefined, "J", "J", "J@example.org"],
    [".", ".", undefined, ".", ".", ".@example.org"],
    ["_", "_", undefined, "_", "_", "_@example.org"]
  ])(
    "generates user data from subject %s",
    (subject, expectedPreferredUsername, expectedGivenName, expectedFamilyName, expectedName, expectedEmail) => {
      const mock = new KeycloakMock();
      const claims = mock.parseToken(
        mock.getAccessToken(
          aTokenConfig().withHostname("example.org").withSubjectAndGeneratedUserData(subject).build()
        )
      );

      expect(claims.sub).toBe(subject);
      expect(claims.preferred_username).toBe(expectedPreferredUsername);
      expect(claims.given_name).toBe(expectedGivenName);
      expect(claims.family_name).toBe(expectedFamilyName);
      expect(claims.name).toBe(expectedName);
      expect(claims.email).toBe(expectedEmail);
    }
  );

  it("lets explicit user data override generated values", () => {
    const mock = new KeycloakMock();
    const claims = mock.parseToken(
      mock.getAccessToken(
        aTokenConfig()
          .withHostname("example.com")
          .withSubjectAndGeneratedUserData("foo.bar")
          .withGivenName("Jane")
          .withFamilyName("Doe")
          .withEmail("jane@doe.com")
          .withPreferredUsername("doej")
          .build()
      )
    );

    expect(claims).toMatchObject({
      sub: "foo.bar",
      name: "Jane Doe",
      given_name: "Jane",
      family_name: "Doe",
      email: "jane@doe.com",
      preferred_username: "doej"
    });
  });

  it("uses and overrides default scopes", () => {
    const mock = new KeycloakMock(aServerConfig().withDefaultScopes(["scope1", "scope2", "scope3"]).build());

    expect(mock.parseToken(mock.getAccessToken()).scope).toBe("openid scope1 scope2 scope3");
    expect(mock.parseToken(mock.getAccessToken(aTokenConfig().withScopes(["test1", "test2", "test3"]).build())).scope).toBe(
      "openid test1 test2 test3"
    );
    expect(mock.parseToken(mock.getAccessToken(aTokenConfig().withScopes(["test1", "openid", "test1"]).build())).scope).toBe(
      "openid test1"
    );
  });

  it("uses default audiences unless token config overrides them", () => {
    const mock = new KeycloakMock(aServerConfig().withDefaultAudiences(["audience1", "audience2"]).build());

    expect(mock.parseToken(mock.getAccessToken()).aud).toEqual(["audience1", "audience2"]);
    expect(mock.parseToken(mock.getAccessToken(aTokenConfig().withAudience("look-only-at-me").build())).aud).toEqual([
      "look-only-at-me"
    ]);
  });

  it("uses default lifespan unless token lifespan overrides it", () => {
    const mock = new KeycloakMock(aServerConfig().withDefaultTokenLifespan("5h").build());
    const defaultClaims = mock.parseToken(mock.getAccessToken());
    const overrideClaims = mock.parseToken(mock.getAccessToken(aTokenConfig().withTokenLifespan("20h").build()));
    const now = Math.floor(Date.now() / 1_000);

    expect(defaultClaims.exp as number).toBeGreaterThan(now + 4 * 3_600 + 59 * 60);
    expect(defaultClaims.exp as number).toBeLessThanOrEqual(now + 5 * 3_600);
    expect(overrideClaims.exp as number).toBeGreaterThan(now + 19 * 3_600 + 59 * 60);
    expect(overrideClaims.exp as number).toBeLessThanOrEqual(now + 20 * 3_600);
  });
});
