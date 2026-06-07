import { useState } from 'react';
import './App.css';
import useWebRTC from './hooks/useWebRTC';
import {
  Icons,
  ConnectModal,
  SendFileModal,
  IncomingFileToast,
  ReceiveProgressToast,
} from './components/Modals';

export default function App() {
  const rtc = useWebRTC();
  const [showConnect, setShowConnect] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null);

  const handlePeerClick = (peer) => {
    if (rtc.isConnected) setSelectedPeer(peer);
  };

  const handleSendFile = (file) => {
    rtc.sendFile(file);
  };

  const peerCount = rtc.peers.length;

  return (
    <>
      {/* ── Navbar ─────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          {Icons.logo}
          <span>FileDrop</span>
        </div>
        <div className="navbar-right">
          <span>Your ID</span>
          <span className="navbar-id">{rtc.myId}</span>
        </div>
      </nav>

      {/* ── Radar Area ─────────────────────── */}
      <div className="radar-wrapper">
        <div className="radar-container">
          <div className="radar-ring radar-ring-1" />
          <div className="radar-ring radar-ring-2" />
          <div className="radar-ring radar-ring-3" />
          <div className="radar-ring radar-ring-4" />

          {/* Center "You" node */}
          <div className="center-node">
            <div className="center-avatar">
              <div className="pulse" />
              <div className="pulse" />
              <div className="pulse" />
              {Icons.user}
            </div>
            <span className="center-label">You</span>
          </div>

          {/* Peer nodes on radar */}
          {rtc.peers.map((peer) => {
            const x = 210 + Math.cos(peer.angle) * peer.radius;
            const y = 210 + Math.sin(peer.angle) * peer.radius;
            return (
              <div
                key={peer.id}
                className="peer-node"
                style={{ left: x, top: y }}
                onClick={() => handlePeerClick(peer)}
                title={`Click to send file to ${peer.id}`}
              >
                <div className="peer-avatar">{Icons.device}</div>
                <span className="peer-name">{peer.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status Bar ─────────────────────── */}
      <div className="status-bar">
        {rtc.isConnected ? (
          <span>
            {peerCount} peer{peerCount !== 1 ? 's' : ''} nearby —{' '}
            <button className="link-btn" onClick={() => handlePeerClick(rtc.peers[0])}>
              click to send
            </button>
          </span>
        ) : (
          <span>
            Waiting for peers —{' '}
            <button className="link-btn" onClick={() => setShowConnect(true)}>
              connect a device
            </button>
          </span>
        )}
      </div>

      {/* ── FAB ─────────────────────────────── */}
      <button
        className="connect-fab"
        onClick={() => setShowConnect(true)}
        title="Connect a device"
      >
        {Icons.plus}
      </button>

      {/* ── Modals & Toasts ─────────────────── */}
      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onCreateOffer={rtc.createOffer}
          onAcceptOffer={rtc.acceptOffer}
          onCompleteConnection={(ans) => {
            rtc.completeConnection(ans);
            setTimeout(() => setShowConnect(false), 1000);
          }}
          offerString={rtc.offerString}
          answerString={rtc.answerString}
          connectionState={rtc.connectionState}
        />
      )}

      {selectedPeer && rtc.isConnected && (
        <SendFileModal
          peer={selectedPeer}
          onClose={() => {
            setSelectedPeer(null);
            rtc.setSendProgress(null);
          }}
          onSend={handleSendFile}
          sendProgress={rtc.sendProgress}
        />
      )}

      {rtc.incomingFile && (
        <IncomingFileToast
          file={rtc.incomingFile}
          onAccept={rtc.acceptIncomingFile}
          onDecline={rtc.declineIncomingFile}
        />
      )}

      <ReceiveProgressToast progress={rtc.receiveProgress} />
    </>
  );
}
