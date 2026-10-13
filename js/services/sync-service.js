import { notify } from './notify.js';

/**
 * Handles PeerJS peer-to-peer sync between host and joiner devices for TinyBase store.
 */
export class SyncManager {
  #peer = null;
  #store = null;
  #onStateChange = null;
  #syncState = null;

  constructor(store, onStateChange) {
    this.#store = store;
    this.#onStateChange = onStateChange;
  }

  get state() {
    return this.#syncState;
  }

  #setState(newState) {
    this.#syncState = newState;
    if (this.#onStateChange) {
      this.#onStateChange(this.#syncState);
    }
  }

  startHost() {
    if (this.#peer && this.#syncState?.mode === 'host') return;

    if (!navigator.onLine) {
      notify.warning('An internet connection is needed to link devices.', {
        icon: 'wifi-off',
        duration: 4000,
      });
      return;
    }

    this.#setState({ mode: 'host', step: 'init' });
    try {
      this.#peer = new Peer();
      this.#peer.on('error', (err) => {
        this.#setState({
          ...this.#syncState,
          step: 'error',
          message: err.message,
        });
      });
      this.#peer.on('open', (id) => {
        const url = `${location.origin}${location.pathname}?peer=${id}`;
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        this.#setState({
          mode: 'host',
          step: 'waiting',
          qrSvg: qr.createSvgTag(4, 8),
          url,
          peerId: id,
        });
      });
      this.#peer.on('connection', (conn) => {
        conn.on('error', (err) => {
          this.#setState({
            ...this.#syncState,
            step: 'error',
            message: err.message,
          });
        });
        const setupConn = () => {
          this.#setState({ ...this.#syncState, step: 'syncing' });
          this.#doSync(conn);
        };
        if (conn.open) {
          setupConn();
        } else {
          conn.on('open', setupConn);
        }
      });
    } catch (err) {
      this.#setState({ mode: 'host', step: 'error', message: err.message });
    }
  }

  startJoiner(remotePeerId) {
    if (this.#peer && this.#syncState?.mode === 'joiner') return;

    this.#setState({ mode: 'joiner', step: 'connecting' });
    try {
      this.#peer = new Peer();
      this.#peer.on('error', (err) => {
        this.#setState({
          ...this.#syncState,
          step: 'error',
          message: err.message,
        });
      });
      this.#peer.on('open', () => {
        const conn = this.#peer.connect(remotePeerId);
        conn.on('error', (err) => {
          this.#setState({
            ...this.#syncState,
            step: 'error',
            message: err.message,
          });
        });
        const setupConn = () => {
          this.#setState({ ...this.#syncState, step: 'syncing' });
          this.#doSync(conn);
        };
        if (conn.open) {
          setupConn();
        } else {
          conn.on('open', setupConn);
        }
      });
    } catch (err) {
      this.#setState({ mode: 'joiner', step: 'error', message: err.message });
    }
  }

  #doSync(conn) {
    conn.on('data', (raw) => {
      let rows;
      try {
        rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (err) {
        console.error('Failed to parse sync data:', err);
        return;
      }
      let added = 0;
      this.#store.transaction(() => {
        for (const [id, row] of Object.entries(rows || {})) {
          if (!this.#store.hasRow('docs', id)) added++;
          this.#store.setRow('docs', id, row);
        }
      });
      this.#setState({ ...this.#syncState, step: 'done', added });
      notify.success(`Sync complete — ${added} doc${added !== 1 ? 's' : ''} added`);
    });

    try {
      conn.send(JSON.stringify(this.#store.getTable('docs')));
    } catch (err) {
      console.error('Failed to send sync data:', err);
      this.#setState({ ...this.#syncState, step: 'error', message: err.message });
    }
  }

  close() {
    this.#peer?.destroy();
    this.#peer = null;
    this.#setState(null);
  }
}
