import { useState, useEffect } from 'react';
import './App.css';
import useWebRTC from './hooks/useWebRTC';
import {
  Icons,
  SendFileModal,
  IncomingFileToast,
  ReceiveProgressToast,
  ConnectDeviceModal,
} from './components/Modals';

export default function App() {
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const rtc = useWebRTC(() => {
    setIsConnectOpen(false);
  });
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('localdrop-theme');
    if (saved) return saved === 'dark';
    return false; // default light
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const parts = rtc.myId.split('-');
  const prefix = parts[0] || 'asif';
  const initialDigits = parts.slice(1).join('-');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('localdrop-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleSendFile = (files) => {
    if (selectedPeer) rtc.sendFiles(selectedPeer.id, files);
  };


  const handleSaveId = () => {
    setIsEditing(false);
    const cleaned = editValue.replace(/\D/g, '');
    if (cleaned.length > 0) {
      const newId = `${prefix}-${cleaned}`;
      rtc.setMyId(newId);
      localStorage.setItem('filedrop_user_id', newId);
    }
  };

  const peerCount = rtc.peers.length;
  const radarSize = 420; // reference size, CSS scales it

  return (
    <>
      {/* ── Navbar ─────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          {Icons.logo}
          <span>LocalDrop</span>
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
            <span className="center-id" style={{ cursor: isEditing ? 'default' : 'pointer' }}>
              {isEditing ? (
                <input
                  type="text"
                  className="center-id-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ''))}
                  onBlur={handleSaveId}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveId()}
                  autoFocus
                />
              ) : (
                <span
                  title="Click to edit 11-digit number"
                  onClick={() => {
                    setEditValue(initialDigits);
                    setIsEditing(true);
                  }}
                >
                  {prefix}-<span className="editable-digits">{initialDigits}</span>
                </span>
              )}
            </span>
            <button className="btn-connect-radar" onClick={() => setIsConnectOpen(true)}>
              {Icons.plus} Connect Device
            </button>
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
        <a href="https://asifulmamun.info.bd/cv" target="_blank" rel="noopener noreferrer">
          Latest: asifulmamun.info.bd/cv (Docs)
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

      {isConnectOpen && (
        <ConnectDeviceModal
          rtc={rtc}
          onClose={() => setIsConnectOpen(false)}
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
