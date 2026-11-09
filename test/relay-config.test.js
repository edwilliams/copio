// SPDX-License-Identifier: AGPL-3.0
import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import {
  CopioEngine,
  HandoffSession,
  LoopbackTransport,
  COPIO_EVENTS,
} from '../sdk/index.js';

function wait(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CPO-092: Copio Relay Configuration, Forced-Relay & Diagnostics', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'relay-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
    LoopbackTransport.clearRegistry();
  });

  describe('SDK Configuration Properties on <copio-handoff>', () => {
    it('reflects relay-url, signaling-url, ice-servers, and ice-transport-policy attributes', () => {
      const el = document.createElement('copio-handoff');
      el.setAttribute('relay-url', 'https://relay.example.com');
      el.setAttribute('signaling-url', 'wss://signaling.example.com');
      el.setAttribute('ice-transport-policy', 'relay');
      el.setAttribute(
        'ice-servers',
        JSON.stringify([{ urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }])
      );
      fixtureContainer.appendChild(el);

      expect(el.relayUrl).to.equal('https://relay.example.com');
      expect(el.signalingUrl).to.equal('wss://signaling.example.com');
      expect(el.iceTransportPolicy).to.equal('relay');
      expect(el.iceServers).to.deep.equal([
        { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' },
      ]);
    });

    it('supports programmatic property setters on <copio-handoff>', () => {
      const el = document.createElement('copio-handoff');
      el.relayUrl = 'https://custom-relay.internal';
      el.signalingUrl = 'wss://custom-sig.internal';
      el.iceTransportPolicy = 'relay';
      el.iceServers = [{ urls: 'stun:stun.internal:3478' }];
      fixtureContainer.appendChild(el);

      expect(el.getAttribute('relay-url')).to.equal('https://custom-relay.internal');
      expect(el.getAttribute('signaling-url')).to.equal('wss://custom-sig.internal');
      expect(el.getAttribute('ice-transport-policy')).to.equal('relay');
      expect(el.iceServers).to.deep.equal([{ urls: 'stun:stun.internal:3478' }]);
    });
  });

  describe('Session Token Relay & ICE Server Propagation', () => {
    it('encodes relayUrl, signalingUrl, and iceServers into the optical QR session token', async () => {
      const el = document.createElement('copio-handoff');
      el.relayUrl = 'https://relay.copio.dev';
      el.signalingUrl = 'wss://relay.copio.dev/ws';
      el.iceServers = [{ urls: 'stun:stun.relay.copio.dev:3478' }];
      fixtureContainer.appendChild(el);

      await el.start();

      expect(el.token).to.exist;
      expect(el.token.relayUrl).to.equal('https://relay.copio.dev');
      expect(el.token.signalingUrl).to.equal('wss://relay.copio.dev/ws');
      expect(el.token.iceServers).to.deep.equal([{ urls: 'stun:stun.relay.copio.dev:3478' }]);

      // Verify encoded in URL query/fragment
      expect(el.url).to.include('#handoff=');
    });
  });

  describe('Connection Diagnostics Event (copio:connection-info)', () => {
    it('dispatches copio:connection-info with transport: "direct" on normal connection', async () => {
      const [hostTransport, senderTransport] = LoopbackTransport.createPair();

      const hostSession = new HandoffSession({
        role: 'host',
        transport: hostTransport,
      });

      const senderSession = new HandoffSession({
        role: 'sender',
        transport: senderTransport,
      });

      const el = document.createElement('copio-handoff');
      fixtureContainer.appendChild(el);

      let connectionInfoDetail = null;
      el.addEventListener(COPIO_EVENTS.CONNECTION_INFO, (e) => {
        connectionInfoDetail = e.detail;
      });

      const { token } = await hostSession.startHost();
      el.attachSession(hostSession, token);

      await senderSession.startSender(token);
      await wait(50);

      expect(connectionInfoDetail).to.exist;
      expect(connectionInfoDetail.transport).to.equal('direct');
      expect(typeof connectionInfoDetail.rttMs).to.equal('number');

      const info = await el.getConnectionInfo();
      expect(info.transport).to.equal('direct');
      expect(el.connectionInfo.transport).to.equal('direct');
    });

    it('succeeds forced-relay test (iceTransportPolicy: "relay") and emits transport: "turn"', async () => {
      const [hostTransport, senderTransport] = LoopbackTransport.createPair();
      hostTransport.forceRelay = true;
      hostTransport.iceTransportPolicy = 'relay';
      senderTransport.forceRelay = true;
      senderTransport.iceTransportPolicy = 'relay';

      const hostSession = new HandoffSession({
        role: 'host',
        transport: hostTransport,
      });

      const senderSession = new HandoffSession({
        role: 'sender',
        transport: senderTransport,
      });

      const el = document.createElement('copio-handoff');
      el.iceTransportPolicy = 'relay';
      fixtureContainer.appendChild(el);

      let turnConnectionDetail = null;
      el.addEventListener(COPIO_EVENTS.CONNECTION_INFO, (e) => {
        turnConnectionDetail = e.detail;
      });

      const { token } = await hostSession.startHost();
      el.attachSession(hostSession, token);

      await senderSession.startSender(token);
      await wait(50);

      expect(turnConnectionDetail).to.exist;
      expect(turnConnectionDetail.transport).to.equal('turn');
      expect(turnConnectionDetail.rttMs).to.be.greaterThan(0);

      const info = await el.getConnectionInfo();
      expect(info.transport).to.equal('turn');
      expect(el.connectionInfo.transport).to.equal('turn');
    });
  });

  describe('CopioEngine Relay & ICE Server Configuration', () => {
    it('accepts relayUrl, signalingUrl, iceServers, and iceTransportPolicy in constructor options', () => {
      const engine = new CopioEngine({
        relayUrl: 'https://relay.company.local',
        signalingUrl: 'wss://sig.company.local',
        iceTransportPolicy: 'relay',
        iceServers: [{ urls: 'turn:turn.company.local:3478' }],
      });

      expect(engine.relayUrl).to.equal('https://relay.company.local');
      expect(engine.signalingUrl).to.equal('wss://sig.company.local');
      expect(engine.iceTransportPolicy).to.equal('relay');
      expect(engine.iceServers).to.deep.equal([{ urls: 'turn:turn.company.local:3478' }]);

      engine.relayUrl = 'https://updated.relay';
      expect(engine.relayUrl).to.equal('https://updated.relay');
    });
  });

  describe('<copio-scanner> Relay Configuration & Diagnostics', () => {
    it('accepts relay attributes and getters/setters on <copio-scanner>', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('relay-url', 'https://scanner-relay.test');
      scanner.setAttribute('ice-transport-policy', 'relay');
      fixtureContainer.appendChild(scanner);

      expect(scanner.relayUrl).to.equal('https://scanner-relay.test');
      expect(scanner.iceTransportPolicy).to.equal('relay');

      scanner.relayUrl = 'https://new-relay.test';
      expect(scanner.getAttribute('relay-url')).to.equal('https://new-relay.test');
    });
  });
});
