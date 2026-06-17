const { contextBridge } = require('electron');

// Minimal, safe bridge. The renderer talks to the local backend over HTTP on
// the same origin, so no privileged APIs are exposed here yet.
contextBridge.exposeInMainWorld('arcanus', {
  isDesktop: true,
  platform: process.platform,
});
