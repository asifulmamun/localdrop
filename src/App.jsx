import { useState, useEffect, useMemo } from 'react';
import './App.css';
import useWebRTC from './hooks/useWebRTC';
import {
  Icons,
  SendFileModal,
  IncomingFileToast,
  ReceiveProgressToast,
} from './components/Modals';

export default function App() {
  const rtc = useWebRTC();
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('filedrop-theme');
    if (saved) return saved === 'dark';
    return false; // default light
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('filedrop-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleSendFile = (file) => {
    if (selectedPeer) rtc.sendFile(selectedPeer.id, file);
  };

  const peerCount = rtc.peers.length;

  // Compute radar size based on nothing — CSS handles it via vmin
  // Peer positions use percentage-based placement
  const radarSize = 420; // reference size, CSS scales it

  return (
    <>
      {/* ── Navbar ─────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          {Icons.logo}
          <span>FileDrop</span>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setDark(d => !d)}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {dark ? Icons.sun : Icons.moon}
        </button>
      </nav>

      {/* ── Radar Area ─────────────────────── */}
      <div className="radar-wrapper">
        <div className="radar-container">
          <div className="radar-ring radar-ring-1" />
          <div className="radar-ring radar-ring-2" />
          <div className="radar-ring radar-ring-3" />
          {/* Radar sweep wave */}
          <div className="radar-sweep" />

          {/* Center "You" node */}
          <div className="center-node">
            <div className="center-avatar">
              <div className="pulse" />
              <div className="pulse" />
              {Icons.user}
            </div>
            <span className="center-label">You</span>
            <span className="center-id">{rtc.myId}</span>
          </div>

          {/* Peer nodes on radar */}
          {rtc.peers.map((peer) => {
            const cx = radarSize / 2;
            const cy = radarSize / 2;
            const x = cx + Math.cos(peer.angle) * peer.radius;
            const y = cy + Math.sin(peer.angle) * peer.radius;
            return (
              <div
                key={peer.id}
                className="peer-node"
                style={{ left: `${(x / radarSize) * 100}%`, top: `${(y / radarSize) * 100}%` }}
                onClick={() => setSelectedPeer(peer)}
                title={`Send file to ${peer.id}`}
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
        {peerCount > 0 ? (
          <span>{peerCount} peer{peerCount !== 1 ? 's' : ''} nearby — click to send</span>
        ) : (
          <span className="scanning">Looking for local peers…</span>
        )}
      </div>

      {/* ── Credit Footer ──────────────────── */}
      <footer className="credit-footer">
        Built by{' '}
        <a href="https://asifulmamun.info.bd" target="_blank" rel="noopener noreferrer">
          asifulmamun.info.bd
        </a>
      </footer>

      {/* ── Modals & Toasts ─────────────────── */}
      {selectedPeer && (
        <SendFileModal
          peer={selectedPeer}
          onClose={() => { setSelectedPeer(null); rtc.setSendProgress(null); }}
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
