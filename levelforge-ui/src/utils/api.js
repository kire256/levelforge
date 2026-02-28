/**
 * Dynamic API base URL — always uses the same host as the frontend, port 8000.
 * This avoids hardcoding IPs that break when the server's address changes.
 */
export const API_BASE = `http://${window.location.hostname}:8000`
