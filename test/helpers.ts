import { afterEach, expect } from "vitest";
import { KeycloakMock, type ServerConfig, type ServerConfigOptions } from "../src/index.js";

const runningMocks: KeycloakMock[] = [];

afterEach(async () => {
  await Promise.all(runningMocks.splice(0).map((mock) => mock.stop()));
});

export async function startMock(config?: ServerConfig | ServerConfigOptions): Promise<KeycloakMock> {
  const mock = new KeycloakMock(config);
  await mock.start();
  runningMocks.push(mock);
  return mock;
}

export function mockBaseUrl(mock: KeycloakMock, realm = "realm"): string {
  return `http://localhost:${mock.getActualPort()}/auth/realms/${realm}`;
}

export async function postForm(
  url: string,
  data: Record<string, string>,
  headers: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(data)
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as Record<string, unknown>;
}

export function basicAuth(clientId: string, clientSecret = ""): string {
  const value = clientSecret === "" ? clientId : `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
}

export function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

export function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const [header, payload] = token.split(".");
  if (header === undefined || payload === undefined) {
    throw new Error("Invalid token");
  }
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Record<string, unknown>,
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
  };
}

export function expectDateCloseTo(actual: Date | undefined, expected: Date, toleranceMs = 1_000): void {
  expect(actual).toBeInstanceOf(Date);
  expect(Math.abs((actual as Date).getTime() - expected.getTime())).toBeLessThanOrEqual(toleranceMs);
}

export function expectEpochCloseTo(actual: unknown, expected: Date, toleranceSeconds = 1): void {
  expect(typeof actual).toBe("number");
  expect(Math.abs((actual as number) - Math.floor(expected.getTime() / 1_000))).toBeLessThanOrEqual(toleranceSeconds);
}

export function getSetCookie(response: Response, name: string): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter((value): value is string => value !== null);
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  expect(cookie).toBeDefined();
  return cookie as string;
}

export function parseCookieValue(cookie: string): string {
  return cookie.split(";", 1)[0]?.split("=").slice(1).join("=") ?? "";
}

export function extractFormAction(html: string): string {
  const action = /action="([^"]+)"/u.exec(html)?.[1];
  expect(action).toBeDefined();
  return action as string;
}
