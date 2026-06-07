import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const CHUNK_SIZE = 16384; // 16KB

function generateId() {
  const adj = ['swift','calm','bold','fair','keen','warm','cool','fast','neat','wise'];
  const noun = ['kite','wave','fern','leaf','star','moon','rain','hawk','pine','lake'];
  const num = Math.floor(Math.random() * 999);
  return `${adj[Math.floor(Math.random()*adj.length)]}-${noun[Math.floor(Math.random()*noun.length)]}-${num}`;
}

export default function useWebRTC() {
  const [myId] = useState(() => generateId());
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

  /* ── Helpers ──────────────────────────────── */
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

  const wsSend = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
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
      // Auto-clear the done toast after 5s
      setTimeout(() => setReceiveProgress(null), 5000);
    }
  }, []);

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

  /* ── Setup a DataChannel (created or received) */
  const setupDC = useCallback((peerId, channel) => {
    channel.binaryType = 'arraybuffer';
    dataChans.current.set(peerId, channel);

    channel.onopen = () => addPeerToRadar(peerId);
    channel.onclose = () => {
      dataChans.current.delete(peerId);
      removePeerFromRadar(peerId);
    };
    channel.onmessage = (e) => handleDCMessage(peerId, e);
  }, [addPeerToRadar, removePeerFromRadar, handleDCMessage]);

  /* ── Create a WebRTC connection TO a peer (we are the offerer) */
  const connectToPeer = useCallback((peerId) => {
    if (peerConns.current.has(peerId)) return; // already connecting/connected

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current.set(peerId, pc);

    const dc = pc.createDataChannel('fileDrop');
    setupDC(peerId, dc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsSend({ type: 'ice-candidate', to: peerId, candidate: e.candidate });
      }
    };

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      wsSend({ type: 'offer', to: peerId, sdp: offer });
    });
  }, [setupDC, wsSend]);

  /* ── Handle incoming offer FROM a peer ─────── */
  const handleOffer = useCallback(async (fromId, sdp) => {
    // If we already have a connection, clean it up first
    if (peerConns.current.has(fromId)) {
      peerConns.current.get(fromId).close();
      peerConns.current.delete(fromId);
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current.set(fromId, pc);

    pc.ondatachannel = (e) => setupDC(fromId, e.channel);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsSend({ type: 'ice-candidate', to: fromId, candidate: e.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsSend({ type: 'answer', to: fromId, sdp: answer });
  }, [setupDC, wsSend]);

  /* ── Handle incoming answer ────────────────── */
  const handleAnswer = useCallback(async (fromId, sdp) => {
    const pc = peerConns.current.get(fromId);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  /* ── Handle ICE candidate ──────────────────── */
  const handleICE = useCallback(async (fromId, candidate) => {
    const pc = peerConns.current.get(fromId);
    if (pc) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
    }
  }, []);

  /* ── Cleanup a peer fully ──────────────────── */
  const cleanupPeer = useCallback((peerId) => {
    const pc = peerConns.current.get(peerId);
    if (pc) { pc.close(); peerConns.current.delete(peerId); }
    dataChans.current.delete(peerId);
    recvState.current.delete(peerId);
    pendingSend.current.delete(peerId);
    removePeerFromRadar(peerId);
  }, [removePeerFromRadar]);

  /* ── WebSocket connection to signaling relay ── */
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/signaling`;
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', id: myId }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === 'peer-joined') {
            // We initiate the WebRTC connection to the new peer
            // Use lexicographic comparison to decide who offers (avoids double-offer)
            if (myId < msg.id) {
              connectToPeer(msg.id);
            }
            // If myId > msg.id, the other peer will send us an offer
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
          // ignore
        }
      };

      ws.onclose = () => {
        // Auto-reconnect after 2s
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
      // Cleanup all peer connections
      for (const [, pc] of peerConns.current) pc.close();
      peerConns.current.clear();
      dataChans.current.clear();
    };
  }, [myId, connectToPeer, handleOffer, handleAnswer, handleICE, cleanupPeer]);

  /* ── Public API ───────────────────────────── */
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
  };
}
