import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const CHUNK_SIZE = 16384; // 16KB

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
  const recvState = useRef(new Map());   // peerId → { chunks, size, meta }
  const pendingSend = useRef(new Map()); // peerId → File
  const activeSendPeer = useRef(null);

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
    recvState.current.delete(peerId);
    pendingSend.current.delete(peerId);
    removePeerFromRadar(peerId);
  }, [removePeerFromRadar]);

  /* ── Send file binary data over DataChannel ── */
  const sendFileData = useCallback((peerId, file) => {
    const channel = dataChans.current.get(peerId);
    if (!channel || channel.readyState !== 'open') return;

    channel.send(JSON.stringify({
      type: 'file-meta', name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream',
    }));

    let offset = 0;
    const reader = new FileReader();

    reader.onload = (e) => {
      channel.send(e.target.result);
      offset += e.target.result.byteLength;
      const percent = Math.round((offset / file.size) * 100);
      setSendProgress({ percent, sent: offset, total: file.size });

      if (offset < file.size) {
        if (channel.bufferedAmount > CHUNK_SIZE * 8) {
          setTimeout(readSlice, 50);
        } else {
          readSlice();
        }
      } else {
        setSendProgress({ percent: 100, sent: file.size, total: file.size, done: true });
        pendingSend.current.delete(peerId);
      }
    };

    const readSlice = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    setSendProgress({ percent: 0, sent: 0, total: file.size });
    readSlice();
  }, []);

  /* ── Data Channel message handler ─────────── */
  const handleDCMessage = useCallback((peerId, e) => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);

      if (msg.type === 'file-offer') {
        setIncomingFile({ peerId, name: msg.name, size: msg.size, mime: msg.mime });
        return;
      }
      if (msg.type === 'file-accepted') {
        const file = pendingSend.current.get(peerId);
        if (file) sendFileData(peerId, file);
        return;
      }
      if (msg.type === 'file-declined') {
        pendingSend.current.delete(peerId);
        setSendProgress(null);
        return;
      }
      if (msg.type === 'file-meta') {
        recvState.current.set(peerId, { chunks: [], size: 0, meta: msg });
        setReceiveProgress({ percent: 0, received: 0, total: msg.size });
        return;
      }
      return;
    }

    // Binary chunk
    const state = recvState.current.get(peerId);
    if (!state) return;
    state.chunks.push(e.data);
    state.size += e.data.byteLength;
    const total = state.meta.size;
    const percent = Math.round((state.size / total) * 100);
    setReceiveProgress({ percent, received: state.size, total });

    if (state.size >= total) {
      const blob = new Blob(state.chunks, { type: state.meta.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.meta.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setReceiveProgress({ percent: 100, received: total, total, done: true });
      recvState.current.delete(peerId);
      setTimeout(() => setReceiveProgress(null), 5000);
    }
  }, [sendFileData]);

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
    // Disconnect existing socket first
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
          // Initiate WebRTC connection if my ID is smaller
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

  /* ── Send file API ──────────────────────────────── */
  const sendFile = useCallback((peerId, file) => {
    const channel = dataChans.current.get(peerId);
    if (!channel || channel.readyState !== 'open') return;

    channel.send(JSON.stringify({
      type: 'file-offer', name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream',
    }));

    pendingSend.current.set(peerId, file);
    activeSendPeer.current = peerId;
    setSendProgress({ percent: 0, sent: 0, total: file.size, waiting: true });
  }, []);

  const acceptIncomingFile = useCallback(() => {
    if (!incomingFile) return;
    const channel = dataChans.current.get(incomingFile.peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'file-accepted' }));
    }
    setIncomingFile(null);
  }, [incomingFile]);

  const declineIncomingFile = useCallback(() => {
    if (!incomingFile) return;
    const channel = dataChans.current.get(incomingFile.peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'file-declined' }));
    }
    setIncomingFile(null);
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
    sendFile,
    acceptIncomingFile,
    declineIncomingFile,
    setSendProgress,
    setReceiveProgress,
    connectToRoom,
    disconnectFromRoom,
  };
}
