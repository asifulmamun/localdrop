import { useState, useRef } from 'react';

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
