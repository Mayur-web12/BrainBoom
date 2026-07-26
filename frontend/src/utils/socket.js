import { io } from 'socket.io-client';

const URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// Singleton — one socket for the whole app
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

// Promise wrapper for socket emit with ack
export function emit(event, data) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    const timeout = setTimeout(() => reject(new Error('Socket timeout')), 8000);
    s.emit(event, data, (res) => {
      clearTimeout(timeout);
      if (res?.ok === false) reject(new Error(res.error || 'Socket error'));
      else resolve(res);
    });
  });
}
