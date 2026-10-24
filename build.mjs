import {build} from 'vite';
import fs from 'node:fs';
await build();
let html=fs.readFileSync('dist/source.html','utf8');
html=html.replace(/<link rel="icon"[^>]*>/,'<link rel="icon" href="./favicon.svg"/>');
// Hashed JS, CSS and artwork can be cached independently across visits.
// Keep the same relative asset paths for GitHub Pages and the Worker.
fs.cpSync('dist/assets','assets',{recursive:true});
fs.writeFileSync('index.html',html);
fs.writeFileSync('dist/index.html',html);
for(const file of ['config.js','favicon.svg'])fs.copyFileSync(file,'dist/'+file);
console.log('GitHub Pages index.html and Cloudflare dist prepared.');

