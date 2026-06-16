# Java to Vitest Test Parity

This matrix tracks behavior parity between the retained Java reference tests and the supported TypeScript implementation.

Parity is defined at the supported behavior boundary:

- Count public TypeScript API behavior.
- Count HTTP/OIDC endpoint behavior.
- Count token, claim, session, redirect, and introspection semantics.
- Exclude Java-only surfaces such as JUnit rules/extensions, Vert.x handler mocks, Spring example application wiring, Gradle packaging, and Java keystore mechanics.

Statuses:

- Covered: supported behavior is asserted by Vitest.
- Excluded: Java-only or example-only behavior outside the TypeScript package support boundary.
- Intentionally changed: the TypeScript package supports a different behavior by design.

## Public API

| Java test | Behavior asserted | TypeScript coverage | Status | Reason |
| --- | --- | --- | --- | --- |
| `TokenConfigTest.default_values_are_used` | Token config defaults | `test/token-config.test.ts` - `uses Java-compatible defaults` | Covered | Public builder behavior |
| `TokenConfigTest.audience_is_set_correctly` | Audience builder accumulation | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.authentication_context_class_reference_is_set_correctly` | ACR builder field | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.authenticationTime_is_set_correctly` | Authentication time setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.authorizedParty_is_set_correctly` | Authorized party setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.custom_claims_are_set_correctly` | Custom claims merge | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.last_claim_version_wins` | Last custom claim wins | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.email_is_set_correctly` | Email setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.expiration_is_set_correctly` | Expiration setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.names_are_set_correctly` | Explicit name fields | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.name_is_filled_from_given_and_family_name_if_not_set` | Derived display name | `test/token-config.test.ts` - `derives name from given and family names` | Covered | Public builder behavior |
| `TokenConfigTest.hostname_is_set_correctly` | Hostname setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.issuedAt_is_set_correctly` | Issued-at setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.notBefore_is_set_correctly` | Not-before setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.preferredUsername_is_set_correctly` | Preferred username setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.realm_is_set_correctly` | Realm setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.realmAccess_is_set_correctly` | Realm role accumulation | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.resourceAccess_is_set_correctly` | Resource role accumulation | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.scope_is_set_correctly` | Scope accumulation | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.subject_is_set_correctly` | Subject setter | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.user_data_is_generated_from_subject` | Generated-user-data flag | `test/token-config.test.ts` - `sets builder values and deduplicates role sets` | Covered | Public builder behavior |
| `TokenConfigTest.config_is_set_correctly_from_original_token` | Source-token claim copy without signature trust | `test/token-config.test.ts` - `copies supported claims from source tokens without trusting signatures` | Covered | Public builder behavior |
| `TokenConfigTest.invalid_issuer_causes_exception` | Invalid issuer rejection | `test/token-config.test.ts` - `rejects source tokens with invalid issuer URLs` | Covered | Public builder behavior |
| `TokenConfigTest.unexpected_issuer_causes_exception` | Unexpected issuer path rejection | `test/token-config.test.ts` - `rejects source tokens with unexpected issuer paths` | Covered | Public builder behavior |
| `KeycloakMockTest.generated_token_uses_correct_issuer` | Token host and realm override issuer | `test/keycloak-mock.test.ts` and `test/token-generator.test.ts` | Covered | Public token API |
| `KeycloakMockTest.contains_client_scopes_during_server_configuration` | Default scopes in tokens | `test/token-generator.test.ts` - `uses and overrides default scopes` | Covered | Public token API |
| `KeycloakMockTest.contains_default_client_scope_during_server_configuration` | Default `openid` scope | `test/token-generator.test.ts` - `uses and overrides default scopes` | Covered | Public token API |
| `KeycloakMockTest.contains_default_audiences` | Default audiences in tokens | `test/token-generator.test.ts` - `uses default audiences unless token config overrides them` | Covered | Public token API |
| `TokenGeneratorTest.config_is_correctly_applied` | JWT header, standard claims, roles, dates, custom claims | `test/token-generator.test.ts` - `applies token config values to signed JWTs` | Covered | Public token API |
| `TokenGeneratorTest.user_data_is_not_generated` | No implicit user profile claims | `test/token-generator.test.ts` - `does not generate user data unless requested` | Covered | Public token API |
| `TokenGeneratorTest.user_data_is_generated` | Profile claims from subject | `test/token-generator.test.ts` - `generates user data from subject` | Covered | Public token API |
| `TokenGeneratorTest.explicit_user_data_takes_preference` | Explicit profile claims override generated values | `test/token-generator.test.ts` - `lets explicit user data override generated values` | Covered | Public token API |
| `TokenGeneratorTest.default_scopes_are_used` | Default scopes | `test/token-generator.test.ts` - `uses and overrides default scopes` | Covered | Public token API |
| `TokenGeneratorTest.default_scopes_are_overridden` | Explicit scopes override defaults | `test/token-generator.test.ts` - `uses and overrides default scopes` | Covered | Public token API |
| `TokenGeneratorTest.duplicate_scopes_are_removed` | Scope de-duplication | `test/token-generator.test.ts` - `uses and overrides default scopes` | Covered | Public token API |
| `TokenGeneratorTest.default_lifespan_is_used` | Default token expiration | `test/token-generator.test.ts` - `uses default lifespan unless token lifespan overrides it` | Covered | Public token API |
| `TokenGeneratorTest.default_lifespan_is_overridden_with_token_lifespan` | Token-specific expiration override | `test/token-generator.test.ts` - `uses default lifespan unless token lifespan overrides it` | Covered | Public token API |
| `TokenGeneratorTest.default_audiences_are_used` | Default audiences | `test/token-generator.test.ts` - `uses default audiences unless token config overrides them` | Covered | Public token API |
| `TokenGeneratorTest.token_audience_overrides_defaults` | Explicit audience override | `test/token-generator.test.ts` - `uses default audiences unless token config overrides them` | Covered | Public token API |
| `UserDataTest.userData_is_extracted_correctly` | Username to profile claim extraction cases | `test/token-generator.test.ts` - `generates user data from subject` | Covered | Public token API |

## URL And Routing

| Java test | Behavior asserted | TypeScript coverage | Status | Reason |
| --- | --- | --- | --- | --- |
| `UrlConfigurationTest.base_url_is_generated_correctly` | Base URL and issuer path variants | `test/url-configuration.test.ts` - `generates base URL and issuer` | Covered | Public URL API |
| `UrlConfigurationTest.context_parameters_are_used_correctly` | Request host and realm override defaults | `test/url-configuration.test.ts` - `uses request host and realm when provided` | Covered | Public URL API |
| `UrlConfigurationTest.context_parameters_are_used_correctly_for_server_config_with_no_context_path` | No context path | `test/url-configuration.test.ts` - `uses request context with no context path` | Covered | Public URL API |
| `UrlConfigurationTest.context_parameters_are_used_correctly_for_server_config_with_custom_context_path` | Custom context path | `test/url-configuration.test.ts` - `uses request context with custom context path` | Covered | Public URL API |
| `UrlConfigurationTest.urls_are_correct` | OpenID endpoint URL generation | `test/url-configuration.test.ts` - `generates OpenID URLs` | Covered | Public URL API |
| `UrlConfigurationTest.urls_are_correct_with_no_context_path` | OpenID URLs without context path | `test/url-configuration.test.ts` - `generates OpenID URLs without a context path` | Covered | Public URL API |
| `UrlConfigurationTest.urls_are_correct_with_custom_context_path` | OpenID URLs with custom context path | `test/url-configuration.test.ts` - `generates OpenID URLs with a custom context path` | Covered | Public URL API |
| `UrlConfigurationTest.protocol_is_correct` | HTTP/HTTPS protocol selection | `test/url-configuration.test.ts` - `sets protocol from TLS flag` | Covered | Public URL API |
| `UrlConfigurationFactoryTest.context_parameters_are_used_correctly` | Host and realm extraction | `test/url-configuration.test.ts` and server discovery host test | Covered | Factory is not exported, behavior is covered |
| `UrlConfigurationFactoryTest.context_parameters_are_extracted_correctly` | Request Host and realm extraction | `test/keycloak-mock-server.test.ts` - `returns discovery metadata using the request host` | Covered | Black-box HTTP behavior |

## HTTP/OIDC Server

| Java test | Behavior asserted | TypeScript coverage | Status | Reason |
| --- | --- | --- | --- | --- |
| `KeycloakMockIntegrationTest.mock_server_can_be_started_and_stopped` | Server lifecycle | `test/keycloak-mock-server.test.ts` - `starts, stops, and starts again` | Covered | Public server API |
| `KeycloakMockIntegrationTest.mock_server_can_be_started_and_stopped_twice` | Repeated lifecycle | `test/keycloak-mock-server.test.ts` - `starts, stops, and starts again` | Covered | Public server API |
| `KeycloakMockIntegrationTest.mock_server_fails_when_port_is_claimed` | Claimed port failure | `test/keycloak-mock-server.test.ts` - `fails when the configured port is already claimed` | Covered | Public server API |
| `KeycloakMockIntegrationTest.mock_server_endpoint_is_correctly_configured` | Fixed/random port and HTTPS | `test/keycloak-mock-server.test.ts` - lifecycle and HTTPS tests | Covered | Public server API |
| `KeycloakMockIntegrationTest.generated_token_is_valid` | JWKS can verify generated tokens | `test/keycloak-mock.test.ts`, `test/keycloak-mock-server.test.ts` JWKS checks | Covered | Public token/JWKS behavior |
| `KeycloakMockIntegrationTest.well_known_configuration_works` | Discovery metadata | `test/keycloak-mock-server.test.ts` - `returns discovery metadata using the request host` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.mock_server_answers_204_on_iframe_init` | Login status iframe init | `test/keycloak-mock-server.test.ts` - `serves JWKS and compatibility resources` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.mock_server_properly_returns_resources` | Static compatibility resources | `test/keycloak-mock-server.test.ts` - `serves JWKS and compatibility resources` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.iframe_has_correct_shim_path` | Iframe references web-crypto shim | `test/keycloak-mock-server.test.ts` - `serves JWKS and compatibility resources` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.mock_server_returns_404_on_nonexistent_resource` | 404 for unknown resource | `test/keycloak-mock-server.test.ts` - `serves JWKS and compatibility resources` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_implicit_flow_works` | Implicit flow, session cookie, session reuse, GET logout | `test/keycloak-mock-server.test.ts` - `supports implicit login flow, session reuse, and GET logout` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_logout_with_POST_works` | POST logout | `test/keycloak-mock-server.test.ts` - `supports authorization-code login flow, refresh tokens, and POST logout` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_authorization_code_flow_works` | Auth-code login and refresh grant | `test/keycloak-mock-server.test.ts` - `supports authorization-code login flow, refresh tokens, and POST logout` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_resource_owner_password_credentials_flow_works_with_client_id_parameter` | Password grant with form client id | `test/keycloak-mock-server.test.ts` - `supports password and client-credentials token grants` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_resource_owner_password_credentials_flow_works` | Password grant with Basic auth | `test/keycloak-mock-server.test.ts` - `supports password and client-credentials token grants` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_client_credentials_flow_works` | Client-credentials grant with Basic auth | `test/keycloak-mock-server.test.ts` - `supports password and client-credentials token grants` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.mock_server_login_with_client_credentials_flow_using_form_works` | Client-credentials grant with form auth | `test/keycloak-mock-server.test.ts` - `supports password and client-credentials token grants` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.documentation_works` | Documentation endpoint HTML row and JSON map | `test/keycloak-mock-server.test.ts` - `serves documentation as HTML and JSON` | Covered | HTTP behavior |
| `KeycloakMockIntegrationTest.token_introspection_works` | Active introspection with claims | `test/keycloak-mock-server.test.ts` - `introspects active tokens and hides claims for invalid tokens` | Covered | HTTP/OIDC behavior |
| `KeycloakMockIntegrationTest.token_introspection_does_not_leak_claims_on_invalid_token` | Inactive introspection hides claims | `test/keycloak-mock-server.test.ts` - `introspects active tokens and hides claims for invalid tokens` | Covered | HTTP/OIDC behavior |
| `WellKnownRouteTest.well_known_configuration_is_complete` | Discovery response completeness | `test/keycloak-mock-server.test.ts` - discovery metadata test | Covered | Black-box HTTP behavior |
| `JwksRouteTest.rsaKeyIsCorrectlyExported` | RSA JWKS shape | `test/keycloak-mock-server.test.ts` - JWKS check | Covered | HTTP behavior |
| `JwksRouteTest.ecKeyIsCorrectlyExported` | EC key export from Java keystore | None | Intentionally changed | TypeScript package currently generates RSA signing keys only and does not expose Java keystore injection |
| `TokenIntrospectionRouteTest.happy_case` | Active introspection JSON | `test/keycloak-mock-server.test.ts` - introspection test | Covered | Black-box HTTP behavior |
| `TokenIntrospectionRouteTest.exception_returns_active_false` | Invalid token gives `{ active: false }` | `test/keycloak-mock-server.test.ts` - introspection invalid-token test | Covered | Black-box HTTP behavior |
| `AuthenticationRouteTest.missing_session_causes_error` | Unknown authentication session | `test/keycloak-mock-server.test.ts` - `returns login and authentication request errors` | Covered | Black-box HTTP behavior |
| `AuthenticationRouteTest.missing_username_causes_error` | Missing username validation | `test/keycloak-mock-server.test.ts` - `returns login and authentication request errors` | Covered | Black-box HTTP behavior |
| `AuthenticationRouteTest.correct_token_is_created` | Username/password roles create session and redirect | Login flow tests | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_grant_type_causes_error` | Missing grant type returns 400 | `test/keycloak-mock-server.test.ts` - `returns Java-compatible token grant errors` | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_authorization_code_causes_error_for_type_authorization_code` | Missing auth code returns 404 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.unknown_authorization_code_causes_error_for_type_authorization_code` | Unknown auth code returns 404 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_token_causes_error_for_type_refresh_token` | Missing refresh token returns 400 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_authentication_causes_error_for_type_password` | Missing password-grant auth returns 400 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_client_id_causes_error_for_type_password` | Missing password client id returns 400 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_username_causes_error_for_type_password` | Missing username returns 400 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_authentication_causes_error_for_type_client_credentials` | Missing client-credentials auth returns 401 | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `TokenRouteTest.missing_clientId_causes_error_for_type_client_credentials` | Invalid or missing client id returns error | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `OptionalClientAuthHandlerTest.allow_missing_authentication` | Missing optional auth allowed before route validation | Token grant error tests | Covered | Internal handler behavior verified through public route outcomes |
| `OptionalClientAuthHandlerTest.ignore_basic_non_base64_data` | Invalid Basic header ignored | `test/keycloak-mock-server.test.ts` - token grant errors | Covered | Black-box HTTP behavior |
| `OptionalClientAuthHandlerTest.forward_basic_username` | Basic auth username-only client id | `test/keycloak-mock-server.test.ts` - client-credentials username-only case | Covered | Black-box HTTP behavior |
| `OptionalClientAuthHandlerTest.forward_basic_username_and_password` | Basic auth client id and secret | `test/keycloak-mock-server.test.ts` - password/client-credentials grants | Covered | Black-box HTTP behavior |
| `OptionalClientAuthHandlerTest.forward_form_client_id` | Form client id | `test/keycloak-mock-server.test.ts` - password/client-credentials grants | Covered | Black-box HTTP behavior |
| `OptionalClientAuthHandlerTest.forward_form_client_id_and_client_secret` | Form client id and secret | `test/keycloak-mock-server.test.ts` - password/client-credentials grants | Covered | Black-box HTTP behavior |
| `RedirectHelperTest.redirect_location_is_not_generated_on_missing_response_type` | Unsupported response type fails redirect | `test/keycloak-mock-server.test.ts` - `rejects unsupported redirect response types after authentication` | Covered | Black-box HTTP behavior |
| `RedirectHelperTest.redirect_location_is_generated_correctly` | Response type and mode redirect parameters | `test/keycloak-mock-server.test.ts` - `supports Java-style relative redirect_uri values` and `matches Java redirect behavior for response_type=%s response_mode=%s` | Covered | Black-box HTTP behavior |
| `RedirectHelperTest.redirect_location_keeps_existing_parameters` | Preserve existing query/fragment | `test/keycloak-mock-server.test.ts` - `preserves existing redirect parameters for %s with %s response mode` | Covered | Black-box HTTP behavior |
| `RedirectHelperTest.oob_redirect_location_is_generated_correctly` | OOB redirect URI | `test/keycloak-mock-server.test.ts` - response-mode/OOB test | Covered | Black-box HTTP behavior |
| `RedirectHelperTest.cookie_is_generated_correctly` | Session cookie value/path/max-age | `test/keycloak-mock-server.test.ts` - login/logout flow tests | Covered | Black-box HTTP behavior |
| `TokenHelperTest.token_is_correctly_generated` | Session data to token config | Login flow token claim tests | Covered | Black-box HTTP behavior |
| `TokenHelperTest.default_audiences_are_added` | Client plus default audiences | Password/client-credentials grant tests | Covered | Black-box HTTP behavior |
| `TokenHelperTest.resource_roles_are_added` | Resource role mapping | `test/keycloak-mock.test.ts` and grant tests with role mappings | Covered | Public token behavior |
| `TokenHelperTest.resource_and_realm_roles_are_added` | Realm and resource role mapping | `test/keycloak-mock.test.ts` and grant tests with role mappings | Covered | Public token behavior |

## Excluded Java-Only Or Example Tests

| Java test | Behavior asserted | TypeScript coverage | Status | Reason |
| --- | --- | --- | --- | --- |
| `KeycloakMockRuleJunit4Test.mock_is_running` | JUnit 4 rule starts Java mock | None | Excluded | JUnit 4 support is outside the TypeScript package |
| `KeycloakMockExtensionJunit5Test.mock_is_running` | JUnit 5 extension starts Java mock | None | Excluded | JUnit 5 support is outside the TypeScript package |
| `KeycloakMockExtensionJunit5Test.https_is_working` | JUnit 5 extension HTTPS config | `test/keycloak-mock-server.test.ts` covers HTTPS server behavior | Excluded | Extension API is Java-only; underlying HTTPS behavior is covered |
| `AuthenticationJUnit4Test.no_authentication_fails` | Spring example backend rejects missing auth | None | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit4Test.authentication_works` | Spring example backend accepts valid token | Token generation tests cover token claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit4Test.authentication_without_role_fails` | Spring example backend role authorization | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit4Test.authentication_with_realm_role_works` | Spring example backend realm-role auth | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit4Test.authentication_with_resource_role_works` | Spring example backend resource-role auth | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit5Test.no_authentication_fails` | Spring example backend rejects missing auth | None | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit5Test.authentication_works` | Spring example backend accepts valid token | Token generation tests cover token claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit5Test.authentication_without_role_fails` | Spring example backend role authorization | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit5Test.authentication_with_realm_role_works` | Spring example backend realm-role auth | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `AuthenticationJUnit5Test.authentication_with_resource_role_works` | Spring example backend resource-role auth | Token role tests cover role claims | Excluded | Example Spring application is not part of the TypeScript package |
| `HandlerTestBase.setupServerResponse` | Mockito response setup | None | Excluded | Test helper, not product behavior |

## Enforcement

Vitest coverage is enforced globally over `src/**/*.ts` through `pnpm coverage` and PNPM CI, excluding `src/cli.ts`.
The CLI is an executable wrapper around the covered server/config APIs and has no Java parity test equivalent.

Current minimum thresholds:

- Statements: 89%
- Branches: 77%
- Functions: 92%
- Lines: 90%

These thresholds are intentionally global rather than per-file. Some validation modules are branch-heavy by design, while parity is judged against public behavior and HTTP/OIDC semantics.
