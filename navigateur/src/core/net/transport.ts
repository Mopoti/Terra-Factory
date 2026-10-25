/**
 * Transport : ce qui relie l'hôte à ses invités. Le jeu ne connaît que ces deux interfaces ; la liaison réelle
 * (WebRTC entre navigateurs) et celle des tests (en mémoire) les remplissent de la même façon.
 */
export interface Link {
  /** Envoie un message (un objet simple, qui passe par JSON). */
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** Côté hôte : attend des invités sur un code d'invitation. */
export interface HostEndpoint {
  readonly code: string;
  onConnection(cb: (link: Link) => void): void;
  close(): void;
}

export interface Network {
  /** Ouvre une partie : renvoie le code d'invitation (celui demandé, ou un nouveau). */
  host(code?: string): Promise<HostEndpoint>;
  /** Rejoint la partie dont on connaît le code. */
  join(code: string): Promise<Link>;
}

/** Code d'invitation à 6 caractères (sans les lettres qui se ressemblent). */
export function newInviteCode(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(random() * alphabet.length)];
  return code;
}

/** Normalise ce que le joueur tape : majuscules, sans espaces ni lien (le code est la dernière partie de l'adresse). */
export function parseInviteCode(input: string): string | null {
  const last =
    input
      .trim()
      .split(/[/?#=]/)
      .filter(Boolean)
      .pop() ?? '';
  const code = last.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-HJ-KM-NP-Z2-9]{6}$/.test(code) ? code : null;
}

// --- Transport en mémoire (tests) -------------------------------------------------------------

class MemoryLink implements Link {
  peer: MemoryLink | null = null;
  private messageCb: ((m: unknown) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private closed = false;

  send(msg: unknown): void {
    const peer = this.peer;
    if (this.closed || !peer) return;
    // Comme par le réseau : une copie, jamais le même objet.
    const copy = JSON.parse(JSON.stringify(msg)) as unknown;
    queueMicrotask(() => peer.messageCb?.(copy));
  }
  onMessage(cb: (m: unknown) => void): void {
    this.messageCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const peer = this.peer;
    this.peer = null;
    this.closeCb?.();
    if (peer) queueMicrotask(() => peer.close());
  }
}

/** Réseau factice : tout reste dans le même programme (pour les tests). */
export class MemoryNetwork implements Network {
  private readonly hosts = new Map<string, (link: Link) => void>();

  host(code = newInviteCode()): Promise<HostEndpoint> {
    let cb: ((link: Link) => void) | null = null;
    this.hosts.set(code, (link) => cb?.(link));
    const endpoint: HostEndpoint = {
      code,
      onConnection: (c) => {
        cb = c;
      },
      close: () => {
        this.hosts.delete(code);
      },
    };
    return Promise.resolve(endpoint);
  }

  join(code: string): Promise<Link> {
    const accept = this.hosts.get(code);
    if (!accept) return Promise.reject(new Error('unknown-code'));
    const guestSide = new MemoryLink();
    const hostSide = new MemoryLink();
    guestSide.peer = hostSide;
    hostSide.peer = guestSide;
    accept(hostSide);
    return Promise.resolve(guestSide);
  }
}
