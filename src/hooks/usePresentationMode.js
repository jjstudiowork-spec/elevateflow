/**
 * usePresentationMode.js
 * Manages Presentation Mode — host (WebSocket server) and client (WebSocket connection).
 * Host: broadcasts slide payloads to all connected clients via Tauri invoke.
 * Client: connects to host WebSocket, receives payloads and applies them to state.
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function usePresentationMode(state, dispatch) {
  const { isPresentationHost, isPresentationClient, presentationHostAddress } = state;
  const wsRef    = useRef(null);
  const [hostInfo, setHostInfo]   = useState(null); // { ip, port }
  const [clientStatus, setClientStatus] = useState('disconnected'); // disconnected | connecting | connected | error

  // ── HOST: listen for start/stop from menu ─────────────────────
  useEffect(() => {
    const unlisteners = [];

    listen('menu-presentation-start-hosting', async () => {
      try {
        const result = await invoke('presentation_start_hosting');
        dispatch({ type: 'SET_PRESENTATION_HOST', payload: true });
      } catch (e) { console.error('Failed to start hosting:', e); }
    }).then(f => unlisteners.push(f));

    listen('menu-presentation-stop-hosting', async () => {
      await invoke('presentation_stop_hosting').catch(() => {});
      dispatch({ type: 'SET_PRESENTATION_HOST', payload: false });
      setHostInfo(null);
    }).then(f => unlisteners.push(f));

    listen('presentation-hosting-started', (e) => {
      setHostInfo(e.payload);
    }).then(f => unlisteners.push(f));

    listen('menu-presentation-join-session', () => {
      dispatch({ type: 'SET_SHOW_JOIN_DIALOG', payload: true });
    }).then(f => unlisteners.push(f));

    return () => unlisteners.forEach(f => f());
  }, [dispatch]);

  // ── HOST: broadcast payload to all clients ────────────────────
  const broadcastToClients = useCallback(async (payload) => {
    if (!isPresentationHost) return;
    try {
      await invoke('presentation_broadcast', { payload: JSON.stringify(payload) });
    } catch {}
  }, [isPresentationHost]);

  // ── CLIENT: connect to host ───────────────────────────────────
  const connectToHost = useCallback((address) => {
    // address = "192.168.1.5:47823" or just "192.168.1.5"
    const addr = address.includes(':') ? address : `${address}:47823`;
    const url  = `ws://${addr}/ef-presentation`;

    setClientStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setClientStatus('connected');
      dispatch({ type: 'SET_PRESENTATION_CLIENT', payload: true });
      dispatch({ type: 'SET_PRESENTATION_HOST_ADDRESS', payload: addr });
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        // Apply exactly like audience-update does
        if (payload.type === 'audience-update') {
          dispatch({ type: 'APPLY_REMOTE_SLIDE', payload: payload.data });
        } else if (payload.type === 'audience-clear') {
          dispatch({ type: 'CLEAR_ALL_REMOTE' });
        }
      } catch {}
    };

    ws.onclose = () => {
      setClientStatus('disconnected');
      dispatch({ type: 'SET_PRESENTATION_CLIENT', payload: false });
    };

    ws.onerror = () => {
      setClientStatus('error');
    };
  }, [dispatch]);

  const disconnectFromHost = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    dispatch({ type: 'SET_PRESENTATION_CLIENT', payload: false });
    setClientStatus('disconnected');
  }, [dispatch]);

  return {
    hostInfo,
    clientStatus,
    broadcastToClients,
    connectToHost,
    disconnectFromHost,
  };
}