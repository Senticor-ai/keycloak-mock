import { randomUUID } from "node:crypto";

export interface Session {
  getClientId(): string;
  getSessionId(): string;
  getUserData(): UserData;
  getRoles(): readonly string[];
  getNonce(): string | undefined;
}

export class UserData {
  private constructor(
    readonly subject: string,
    readonly givenName: string | undefined,
    readonly familyName: string,
    readonly email: string,
    readonly preferredUsername: string
  ) {}

  static fromUsernameAndHostname(username: string, hostname: string): UserData {
    const atIndex = username.indexOf("@");
    const preferredUsername = atIndex > 0 ? username.slice(0, atIndex) : username;
    const email = atIndex > 0 ? username.replaceAll(" ", "+") : `${username.replaceAll(" ", "+")}@${hostname}`;
    const name = extractName(preferredUsername);
    return new UserData(username, name.givenName, name.familyName, email, preferredUsername);
  }

  getSubject(): string {
    return this.subject;
  }

  getGivenName(): string | undefined {
    return this.givenName;
  }

  getFamilyName(): string {
    return this.familyName;
  }

  getEmail(): string {
    return this.email;
  }

  getPreferredUsername(): string {
    return this.preferredUsername;
  }

  getName(): string {
    return this.givenName === undefined ? this.familyName : `${this.givenName} ${this.familyName}`;
  }
}

export class SessionRequest {
  constructor(
    readonly clientId: string,
    readonly sessionId: string,
    readonly responseType: string,
    readonly redirectUri: string,
    readonly state: string | undefined,
    readonly responseMode: string | undefined,
    readonly nonce: string | undefined
  ) {}

  toSession(userData: UserData, roles: readonly string[]): PersistentSession {
    return new PersistentSession(this, userData, roles);
  }
}

export class PersistentSession implements Session {
  private readonly roles: readonly string[];

  constructor(
    private readonly request: SessionRequest,
    private readonly userData: UserData,
    roles: readonly string[]
  ) {
    this.roles = [...roles];
  }

  getClientId(): string {
    return this.request.clientId;
  }

  getSessionId(): string {
    return this.request.sessionId;
  }

  getUserData(): UserData {
    return this.userData;
  }

  getRoles(): readonly string[] {
    return [...this.roles];
  }

  getState(): string | undefined {
    return this.request.state;
  }

  getRedirectUri(): string {
    return this.request.redirectUri;
  }

  getResponseType(): string {
    return this.request.responseType;
  }

  getResponseMode(): string | undefined {
    return this.request.responseMode;
  }

  getNonce(): string | undefined {
    return this.request.nonce;
  }
}

export class AdHocSession implements Session {
  private readonly sessionId = randomUUID();
  private readonly roles: readonly string[];

  private constructor(
    private readonly userData: UserData,
    roles: readonly string[],
    private readonly clientId: string
  ) {
    this.roles = [...roles];
  }

  static fromClientIdUsernameAndPassword(clientId: string, hostname: string, username: string, password?: string | null): AdHocSession {
    const roles = password == null ? [] : password.split(",");
    return new AdHocSession(UserData.fromUsernameAndHostname(username, hostname), roles, clientId);
  }

  getUserData(): UserData {
    return this.userData;
  }

  getRoles(): readonly string[] {
    return [...this.roles];
  }

  getClientId(): string {
    return this.clientId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getNonce(): string | undefined {
    return undefined;
  }
}

export class SessionRepository {
  private readonly sessions = new Map<string, { request?: SessionRequest; session?: PersistentSession }>();

  getSession(sessionId: string | undefined | null): PersistentSession | undefined {
    return sessionId == null ? undefined : this.sessions.get(sessionId)?.session;
  }

  updateSession(oldSession: PersistentSession, newSession: PersistentSession): void {
    const current = this.sessions.get(newSession.getSessionId())?.session;
    if (current !== oldSession) {
      throw new Error(`Unable to re-use existing session, it was updated in the meantime. Session ID: ${newSession.getSessionId()}`);
    }
    this.sessions.set(newSession.getSessionId(), { session: newSession });
  }

  upgradeRequest(existingRequest: SessionRequest, newSession: PersistentSession): void {
    const current = this.sessions.get(newSession.getSessionId())?.request;
    if (current !== existingRequest) {
      throw new Error(`Unable to create session from request, it was updated in the meantime. Session ID: ${newSession.getSessionId()}`);
    }
    this.sessions.set(newSession.getSessionId(), { session: newSession });
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getRequest(sessionId: string | undefined | null): SessionRequest | undefined {
    return sessionId == null ? undefined : this.sessions.get(sessionId)?.request;
  }

  putRequest(request: SessionRequest): void {
    if (this.sessions.has(request.sessionId)) {
      throw new Error(`Unable to create session request, session ID is already in use: ${request.sessionId}`);
    }
    this.sessions.set(request.sessionId, { request });
  }
}

function extractName(input: string): { givenName?: string; familyName: string } {
  const names = input
    .split(/[._ ]/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`);
  if (names.length === 0) {
    return { familyName: input };
  }
  if (names.length === 1) {
    return { familyName: names[0] as string };
  }
  const familyName = names.at(-1) as string;
  return { givenName: names.slice(0, -1).join(" "), familyName };
}
