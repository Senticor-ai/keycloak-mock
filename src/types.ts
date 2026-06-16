export const Protocol = {
  HTTP: "http",
  HTTPS: "https"
} as const;

export type Protocol = (typeof Protocol)[keyof typeof Protocol];

export const LoginRoleMapping = {
  TO_REALM: "TO_REALM",
  TO_RESOURCE: "TO_RESOURCE",
  TO_BOTH: "TO_BOTH"
} as const;

export type LoginRoleMapping = (typeof LoginRoleMapping)[keyof typeof LoginRoleMapping];

export type DurationInput =
  | number
  | string
  | {
      milliseconds?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    };

export type InstantInput = Date | number | string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ServerConfigOptions {
  port?: number;
  tls?: boolean;
  protocol?: Protocol;
  defaultHostname?: string;
  contextPath?: string;
  defaultRealm?: string;
  defaultAudiences?: Iterable<string>;
  defaultScopes?: Iterable<string>;
  defaultTokenLifespan?: DurationInput;
  loginRoleMapping?: LoginRoleMapping;
}

export interface TokenConfigOptions {
  audience?: string | Iterable<string>;
  authorizedParty?: string;
  subject?: string;
  scopes?: Iterable<string>;
  claims?: Record<string, unknown>;
  realmRoles?: Iterable<string>;
  resourceRoles?: Record<string, Iterable<string>>;
  sessionId?: string;
  issuedAt?: InstantInput;
  authenticationTime?: InstantInput;
  tokenLifespan?: DurationInput;
  notBefore?: InstantInput | null;
  expiration?: InstantInput | null;
  hostname?: string;
  realm?: string;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  preferredUsername?: string | null;
  authenticationContextClassReference?: string | null;
  generateUserDataFromSubject?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  id_token: string;
  session_state: string;
}

export type JwtClaims = Record<string, unknown>;
