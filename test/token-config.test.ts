import { describe, expect, it } from "vitest";
import { aTokenConfig } from "../src/index.js";
import { expectDateCloseTo, unsignedJwt } from "./helpers.js";

describe("TokenConfig", () => {
  it("uses Java-compatible defaults", () => {
    const before = new Date();
    const config = aTokenConfig().build();
    const after = new Date();

    expect([...config.getAudience()]).toEqual([]);
    expect(config.getAuthenticationTime().getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(config.getAuthenticationTime().getTime()).toBeLessThanOrEqual(after.getTime());
    expect(config.getAuthorizedParty()).toBe("client");
    expect(config.getClaims()).toEqual({});
    expect(config.getEmail()).toBeUndefined();
    expect(config.getExpiration()).toBeUndefined();
    expect(config.getFamilyName()).toBeUndefined();
    expect(config.getGivenName()).toBeUndefined();
    expect(config.getIssuedAt().getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(config.getIssuedAt().getTime()).toBeLessThanOrEqual(after.getTime());
    expect(config.getNotBefore()).toBeUndefined();
    expect(config.getHostname()).toBeUndefined();
    expect(config.getRealm()).toBeUndefined();
    expect(config.getName()).toBeUndefined();
    expect(config.getPreferredUsername()).toBeUndefined();
    expect(config.getRealmAccess().getRoles()).toEqual([]);
    expect(config.getResourceAccess()).toEqual({});
    expect(config.getScopes()).toEqual([]);
    expect(config.getSubject()).toBe("user");
    expect(config.getAuthenticationContextClassReference()).toBeUndefined();
    expect(config.isGenerateUserDataFromSubject()).toBe(false);
  });

  it("sets builder values and deduplicates role sets", () => {
    const authenticationTime = new Date(Date.now() - 5_000);
    const issuedAt = new Date(Date.now() - 1_000);
    const notBefore = new Date(Date.now() + 1_000);
    const expiration = new Date(Date.now() + 5_000);

    const config = aTokenConfig()
      .withAudience("audience1")
      .withAudiences(["audience2"])
      .withAudience("audience3")
      .withAuthorizedParty("authorized")
      .withSubjectAndGeneratedUserData("subject")
      .withScopes(["scope1", "scope2"])
      .withScope("scope3")
      .withClaim("claim", 1)
      .withClaims({ claim: "2", claim2: true })
      .withClaim("claim", 3)
      .withHostname("hostname")
      .withRealm("realm")
      .withRealmRole("role1")
      .withRealmRoles(["role2", "role1"])
      .withResourceRole("resource1", "role1_1")
      .withResourceRoles("resource1", ["role2_1", "role1_1"])
      .withResourceRole("resource2", "role1_2")
      .withSessionId("session")
      .withIssuedAt(issuedAt)
      .withAuthenticationTime(authenticationTime)
      .withNotBefore(notBefore)
      .withExpiration(expiration)
      .withGivenName("given")
      .withFamilyName("family")
      .withName("name")
      .withEmail("email")
      .withPreferredUsername("preferred")
      .withAuthenticationContextClassReference("0")
      .build();

    expect([...config.getAudience()]).toEqual(["audience1", "audience2", "audience3"]);
    expect(config.getAuthorizedParty()).toBe("authorized");
    expect(config.getSubject()).toBe("subject");
    expect(config.isGenerateUserDataFromSubject()).toBe(true);
    expect(config.getScopes()).toEqual(["scope1", "scope2", "scope3"]);
    expect(config.getClaims()).toEqual({ claim: 3, claim2: true });
    expect(config.getHostname()).toBe("hostname");
    expect(config.getRealm()).toBe("realm");
    expect(config.getRealmAccess().getRoles()).toEqual(["role1", "role2"]);
    expect(config.getResourceAccess().resource1?.getRoles()).toEqual(["role1_1", "role2_1"]);
    expect(config.getResourceAccess().resource2?.getRoles()).toEqual(["role1_2"]);
    expect(config.getSessionId()).toBe("session");
    expectDateCloseTo(config.getIssuedAt(), issuedAt);
    expectDateCloseTo(config.getAuthenticationTime(), authenticationTime);
    expectDateCloseTo(config.getNotBefore(), notBefore);
    expectDateCloseTo(config.getExpiration(), expiration);
    expect(config.getGivenName()).toBe("given");
    expect(config.getFamilyName()).toBe("family");
    expect(config.getName()).toBe("name");
    expect(config.getEmail()).toBe("email");
    expect(config.getPreferredUsername()).toBe("preferred");
    expect(config.getAuthenticationContextClassReference()).toBe("0");
  });

  it.each([
    ["given", "family", "given family"],
    [undefined, "family", "family"],
    ["given", undefined, "given"],
    [undefined, undefined, undefined]
  ])("derives name from given and family names", (givenName, familyName, expectedName) => {
    const config = aTokenConfig().withGivenName(givenName).withFamilyName(familyName).build();

    expect(config.getName()).toBe(expectedName);
  });

  it("sets token lifespan relative to issued-at", () => {
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const config = aTokenConfig().withIssuedAt(issuedAt).withTokenLifespan("3m45s").build();

    expect(config.getExpiration()?.toISOString()).toBe("2026-01-01T00:03:45.000Z");
  });

  it("copies supported claims from source tokens without trusting signatures", () => {
    const source = unsignedJwt({
      jti: "9cfe2b60-1db9-4a12-b9dc-dcabfd16e945",
      exp: 1_586_778_660,
      nbf: 0,
      iat: 1_586_778_600,
      iss: "http://localhost:8000/auth/realms/realm",
      aud: "account",
      sub: "fbcaa40a-9480-4ead-adf2-8f6085f6f75d",
      typ: "Bearer",
      azp: "client",
      nonce: "aef8cf1b-127d-4650-8081-0dB24af2d0e7",
      auth_time: 1_586_778_599,
      session_state: "05270907-d7e2-4b75-8341-5bdd94eab763",
      acr: "1",
      "allowed-origins": ["http://localhost:3000"],
      realm_access: { roles: ["offline_access", "uma_authorization"] },
      resource_access: { account: { roles: ["manage-account", "manage-account-links", "view-profile"] } },
      scope: "openid email profile",
      email_verified: false,
      name: "Peter User",
      preferred_username: "user",
      given_name: "Peter",
      family_name: "User",
      email: "user@keycloak"
    });

    const config = aTokenConfig().withSourceToken(source).build();

    expect([...config.getAudience()]).toEqual(["account"]);
    expect(config.getAuthorizedParty()).toBe("client");
    expect(config.getClaims()).toEqual({
      jti: "9cfe2b60-1db9-4a12-b9dc-dcabfd16e945",
      nonce: "aef8cf1b-127d-4650-8081-0dB24af2d0e7",
      "allowed-origins": ["http://localhost:3000"],
      email_verified: false
    });
    expect(config.getEmail()).toBe("user@keycloak");
    expect(config.getExpiration()).toBeUndefined();
    expect(config.getFamilyName()).toBe("User");
    expect(config.getGivenName()).toBe("Peter");
    expect(config.getName()).toBe("Peter User");
    expect(config.getNotBefore()).toBeUndefined();
    expect(config.getPreferredUsername()).toBe("user");
    expect(config.getAuthenticationContextClassReference()).toBe("1");
    expect(config.getRealmAccess().getRoles()).toEqual(["offline_access", "uma_authorization"]);
    expect(config.getResourceAccess().account?.getRoles()).toEqual(["manage-account", "manage-account-links", "view-profile"]);
    expect(config.getScopes()).toEqual(["openid", "email", "profile"]);
    expect(config.getSessionId()).not.toBe("05270907-d7e2-4b75-8341-5bdd94eab763");
    expect(config.getSubject()).toBe("fbcaa40a-9480-4ead-adf2-8f6085f6f75d");
    expect(config.getHostname()).toBe("localhost:8000");
    expect(config.getRealm()).toBe("realm");
  });

  it("preserves issuer ports when copying a source token", () => {
    const source = unsignedJwt({
      iss: "http://localhost:8123/auth/realms/realm",
      typ: "Bearer"
    });

    const config = aTokenConfig().withSourceToken(source).build();

    expect(config.getHostname()).toBe("localhost:8123");
    expect(config.getRealm()).toBe("realm");
  });

  it("rejects source tokens with invalid issuer URLs", () => {
    expect(() => aTokenConfig().withSourceToken(unsignedJwt({ iss: "no url" }))).toThrow(/not a valid URL/u);
  });

  it("rejects source tokens with unexpected issuer paths", () => {
    expect(() => aTokenConfig().withSourceToken(unsignedJwt({ iss: "http:\/\/localhost\/auth" }))).toThrow(
      /did not conform to the expected format/u
    );
  });
});
