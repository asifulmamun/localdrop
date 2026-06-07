/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';



/* ── SVG Icons ──────────────────────────────── */
export const Icons = {
  logo: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  device: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  file: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  sun: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  moon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  ),
};

/* ── Format file size ───────────────────────── */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}



/* ── Send File Modal ────────────────────────── */
export function SendFileModal({ peer, onClose, onSend, sendProgress }) {
  const [file, setFile] = useState(null);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const sending = sendProgress && !sendProgress.done && !sendProgress.waiting;
  const waiting = sendProgress?.waiting;
  const done = sendProgress?.done;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>{Icons.x}</button>
        <h2>Send to {peer.id}</h2>
        <p className="subtitle">Select a file to send directly to this device.</p>

        {!file && !sending && !done && (
          <div
            className={`drop-zone ${dragover ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={handleDrop}
          >
            <div className="drop-zone-icon">📁</div>
            <div className="drop-zone-text">Click or drag a file here</div>
            <div className="drop-zone-hint">Any file type supported</div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && setFile(e.target.files[0])} />
          </div>
        )}

        {file && !sending && !done && (
          <>
            <div className="file-selected">
              <div className="file-selected-icon">📄</div>
              <div className="file-selected-info">
                <div className="file-selected-name">{file.name}</div>
                <div className="file-selected-size">{formatSize(file.size)}</div>
              </div>
              <button className="file-selected-remove" onClick={() => setFile(null)}>{Icons.x}</button>
            </div>
            <button className="btn btn-primary" onClick={() => onSend(file)} disabled={waiting}>
              {waiting ? 'Waiting for acceptance...' : <>{Icons.send} Send File</>}
            </button>
          </>
        )}

        {(sending || waiting) && sendProgress && (
          <div className="progress-wrapper" style={{ marginTop: file ? 16 : 0 }}>
            {file && (
              <div className="file-selected" style={{ marginBottom: 16 }}>
                <div className="file-selected-icon">📄</div>
                <div className="file-selected-info">
                  <div className="file-selected-name">{file.name}</div>
                  <div className="file-selected-size">{formatSize(file.size)}</div>
                </div>
              </div>
            )}
            <div className="progress-header">
              <span>{waiting ? 'Waiting for peer...' : 'Sending...'}</span>
              <span>{sendProgress.percent}%</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${sendProgress.done ? 'done' : ''}`} style={{ width: `${sendProgress.percent}%` }} />
            </div>
          </div>
        )}

        {done && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>File Sent Successfully</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>The file has been delivered to {peer.id}</div>
            <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Incoming File Toast ────────────────────── */
export function IncomingFileToast({ file, onAccept, onDecline }) {
  return (
    <div className="toast-container">
      <div className="toast">
        <div className="toast-header">
          <div className="toast-icon">📥</div>
          <div className="toast-info">
            <div className="toast-title">Incoming File</div>
            <div className="toast-subtitle">{file.name} · {formatSize(file.size)}</div>
          </div>
        </div>
        <div className="toast-actions">
          <button className="btn btn-sm btn-danger" onClick={onDecline}>Decline</button>
          <button className="btn btn-sm btn-success" onClick={onAccept}>{Icons.check} Accept</button>
        </div>
      </div>
    </div>
  );
}

/* ── Receive Progress Toast ─────────────────── */
export function ReceiveProgressToast({ progress }) {
  if (!progress) return null;
  return (
    <div className="toast-container">
      <div className="toast">
        <div className="toast-header">
          <div className="toast-icon">{progress.done ? '✅' : '📥'}</div>
          <div className="toast-info">
            <div className="toast-title">{progress.done ? 'File Received' : 'Receiving File...'}</div>
            <div className="toast-subtitle">{formatSize(progress.received)} / {formatSize(progress.total)}</div>
          </div>
        </div>
        {!progress.done && (
          <div className="progress-wrapper" style={{ marginTop: 4 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Connect Device Modal ───────────────────── */
export function ConnectDeviceModal({ rtc, onClose }) {

  const [pin, setPin] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const qrCanvasRef = useRef(null);

  const generateRandomCode = () => {
    setError('');
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(code);
  };

  const handleConnect = (codeToUse) => {
    const finalCode = codeToUse || pin;
    if (!finalCode || finalCode.length < 4 || finalCode.length > 6) {
      setError('Please enter a valid 4 to 6-digit code.');
      return;
    }
    setError('');
    setIsConnecting(true);
    rtc.connectToRoom(finalCode);
  };

  const handleCancelConnection = () => {
    setIsConnecting(false);
    rtc.disconnectFromRoom();
  };

  // Generate QR Code dynamically
  useEffect(() => {
    if (pin && pin.length >= 4 && pin.length <= 6 && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        pin,
        {
          width: 150,
          margin: 2,
          color: {
            dark: '#1d1d1f',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('Failed to draw QR code:', err);
        }
      );
    }
  }, [pin]);

  // Scanner logic
  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      const checkEl = setInterval(() => {
        const el = document.getElementById('qr-reader');
        if (el) {
          clearInterval(checkEl);
          scanner = new Html5Qrcode('qr-reader');
          scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 150, height: 150 }
            },
            async (decodedText) => {
              setIsScanning(false);
              try {
                await scanner.stop();
              } catch (e) {
                console.error('Failed to stop scanner:', e);
              }
              const cleaned = decodedText.trim().replace(/\D/g, '');
              if (cleaned.length >= 4 && cleaned.length <= 6) {
                setPin(cleaned);
                handleConnect(cleaned);
              } else {
                setError('Scanned code is not a valid 4 to 6-digit code.');
              }
            },
            () => {
              // silent failure
            }
          ).catch((err) => {
            console.error('Camera capture start failed:', err);
            setError('Camera permission denied or camera not found.');
            setIsScanning(false);
          });
        }
      }, 50);

      return () => {
        clearInterval(checkEl);
        if (scanner) {
          if (scanner.isScanning) {
            scanner.stop().catch(err => console.error('Cleanup stop failed:', err));
          }
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const handleClose = () => {
    rtc.disconnectFromRoom();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <button className="modal-close" onClick={handleClose}>{Icons.x}</button>
        <h2>Connect Device</h2>
        <p className="subtitle">Enter a 4-6 digit Room Code or scan the QR code to connect devices.</p>

        {isConnecting ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="radar-sweep-loader" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Connecting to Room {pin}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Waiting for another device to enter the same code...
            </div>
            <button className="btn btn-secondary" onClick={handleCancelConnection}>Cancel</button>
          </div>
        ) : isScanning ? (
          <div className="tab-content">
            <div className="field-group">
              <label>Scan Room QR Code</label>
              <div id="qr-reader" className="scanner-viewport" />
              <button className="btn btn-secondary" onClick={() => setIsScanning(false)}>Cancel Scan</button>
            </div>
          </div>
        ) : (
          <div className="tab-content">
            <div className="field-group">
              <label htmlFor="room-pin-input">Room Code (4-6 digits)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="room-pin-input"
                  type="text"
                  pattern="\d*"
                  maxLength={6}
                  className="field-input"
                  placeholder="Enter 4-6 digit code"
                  value={pin}
                  onChange={(e) => {
                    setError('');
                    setPin(e.target.value.replace(/\D/g, ''));
                  }}
                />
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={generateRandomCode}
                >
                  Generate
                </button>
              </div>
            </div>

            {pin && pin.length >= 4 && pin.length <= 6 && (
              <div className="qr-block-wrapper">
                <div className="qr-canvas-holder">
                  <canvas ref={qrCanvasRef} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                  Scan this QR code from another device to sync
                </span>
              </div>
            )}

            {error && <div className="modal-error">{error}</div>}

            <div className="action-row" style={{ marginTop: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsScanning(true)}
                style={{ flex: 1 }}
              >
                📷 Scan Code
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleConnect()}
                disabled={pin.length < 4}
                style={{ flex: 1.5 }}
              >
                Connect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


