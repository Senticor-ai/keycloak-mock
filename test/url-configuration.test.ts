import { describe, expect, it } from "vitest";
import { Protocol, UrlConfiguration, aServerConfig } from "../src/index.js";

describe("UrlConfiguration", () => {
  it.each([
    [aServerConfig().build(), "http://localhost:8000", "/auth/realms/master"],
    [
      aServerConfig().withDefaultHostname("defaultHost").withDefaultRealm("defaultRealm").build(),
      "http://defaultHost:8000",
      "/auth/realms/defaultRealm"
    ],
    [aServerConfig().withPort(80).build(), "http://localhost", "/auth/realms/master"],
    [aServerConfig().withPort(443).build(), "http://localhost:443", "/auth/realms/master"],
    [aServerConfig().withTls(true).withPort(80).build(), "https://localhost:80", "/auth/realms/master"],
    [aServerConfig().withTls(true).withPort(443).build(), "https://localhost", "/auth/realms/master"],
    [aServerConfig().withNoContextPath().build(), "http://localhost:8000", "/realms/master"],
    [aServerConfig().withContextPath("auth").build(), "http://localhost:8000", "/auth/realms/master"],
    [aServerConfig().withContextPath("/auth").build(), "http://localhost:8000", "/auth/realms/master"],
    [aServerConfig().withContextPath("/context-path").build(), "http://localhost:8000", "/context-path/realms/master"],
    [
      aServerConfig().withContextPath("complex/context/path").build(),
      "http://localhost:8000",
      "/complex/context/path/realms/master"
    ]
  ])("generates base URL and issuer", (serverConfig, expectedBaseUrl, expectedIssuerPath) => {
    const urlConfiguration = new UrlConfiguration(serverConfig, null, null);

    expect(urlConfiguration.getBaseUrl()).toBe(expectedBaseUrl);
    expect(urlConfiguration.getIssuer()).toBe(`${expectedBaseUrl}${expectedIssuerPath}`);
  });

  it.each([
    [null, null, "http://localhost:8000/auth/realms/master"],
    ["requestHost", null, "http://requestHost/auth/realms/master"],
    [null, "requestRealm", "http://localhost:8000/auth/realms/requestRealm"],
    ["requestHost", "requestRealm", "http://requestHost/auth/realms/requestRealm"]
  ])("uses request host and realm when provided", (requestHost, requestRealm, expectedIssuer) => {
    const urlConfiguration = new UrlConfiguration(aServerConfig().build(), requestHost, requestRealm);

    expect(urlConfiguration.getIssuer()).toBe(expectedIssuer);
  });

  it("uses request context with no context path", () => {
    const urlConfiguration = new UrlConfiguration(
      aServerConfig().withNoContextPath().build(),
      "requestHostNoContextPath",
      "requestRealm"
    );

    expect(urlConfiguration.getIssuer()).toBe("http://requestHostNoContextPath/realms/requestRealm");
  });

  it("uses request context with custom context path", () => {
    const urlConfiguration = new UrlConfiguration(
      aServerConfig().withContextPath("custom/context/path").build(),
      "requestHostCustomContextPath",
      "requestRealm"
    );

    expect(urlConfiguration.getIssuer()).toBe("http://requestHostCustomContextPath/custom/context/path/realms/requestRealm");
  });

  it("generates OpenID URLs", () => {
    const urlConfiguration = new UrlConfiguration(aServerConfig().build(), null, null);

    expect(urlConfiguration.getIssuerPath()).toBe("http://localhost:8000/auth/realms/master/");
    expect(urlConfiguration.getOpenIdPath("1234")).toBe("http://localhost:8000/auth/realms/master/protocol/openid-connect/1234");
    expect(urlConfiguration.getAuthorizationEndpoint()).toBe("http://localhost:8000/auth/realms/master/protocol/openid-connect/auth");
    expect(urlConfiguration.getEndSessionEndpoint()).toBe("http://localhost:8000/auth/realms/master/protocol/openid-connect/logout");
    expect(urlConfiguration.getJwksUri()).toBe("http://localhost:8000/auth/realms/master/protocol/openid-connect/certs");
    expect(urlConfiguration.getTokenEndpoint()).toBe("http://localhost:8000/auth/realms/master/protocol/openid-connect/token");
    expect(urlConfiguration.getTokenIntrospectionEndpoint()).toBe(
      "http://localhost:8000/auth/realms/master/protocol/openid-connect/token/introspect"
    );
  });

  it("generates OpenID URLs without a context path", () => {
    const urlConfiguration = new UrlConfiguration(aServerConfig().withNoContextPath().build(), null, null);

    expect(urlConfiguration.getIssuerPath()).toBe("http://localhost:8000/realms/master/");
    expect(urlConfiguration.getOpenIdPath("1234")).toBe("http://localhost:8000/realms/master/protocol/openid-connect/1234");
    expect(urlConfiguration.getAuthorizationEndpoint()).toBe("http://localhost:8000/realms/master/protocol/openid-connect/auth");
    expect(urlConfiguration.getEndSessionEndpoint()).toBe("http://localhost:8000/realms/master/protocol/openid-connect/logout");
    expect(urlConfiguration.getJwksUri()).toBe("http://localhost:8000/realms/master/protocol/openid-connect/certs");
    expect(urlConfiguration.getTokenEndpoint()).toBe("http://localhost:8000/realms/master/protocol/openid-connect/token");
  });

  it("generates OpenID URLs with a custom context path", () => {
    const urlConfiguration = new UrlConfiguration(aServerConfig().withContextPath("/custom/context/path").build(), null, null);

    expect(urlConfiguration.getIssuerPath()).toBe("http://localhost:8000/custom/context/path/realms/master/");
    expect(urlConfiguration.getOpenIdPath("1234")).toBe(
      "http://localhost:8000/custom/context/path/realms/master/protocol/openid-connect/1234"
    );
    expect(urlConfiguration.getAuthorizationEndpoint()).toBe(
      "http://localhost:8000/custom/context/path/realms/master/protocol/openid-connect/auth"
    );
    expect(urlConfiguration.getEndSessionEndpoint()).toBe(
      "http://localhost:8000/custom/context/path/realms/master/protocol/openid-connect/logout"
    );
    expect(urlConfiguration.getJwksUri()).toBe(
      "http://localhost:8000/custom/context/path/realms/master/protocol/openid-connect/certs"
    );
    expect(urlConfiguration.getTokenEndpoint()).toBe(
      "http://localhost:8000/custom/context/path/realms/master/protocol/openid-connect/token"
    );
  });

  it.each([
    [true, Protocol.HTTPS],
    [false, Protocol.HTTP]
  ])("sets protocol from TLS flag", (tls, expectedProtocol) => {
    const urlConfiguration = new UrlConfiguration(aServerConfig().withTls(tls).build(), null, null);

    expect(urlConfiguration.getProtocol()).toBe(expectedProtocol);
  });
});
