import {build} from 'vite';
import fs from 'node:fs';
await build();
let html=fs.readFileSync('dist/source.html','utf8');
html=html.replace(/<link rel="icon"[^>]*>/,'<link rel="icon" href="./favicon.svg"/>');
// Load ticket layout safeguards last, identically on Pages and the Worker.
html=html.replace('</head>','<link rel="stylesheet" href="./pos-layout-fix.css?v=20261025-1"/></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./pos-menu-overview.css?v=20261027-1"/><script defer src="./pos-menu-overview.js?v=20261026-7"></script></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./admin-space.css?v=20261026-3"/></head>');
// Hashed JS, CSS and artwork can be cached independently across visits.
// Keep the same relative asset paths for GitHub Pages and the Worker.
fs.cpSync('dist/assets','assets',{recursive:true});
fs.writeFileSync('index.html',html);
fs.writeFileSync('dist/index.html',html);
for(const file of ['config.js','favicon.svg','pos-layout-fix.css','pos-menu-overview.js','pos-menu-overview.css','admin-space.css'])fs.copyFileSync(file,'dist/'+file);
console.log('GitHub Pages index.html and Cloudflare dist prepared.');

