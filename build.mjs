import {build} from 'vite';
import fs from 'node:fs';
await build();
let html=fs.readFileSync('dist/source.html','utf8');
html=html.replace(/<link rel="icon"[^>]*>/,'<link rel="icon" href="./favicon.svg"/>');
// Load ticket layout safeguards last, identically on Pages and the Worker.
html=html.replace('</head>','<link rel="preconnect" href="https://trainghiemdpa.thanson198.workers.dev" crossorigin/><link rel="dns-prefetch" href="https://trainghiemdpa.thanson198.workers.dev"/></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./pos-layout-fix.css?v=20261025-1"/></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./pos-menu-overview.css?v=20261028-rows2"/><script defer src="./pos-menu-overview.js?v=20261028-perf1"></script></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./admin-space.css?v=20261026-3"/></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./receipt-alignment.css?v=20261029-1"/></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./kitchen-print-layout.css?v=20261030-10"/><script defer src="./kitchen-print-layout.js?v=20261030-4"></script></head>');
html=html.replace('</head>','<script defer src="./booking-time-defaults.js?v=20261030-2"></script></head>');
html=html.replace('</head>','<link rel="stylesheet" href="./pos-ticket-edit.css?v=20261030-15"/><script defer src="./pos-ticket-edit.js?v=20261030-12"></script></head>');
// Hashed JS, CSS and artwork can be cached independently across visits.
// Keep the same relative asset paths for GitHub Pages and the Worker.
fs.cpSync('dist/assets','assets',{recursive:true});
fs.writeFileSync('index.html',html);
fs.writeFileSync('dist/index.html',html);
for(const file of ['bill-payment-qr.png','config.js','favicon.svg','pos-layout-fix.css','pos-menu-overview.js','pos-menu-overview.css','admin-space.css','receipt-alignment.css','kitchen-print-layout.css','kitchen-print-layout.js','booking-time-defaults.js','pos-ticket-edit.css','pos-ticket-edit.js'])fs.copyFileSync(file,'dist/'+file);
console.log('GitHub Pages index.html and Cloudflare dist prepared.');

