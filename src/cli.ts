#!/usr/bin/env node
import { KeycloakMock } from "./keycloak-mock.js";
import { aServerConfig } from "./config.js";
import { LoginRoleMapping } from "./types.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const builder = aServerConfig();

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  switch (arg) {
    case "--port":
    case "-p":
      builder.withPort(Number(readValue(args, ++index, arg)));
      break;
    case "--realm":
      builder.withDefaultRealm(readValue(args, ++index, arg));
      break;
    case "--hostname":
      builder.withDefaultHostname(readValue(args, ++index, arg));
      break;
    case "--contextPath":
    case "--context-path":
      builder.withContextPath(readValue(args, ++index, arg));
      break;
    case "--noContextPath":
    case "--no-context-path":
      builder.withNoContextPath();
      break;
    case "--https":
    case "--tls":
    case "-s":
      builder.withTls(true);
      break;
    case "--audiences":
    case "-a":
      builder.withDefaultAudiences(splitCsv(readValue(args, ++index, arg)));
      break;
    case "--scopes":
      builder.withDefaultScopes(splitCsv(readValue(args, ++index, arg)));
      break;
    case "--roleMapping":
    case "--role-mapping":
      builder.withLoginRoleMapping(readRoleMapping(readValue(args, ++index, arg)));
      break;
    case "--tokenLifespan":
    case "--token-lifespan":
      builder.withDefaultTokenLifespan(readValue(args, ++index, arg));
      break;
    default:
      throw new Error(`Unknown argument: ${arg}`);
  }
}

const mock = new KeycloakMock(builder.build());
await mock.start();

console.log(`Keycloak mock is running at ${mock.getIssuer()}`);
console.log("Press Ctrl+C to stop.");

process.once("SIGINT", () => {
  void mock.stop().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void mock.stop().finally(() => process.exit(0));
});

function readValue(values: readonly string[], index: number, flag: string): string {
  const value = values[index];
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRoleMapping(value: string): LoginRoleMapping {
  switch (value) {
    case LoginRoleMapping.TO_REALM:
    case LoginRoleMapping.TO_RESOURCE:
    case LoginRoleMapping.TO_BOTH:
      return value;
    default:
      throw new Error(`Invalid role mapping: ${value}`);
  }
}

function printHelp(): void {
  console.log(`Usage: keycloak-mock [options]

Starts a stand-alone Keycloak mock.

Options:
  -p, --port <port>              Port to listen on (default: 8000, 0 for random)
      --realm <realm>            Default realm (default: master)
      --hostname <hostname>      Default issuer hostname (default: localhost)
      --context-path <path>      Keycloak context path (default: /auth)
      --no-context-path          Disable the context path
  -s, --https, --tls             Serve HTTPS with a generated self-signed certificate
  -a, --audiences <csv>          Default token audiences
      --scopes <csv>             Default token scopes
      --role-mapping <mapping>   TO_REALM, TO_RESOURCE, or TO_BOTH
      --token-lifespan <value>   Token lifespan, e.g. 10h, 15m, 3m45s
  -h, --help                     Show this help
`);
}
