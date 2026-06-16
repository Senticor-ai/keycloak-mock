import { createSign, createVerify, generateKeyPairSync, type KeyObject } from "node:crypto";
import { epochSeconds, uniqueStrings } from "./duration.js";
import { UserData, type Session } from "./session.js";
import { Access, TokenConfig } from "./token-config.js";
import type { JwtClaims, LoginRoleMapping } from "./types.js";
import { LoginRoleMapping as LoginRoleMappingValues } from "./types.js";
import type { UrlConfiguration } from "./url-configuration.js";

const DEFAULT_SCOPE = "openid";

export class TokenGenerator {
  private readonly publicKey: KeyObject;
  private readonly privateKey: KeyObject;

  constructor(
    private readonly defaultScopes: readonly string[],
    private readonly defaultAudiences: readonly string[],
    private readonly defaultTokenLifespanMs: number,
    private readonly keyId = "keyId"
  ) {
    const keyPair = generateKeyPairSync("rsa", { modulusLength: 2_048 });
    this.publicKey = keyPair.publicKey;
    this.privateKey = keyPair.privateKey;
  }

  getToken(tokenConfig: TokenConfig, requestConfiguration: UrlConfiguration): string {
    const issuedAt = tokenConfig.getIssuedAt();
    const expiration = tokenConfig.getExpiration() ?? new Date(issuedAt.getTime() + this.defaultTokenLifespanMs);
    const realmAccess = tokenConfig.getRealmAccess();
    const resourceAccess = tokenConfig.getResourceAccess();
    const userDataClaims = this.getUserDataClaims(tokenConfig, requestConfiguration);

    const payload = compactObject({
      aud: [...(tokenConfig.getAudience().size === 0 ? this.defaultAudiences : tokenConfig.getAudience())],
      iat: epochSeconds(issuedAt),
      auth_time: epochSeconds(tokenConfig.getAuthenticationTime()),
      iss: requestConfiguration.getIssuer(),
      sub: tokenConfig.getSubject(),
      scope: this.encodeGivenOrDefaultScopes(tokenConfig.getScopes()),
      typ: "Bearer",
      azp: tokenConfig.getAuthorizedParty(),
      sid: tokenConfig.getSessionId(),
      session_state: tokenConfig.getSessionId(),
      nbf: tokenConfig.getNotBefore() === undefined ? undefined : epochSeconds(tokenConfig.getNotBefore() as Date),
      exp: epochSeconds(expiration),
      ...userDataClaims,
      acr: tokenConfig.getAuthenticationContextClassReference(),
      realm_access: realmAccess.toJSON(),
      resource_access: Object.fromEntries(Object.entries(resourceAccess).map(([resource, access]) => [resource, access.toJSON()])),
      ...tokenConfig.getClaims()
    });

    return signJwt({ alg: "RS256", kid: this.keyId, typ: "JWT" }, payload, this.privateKey);
  }

  getTokenForSession(
    session: Session,
    requestConfiguration: UrlConfiguration,
    defaultAudiences: readonly string[],
    loginRoleMapping: LoginRoleMapping
  ): string {
    const userData = session.getUserData();
    const builder = TokenConfig.aTokenConfig()
      .withAuthorizedParty(session.getClientId())
      .withAudience(session.getClientId())
      .withAudiences(defaultAudiences)
      .withSubject(userData.getSubject())
      .withPreferredUsername(userData.getPreferredUsername())
      .withGivenName(userData.getGivenName())
      .withFamilyName(userData.getFamilyName())
      .withName(userData.getName())
      .withEmail(userData.getEmail())
      .withSessionId(session.getSessionId())
      .withAuthenticationContextClassReference("1");

    const nonce = session.getNonce();
    if (nonce !== undefined) {
      builder.withClaim("nonce", nonce);
    }

    switch (loginRoleMapping) {
      case LoginRoleMappingValues.TO_REALM:
        builder.withRealmRoles(session.getRoles());
        break;
      case LoginRoleMappingValues.TO_RESOURCE:
        setResourceRoles(builder, session, defaultAudiences);
        break;
      case LoginRoleMappingValues.TO_BOTH:
        builder.withRealmRoles(session.getRoles());
        setResourceRoles(builder, session, defaultAudiences);
        break;
    }

    return this.getToken(builder.build(), requestConfiguration);
  }

  parseToken(token: string): JwtClaims {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (encodedHeader === undefined || encodedPayload === undefined || encodedSignature === undefined) {
      throw new Error("Invalid JWT format");
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const verified = createVerify("RSA-SHA256").update(signingInput).end().verify(this.publicKey, Buffer.from(encodedSignature, "base64url"));
    if (!verified) {
      throw new Error("Invalid JWT signature");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as JwtClaims;
    const now = Math.floor(Date.now() / 1_000);
    if (typeof payload.exp === "number" && payload.exp <= now) {
      throw new Error("JWT is expired");
    }
    if (typeof payload.nbf === "number" && payload.nbf > now) {
      throw new Error("JWT is not active yet");
    }
    return payload;
  }

  getJwks(): { keys: Record<string, unknown>[] } {
    const jwk = this.publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    return {
      keys: [
        {
          ...jwk,
          kid: this.keyId,
          use: "sig",
          alg: "RS256"
        }
      ]
    };
  }

  private encodeGivenOrDefaultScopes(scopes: readonly string[]): string {
    return uniqueStrings([DEFAULT_SCOPE, ...(scopes.length === 0 ? this.defaultScopes : scopes)]).join(" ");
  }

  private getUserDataClaims(tokenConfig: TokenConfig, requestConfiguration: UrlConfiguration): Record<string, string | undefined> {
    if (tokenConfig.isGenerateUserDataFromSubject()) {
      const generated = UserData.fromUsernameAndHostname(tokenConfig.getSubject(), requestConfiguration.getHostname());
      return {
        name: tokenConfig.getName() ?? generated.getName(),
        given_name: tokenConfig.getGivenName() ?? generated.getGivenName(),
        family_name: tokenConfig.getFamilyName() ?? generated.getFamilyName(),
        email: tokenConfig.getEmail() ?? generated.getEmail(),
        preferred_username: tokenConfig.getPreferredUsername() ?? generated.getPreferredUsername()
      };
    }

    return {
      name: tokenConfig.getName(),
      given_name: tokenConfig.getGivenName(),
      family_name: tokenConfig.getFamilyName(),
      email: tokenConfig.getEmail(),
      preferred_username: tokenConfig.getPreferredUsername()
    };
  }
}

function setResourceRoles(
  builder: ReturnType<typeof TokenConfig.aTokenConfig>,
  session: Session,
  defaultAudiences: readonly string[]
): void {
  builder.withResourceRoles(session.getClientId(), session.getRoles());
  for (const audience of defaultAudiences) {
    builder.withResourceRoles(audience, session.getRoles());
  }
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: KeyObject): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}
