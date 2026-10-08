import Peer, { type DataConnection } from 'peerjs';
import type { HostEndpoint, Link, Network } from '../core/net/transport';
import { newInviteCode } from '../core/net/transport';

/** Préfixe des identifiants sur le service de mise en relation (PeerJS) : le code d'invitation en est la fin. */
const PREFIX = 'terrafactory-v1-';
const OPEN_TIMEOUT_MS = 12000;

function wrap(conn: DataConnection): Link {
  let messageCb: ((m: unknown) => void) | null = null;
  let closeCb: (() => void) | null = null;
  conn.on('data', (data) => messageCb?.(data));
  conn.on('close', () => closeCb?.());
  conn.on('error', () => closeCb?.());
  return {
    send: (msg) => {
      if (conn.open) conn.send(msg);
    },
    onMessage: (cb) => {
      messageCb = cb;
    },
    onClose: (cb) => {
      closeCb = cb;
    },
    close: () => conn.close(),
  };
}

/** Réseau réel : WebRTC entre navigateurs, avec le service de mise en relation gratuit de PeerJS. */
export interface PeerServer {
  host: string;
  port: number;
  secure: boolean;
}

/** Service de mise en relation : celui de PeerJS par défaut ; `?peerServer=hôte:port` en choisit un autre (tests). */
export function peerServerFromUrl(): PeerServer | undefined {
  const q = new URLSearchParams(window.location.search).get('peerServer');
  const m = q?.match(/^([\w.-]+):(\d+)$/);
  return m ? { host: m[1], port: Number(m[2]), secure: false } : undefined;
}

export class PeerNetwork implements Network {
  constructor(private readonly server: PeerServer | undefined = peerServerFromUrl()) {}

  private config(): { host?: string; port?: number; secure?: boolean; path?: string } {
    return this.server ? { ...this.server, path: '/' } : {};
  }

  host(code = newInviteCode()): Promise<HostEndpoint> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(PREFIX + code, this.config());
      let connectionCb: ((link: Link) => void) | null = null;
      const timer = window.setTimeout(() => {
        peer.destroy();
        reject(new Error('timeout'));
      }, OPEN_TIMEOUT_MS);
      peer.on('open', () => {
        window.clearTimeout(timer);
        resolve({
          code,
          onConnection: (cb) => {
            connectionCb = cb;
          },
          close: () => peer.destroy(),
        });
      });
      peer.on('connection', (conn) => {
        // On ne passe le lien à l'hôte qu'une fois la connexion ouverte (sinon l'envoi serait perdu).
        conn.on('open', () => connectionCb?.(wrap(conn)));
      });
      peer.on('error', (err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    });
  }

  join(code: string): Promise<Link> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(this.config());
      const fail = (e: unknown): void => {
        window.clearTimeout(timer);
        peer.destroy();
        reject(e instanceof Error ? e : new Error(String(e)));
      };
      const timer = window.setTimeout(() => fail(new Error('timeout')), OPEN_TIMEOUT_MS);
      peer.on('error', fail);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          window.clearTimeout(timer);
          const link = wrap(conn);
          const close = link.close;
          link.close = () => {
            close();
            peer.destroy();
          };
          resolve(link);
        });
        conn.on('error', fail);
      });
    });
  }
}
