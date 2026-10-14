import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), {
  name: 'declic-offline',
  generateBundle(_, bundle) {
    const files=['./','./icon.svg','./icon-192.png','./icon-512.png','./icon-180.png','./manifest.webmanifest',...Object.keys(bundle).filter(name=>!name.endsWith('.map')).map(name=>'./'+name)];
    const version=Object.keys(bundle).join('|');
    this.emitFile({ type:'asset',fileName:'sw.js',source:`
const CACHE=${JSON.stringify('declic-'+version)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(${JSON.stringify(files)})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('declic-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();void caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./'):Response.error()))));});
` });
  }
}], base: './' });
