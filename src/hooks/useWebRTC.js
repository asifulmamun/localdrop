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
  const [connectionState, setConnectionState] = useState('idle');
  const [offerString, setOfferString] = useState('');
  const [answerString, setAnswerString] = useState('');
  const [sendProgress, setSendProgress] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const fileMetaRef = useRef(null);
  const peerIdRef = useRef('');
  const pendingFileRef = useRef(null);
  const fileAcceptedRef = useRef(false);

  const cleanupPeer = useCallback((peerId) => {
    setPeers(prev => prev.filter(p => p.id !== peerId));
    dcRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setConnectionState('idle');
    setSendProgress(null);
    setReceiveProgress(null);
    setIncomingFile(null);
  }, []);

  const addPeer = useCallback((id) => {
    const angle = Math.random() * 2 * Math.PI;
    const ringIdx = Math.floor(Math.random() * 2) + 1;
    const radius = ringIdx === 1 ? 90 : 155;
    setPeers(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, angle, radius }];
    });
  }, []);

  const setupChannel = useCallback((channel) => {
    dcRef.current = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      setConnectionState('connected');
      addPeer(peerIdRef.current || 'Peer');
    };

    channel.onclose = () => {
      cleanupPeer(peerIdRef.current || 'Peer');
    };

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);

        if (msg.type === 'identify') {
          peerIdRef.current = msg.id;
          addPeer(msg.id);
          // reply with our id
          if (channel.readyState === 'open') {
            channel.send(JSON.stringify({ type: 'identify', id: myId }));
          }
          return;
        }

        if (msg.type === 'file-offer') {
          pendingFileRef.current = msg;
          fileAcceptedRef.current = false;
          setIncomingFile({ name: msg.name, size: msg.size, mime: msg.mime });
          return;
        }

        if (msg.type === 'file-accepted') {
          // Peer accepted, start sending
          const sendInfo = pendingFileRef.current;
          if (sendInfo) sendFileData(sendInfo.file);
          return;
        }

        if (msg.type === 'file-declined') {
          setSendProgress(null);
          pendingFileRef.current = null;
          return;
        }

        if (msg.type === 'file-meta') {
          fileMetaRef.current = msg;
          receivedChunksRef.current = [];
          receivedSizeRef.current = 0;
          setReceiveProgress({ percent: 0, received: 0, total: msg.size });
          return;
        }

        return;
      }

      // Binary data chunk
      receivedChunksRef.current.push(e.data);
      receivedSizeRef.current += e.data.byteLength;
      const total = fileMetaRef.current?.size || 1;
      const percent = Math.round((receivedSizeRef.current / total) * 100);
      setReceiveProgress({ percent, received: receivedSizeRef.current, total });

      if (receivedSizeRef.current >= total) {
        const blob = new Blob(receivedChunksRef.current, { type: fileMetaRef.current?.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileMetaRef.current?.name || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setReceiveProgress({ percent: 100, received: total, total, done: true });
        setIncomingFile(null);
        fileMetaRef.current = null;
        receivedChunksRef.current = [];
        receivedSizeRef.current = 0;
      }
    };
  }, [myId, addPeer, cleanupPeer]);

  const sendFileData = useCallback((file) => {
    const channel = dcRef.current;
    if (!channel || channel.readyState !== 'open') return;

    channel.send(JSON.stringify({
      type: 'file-meta',
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream'
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
      }
    };

    const readSlice = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    setSendProgress({ percent: 0, sent: 0, total: file.size });
    readSlice();
  }, []);

  const createOffer = useCallback(async () => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    const channel = pc.createDataChannel('fileDrop');
    setupChannel(channel);

    setConnectionState('creating-offer');

    return new Promise((resolve) => {
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          const encoded = btoa(JSON.stringify(pc.localDescription));
          setOfferString(encoded);
          setConnectionState('awaiting-answer');
          resolve(encoded);
        }
      };

      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  }, [setupChannel]);

  const acceptOffer = useCallback(async (offerStr) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    pc.ondatachannel = (e) => {
      setupChannel(e.channel);
      // Send identify after a brief delay to ensure channel is ready
      setTimeout(() => {
        if (e.channel.readyState === 'open') {
          e.channel.send(JSON.stringify({ type: 'identify', id: myId }));
        }
      }, 300);
    };

    setConnectionState('creating-answer');

    return new Promise((resolve) => {
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          const encoded = btoa(JSON.stringify(pc.localDescription));
          setAnswerString(encoded);
          setConnectionState('answer-ready');
          resolve(encoded);
        }
      };

      const offer = new RTCSessionDescription(JSON.parse(atob(offerStr)));
      pc.setRemoteDescription(offer).then(() => {
        pc.createAnswer().then(answer => pc.setLocalDescription(answer));
      });
    });
  }, [setupChannel, myId]);

  const completeConnection = useCallback(async (answerStr) => {
    if (!pcRef.current) return;
    setConnectionState('connecting');
    const answer = new RTCSessionDescription(JSON.parse(atob(answerStr)));
    await pcRef.current.setRemoteDescription(answer);

    // Send identify once channel opens
    const checkAndSend = () => {
      const dc = dcRef.current;
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'identify', id: myId }));
      } else {
        setTimeout(checkAndSend, 200);
      }
    };
    setTimeout(checkAndSend, 500);
  }, [myId]);

  const sendFile = useCallback((file) => {
    const channel = dcRef.current;
    if (!channel || channel.readyState !== 'open') return;

    channel.send(JSON.stringify({
      type: 'file-offer',
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream'
    }));

    pendingFileRef.current = { file };
    setSendProgress({ percent: 0, sent: 0, total: file.size, waiting: true });
  }, []);

  const acceptIncomingFile = useCallback(() => {
    const channel = dcRef.current;
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'file-accepted' }));
    }
    fileAcceptedRef.current = true;
    setIncomingFile(null);
  }, []);

  const declineIncomingFile = useCallback(() => {
    const channel = dcRef.current;
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'file-declined' }));
    }
    fileAcceptedRef.current = false;
    pendingFileRef.current = null;
    setIncomingFile(null);
  }, []);

  const isConnected = connectionState === 'connected';

  return {
    myId,
    peers,
    connectionState,
    offerString,
    answerString,
    sendProgress,
    receiveProgress,
    incomingFile,
    isConnected,
    createOffer,
    acceptOffer,
    completeConnection,
    sendFile,
    sendFileData,
    acceptIncomingFile,
    declineIncomingFile,
    setSendProgress,
    setReceiveProgress,
  };
}
