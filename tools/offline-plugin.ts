import type { Plugin } from "vite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
export function offlinePlugin(): Plugin {
  let base = "/";
  return {
    name: "paper-offline",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    closeBundle() {
      const root = "dist";
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, e.name);
          if (e.isDirectory()) walk(path);
          else if (e.name !== "sw.js") files.push(path);
        }
      };
      walk(root);
      const hash = createHash("sha256");
      files.sort().forEach((f) => {
        hash.update(f);
        hash.update(readFileSync(f));
      });
      const version = hash.digest("hex").slice(0, 12);
      const urls = files.map(
        (f) =>
          base + relative(root, f).split("/").map(encodeURIComponent).join("/"),
      );
      writeFileSync(
        join(root, "sw.js"),
        `const CACHE='tinta-${version}';const FILES=${JSON.stringify(urls)};\nself.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(let i=0;i<FILES.length;i+=12)await cache.addAll(FILES.slice(i,i+12));})()));\nself.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('tinta-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){try{return await fetch(event.request);}catch{return await cache.match('${base}index.html');}}const cached=await cache.match(event.request,{ignoreVary:true});return cached||fetch(event.request);})());});\n`,
      );
    },
  };
}
