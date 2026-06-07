import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const CHUNK_SIZE = 65536; // 64KB

export default function useWebRTC(onConnectionOpen) {
  const [myId, setMyId] = useState(() => {
    const saved = localStorage.getItem('filedrop_user_id');
    if (saved) return saved;
    const prefix = import.meta.env.VITE_APP_USER_ID_PREFIX || 'asif';
    let digits = '';
    for (let i = 0; i < 11; i++) {
      digits += Math.floor(Math.random() * 10);
    }
    const newId = `${prefix}-${digits}`;
    localStorage.setItem('filedrop_user_id', newId);
    return newId;
  });

  const [peers, setPeers] = useState([]);
  const [sendProgress, setSendProgress] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);

  // Refs for multi-peer management
  const wsRef = useRef(null);
  const peerConns = useRef(new Map());   // peerId → RTCPeerConnection
  const dataChans = useRef(new Map());   // peerId → RTCDataChannel

  // File Transfer Queue & States
  const sendQueueRef = useRef([]);       // Queue of { id, file, peerId }
  const activeSendFile = useRef(null);    // Active sending item
  const activeRecvFile = useRef(null);    // Active receiving state: { id, name, size, mimeType, chunks, receivedBytes }
  const sessionAcceptedRef = useRef(false); // Auto-accept flag for multi-file transfers in same session

  const addPeerToRadar = useCallback((id) => {
    const angle = Math.random() * 2 * Math.PI;
    const radius = [90, 130, 155][Math.floor(Math.random() * 3)];
    setPeers(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, angle, radius }];
    });
  }, []);

  const removePeerFromRadar = useCallback((id) => {
    setPeers(prev => prev.filter(p => p.id !== id));
  }, []);

  const cleanupPeer = useCallback((peerId) => {
    const pc = peerConns.current.get(peerId);
    if (pc) {
      pc.close();
      peerConns.current.delete(peerId);
    }
    dataChans.current.delete(peerId);
    removePeerFromRadar(peerId);
  }, [removePeerFromRadar]);

  /* ── Send file binary data over DataChannel with backpressure flow control ── */
  const sendFileChunks = useCallback(async (peerId, file, fileId) => {
    const channel = dataChans.current.get(peerId);
    if (!channel || channel.readyState !== 'open') return;

    channel.bufferedAmountLowThreshold = 262144; // 256KB

    const waitForBuffer = () => {
      return new Promise((resolve) => {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          resolve();
        };
      });
    };

    let offset = 0;
    const totalSize = file.size;
    const reader = new FileReader();

    while (offset < totalSize) {
      // Backpressure safety check (1MB threshold)
      if (channel.bufferedAmount > 1048576) {
        await waitForBuffer();
      }

      // Check if channel is still open
      if (channel.readyState !== 'open') {
        throw new Error('Data channel closed during transfer');
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const chunkData = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(chunk);
      });

      channel.send(chunkData);
      offset += chunkData.byteLength;

      const percent = Math.round((offset / totalSize) * 100);
      setSendProgress({
        fileId,
        name: file.name,
        percent,
        sent: offset,
        total: totalSize,
      });
    }
  }, []);

  /* ── Process next file in the send queue ── */
  const processNextSendQueueItem = useCallback(() => {
    if (sendQueueRef.current.length === 0) {
      activeSendFile.current = null;
      setSendProgress(null);
      return;
    }

    const nextItem = sendQueueRef.current[0];
    activeSendFile.current = nextItem;

    const { id, file, peerId } = nextItem;
    const channel = dataChans.current.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      sendQueueRef.current = [];
      activeSendFile.current = null;
      setSendProgress(null);
      return;
    }

    setSendProgress({
      fileId: id,
      name: file.name,
      percent: 0,
      sent: 0,
      total: file.size,
      waiting: true,
    });

    channel.send(JSON.stringify({
      type: 'file-start',
      id,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }));
  }, []);

  /* ── Data Channel message handler ─────────── */
  const handleDCMessage = useCallback((peerId, e) => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);

      if (msg.type === 'file-start') {
        const fileInfo = { id: msg.id, peerId, name: msg.name, size: msg.size, mimeType: msg.mimeType };
        // If session was already accepted, auto-accept subsequent files
        if (sessionAcceptedRef.current) {
          activeRecvFile.current = { ...fileInfo, chunks: [], receivedBytes: 0 };
          setReceiveProgress({ fileId: msg.id, name: msg.name, percent: 0, received: 0, total: msg.size });
          const channel = dataChans.current.get(peerId);
          if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify({ type: 'file-accepted', id: msg.id }));
          }
        } else {
          setIncomingFile(fileInfo);
        }
        return;
      }

      if (msg.type === 'file-accepted') {
        const activeItem = activeSendFile.current;
        if (activeItem && activeItem.id === msg.id) {
          sendFileChunks(activeItem.peerId, activeItem.file, activeItem.id)
            .catch(err => {
              console.error('File chunking failed:', err);
              sendQueueRef.current = sendQueueRef.current.filter(item => item.id !== msg.id);
              processNextSendQueueItem();
            });
        }
        return;
      }

      if (msg.type === 'file-declined') {
        sendQueueRef.current = [];
        activeSendFile.current = null;
        setSendProgress(null);
        return;
      }

      if (msg.type === 'file-ack') {
        const activeItem = activeSendFile.current;
        if (activeItem && activeItem.id === msg.id) {
          sendQueueRef.current.shift();
          if (sendQueueRef.current.length === 0) {
            setSendProgress(prev => prev ? { ...prev, percent: 100, done: true } : null);
            activeSendFile.current = null;
          } else {
            processNextSendQueueItem();
          }
        }
        return;
      }
      return;
    }

    // Binary chunk
    const state = activeRecvFile.current;
    if (!state) return;
    state.chunks.push(e.data);
    state.receivedBytes += e.data.byteLength;

    const percent = Math.round((state.receivedBytes / state.size) * 100);
    setReceiveProgress({
      fileId: state.id,
      name: state.name,
      percent,
      received: state.receivedBytes,
      total: state.size,
    });

    if (state.receivedBytes >= state.size) {
      const finalBlob = new Blob(state.chunks, { type: state.mimeType });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setReceiveProgress({
        fileId: state.id,
        name: state.name,
        percent: 100,
        received: state.size,
        total: state.size,
        done: true,
      });

      const channel = dataChans.current.get(peerId);
      if (channel && channel.readyState === 'open') {
        channel.send(JSON.stringify({ type: 'file-ack', id: state.id }));
      }

      activeRecvFile.current = null;
      setTimeout(() => setReceiveProgress(null), 3000);
    }
  }, [sendFileChunks, processNextSendQueueItem]);

  /* ── Setup a DataChannel (created or received) */
  const setupDC = useCallback((peerId, channel) => {
    channel.binaryType = 'arraybuffer';
    dataChans.current.set(peerId, channel);

    channel.onopen = () => {
      addPeerToRadar(peerId);
      if (onConnectionOpen) onConnectionOpen(peerId);
    };
    channel.onclose = () => {
      dataChans.current.delete(peerId);
      removePeerFromRadar(peerId);
    };
    channel.onmessage = (e) => handleDCMessage(peerId, e);
  }, [addPeerToRadar, removePeerFromRadar, handleDCMessage, onConnectionOpen]);

  /* ── Create a WebRTC connection TO a peer (we are the offerer) */
  const connectToPeer = useCallback((peerId) => {
    if (peerConns.current.has(peerId)) return;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current.set(peerId, pc);

    const dc = pc.createDataChannel('fileDrop');
    setupDC(peerId, dc);

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', to: peerId, candidate: e.candidate }));
      }
    };

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'offer', to: peerId, sdp: offer }));
      }
    });
  }, [setupDC]);

  /* ── Handle incoming offer FROM a peer ─────── */
  const handleOffer = useCallback(async (fromId, sdp) => {
    if (peerConns.current.has(fromId)) {
      peerConns.current.get(fromId).close();
      peerConns.current.delete(fromId);
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current.set(fromId, pc);

    pc.ondatachannel = (e) => setupDC(fromId, e.channel);

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', to: fromId, candidate: e.candidate }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'answer', to: fromId, sdp: answer }));
    }
  }, [setupDC]);

  /* ── Handle incoming answer ────────────────── */
  const handleAnswer = useCallback(async (fromId, sdp) => {
    const pc = peerConns.current.get(fromId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }, []);

  /* ── Handle ICE candidate ──────────────────── */
  const handleICE = useCallback(async (fromId, candidate) => {
    const pc = peerConns.current.get(fromId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    }
  }, []);

  /* ── Connect to a room pin via WebSocket ─────── */
  const connectToRoom = useCallback((pin) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/signaling?room=room-${pin}&peerId=${myId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'peer-joined') {
          if (myId < msg.id) {
            connectToPeer(msg.id);
          }
        }

        if (msg.type === 'peer-left') {
          cleanupPeer(msg.id);
        }

        if (msg.type === 'offer') {
          handleOffer(msg.from, msg.sdp);
        }

        if (msg.type === 'answer') {
          handleAnswer(msg.from, msg.sdp);
        }

        if (msg.type === 'ice-candidate') {
          handleICE(msg.from, msg.candidate);
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, [myId, connectToPeer, cleanupPeer, handleOffer, handleAnswer, handleICE]);

  /* ── Disconnect from room WebSocket ──────────── */
  const disconnectFromRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /* ── Cleanup on unmount ─────────────────────────── */
  useEffect(() => {
    const conns = peerConns.current;
    const chans = dataChans.current;
    return () => {
      disconnectFromRoom();
      for (const [, pc] of conns) pc.close();
      conns.clear();
      chans.clear();
    };
  }, [disconnectFromRoom]);

  /* ── Send multiple files API ────────────────────── */
  const sendFiles = useCallback((peerId, filesList) => {
    const channel = dataChans.current.get(peerId);
    if (!channel || channel.readyState !== 'open') return;

    const newQueueItems = Array.from(filesList).map(file => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      file,
      peerId,
    }));

    sendQueueRef.current = [...sendQueueRef.current, ...newQueueItems];

    if (!activeSendFile.current) {
      processNextSendQueueItem();
    }
  }, [processNextSendQueueItem]);


  const acceptIncomingFile = useCallback(() => {
    if (!incomingFile) return;
    const channel = dataChans.current.get(incomingFile.peerId);
    if (channel && channel.readyState === 'open') {
      sessionAcceptedRef.current = true; // Approve this multi-file session transfer
      activeRecvFile.current = { ...incomingFile, chunks: [], receivedBytes: 0 };
      setReceiveProgress({
        fileId: incomingFile.id,
        name: incomingFile.name,
        percent: 0,
        received: 0,
        total: incomingFile.size
      });
      channel.send(JSON.stringify({ type: 'file-accepted', id: incomingFile.id }));
    }
    setIncomingFile(null);
  }, [incomingFile]);

  const declineIncomingFile = useCallback(() => {
    if (!incomingFile) return;
    const channel = dataChans.current.get(incomingFile.peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'file-declined', id: incomingFile.id }));
    }
    setIncomingFile(null);
    sessionAcceptedRef.current = false;
  }, [incomingFile]);

  const hasPeers = peers.length > 0;

  return {
    myId,
    setMyId,
    peers,
    hasPeers,
    sendProgress,
    receiveProgress,
    incomingFile,
    sendFiles,
    acceptIncomingFile,
    declineIncomingFile,
    setSendProgress,
    setReceiveProgress,
    connectToRoom,
    disconnectFromRoom,
  };
}
