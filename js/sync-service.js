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
      const alert = Object.assign(document.createElement('sl-alert'), {
        variant: 'warning',
        closable: true,
        duration: 4000,
        innerHTML:
          '<sl-icon name="wifi-off" slot="icon"></sl-icon> An internet connection is needed to link devices.',
      });
      document.body.appendChild(alert);
      alert.toast();
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
        });
      });
      this.#peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.#setState({ ...this.#syncState, step: 'syncing' });
          this.#doSync(conn);
        });
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
        conn.on('open', () => {
          this.#setState({ ...this.#syncState, step: 'syncing' });
          this.#doSync(conn);
        });
      });
    } catch (err) {
      this.#setState({ mode: 'joiner', step: 'error', message: err.message });
    }
  }

  #doSync(conn) {
    conn.send(JSON.stringify(this.#store.getTable('docs')));
    conn.on('data', (raw) => {
      const rows = JSON.parse(raw);
      let added = 0;
      this.#store.transaction(() => {
        for (const [id, row] of Object.entries(rows)) {
          if (!this.#store.hasRow('docs', id)) added++;
          this.#store.setRow('docs', id, row);
        }
      });
      this.#setState({ ...this.#syncState, step: 'done', added });
    });
  }

  close() {
    this.#peer?.destroy();
    this.#peer = null;
    this.#setState(null);
  }
}
