# @senticor-ai/keycloak-mock

Strict TypeScript ESM Keycloak/OIDC mock for Node integration tests.

This package ports the useful runtime behavior of `TNG/keycloak-mock` from the Java/Maven ecosystem to a small pnpm/npm package that can be consumed by TypeScript services such as `cognitive-hive-os` and `talentiq`.

The existing Java/Gradle sources are kept as reference material while Vitest coverage is brought to parity. They are not part of the supported package surface, and Java CI is manual-only.

Java-to-Vitest parity decisions are tracked in [docs/test-parity.md](docs/test-parity.md).

## Install

```bash
pnpm add -D @senticor-ai/keycloak-mock
```

Requires Node.js 20.11 or newer.

## Test Server Usage

```ts
import { KeycloakMock, aServerConfig } from "@senticor-ai/keycloak-mock";

const keycloak = new KeycloakMock(
  aServerConfig()
    .withRandomPort()
    .withDefaultRealm("talentiq")
    .withNoContextPath()
    .build()
);

await keycloak.start();

const issuer = keycloak.getIssuer("talentiq");
const tokenEndpoint = `${issuer}/protocol/openid-connect/token`;

// Run your app or tests against issuer/tokenEndpoint.

await keycloak.stop();
```

## Direct Token Usage

```ts
import { KeycloakMock, aTokenConfig } from "@senticor-ai/keycloak-mock";

const keycloak = new KeycloakMock();

const accessToken = keycloak.getAccessToken(
  aTokenConfig()
    .withRealm("master")
    .withSubjectAndGeneratedUserData("jane.doe")
    .withAudience("api")
    .withRealmRole("admin")
    .build()
);
```

## Implemented Endpoints

The server supports the endpoints most test suites need:

- `GET /auth/realms/:realm/.well-known/openid-configuration`
- `GET /auth/realms/:realm/protocol/openid-connect/certs`
- `GET /auth/realms/:realm/protocol/openid-connect/auth`
- `POST /auth/realms/:realm/authenticate/:sessionId`
- `POST /auth/realms/:realm/protocol/openid-connect/token`
- `POST /auth/realms/:realm/protocol/openid-connect/token/introspect`
- `GET|POST /auth/realms/:realm/protocol/openid-connect/logout`
- `GET /docs`

Supported token grants are `authorization_code`, `refresh_token`, `password`, and `client_credentials`. Like the original mock, credentials are accepted without verification and are only used to shape the returned token.

## CLI

```bash
pnpm dlx @senticor-ai/keycloak-mock --port 8000 --realm master
```

Useful options:

```bash
--no-context-path
--https
--audiences api,account
--scopes email,profile
--role-mapping TO_REALM|TO_RESOURCE|TO_BOTH
--token-lifespan 10h
```

## Publish

`keycloak-mock` is already taken on npm, so this port is configured as `@senticor-ai/keycloak-mock`.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm coverage
pnpm build
pnpm pack --dry-run
pnpm publish --access public
```

Publishing requires npm access to the `@senticor-ai` scope.

## Attribution

This TypeScript port is derived from the Apache-2.0 licensed `TNG/keycloak-mock` project. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
