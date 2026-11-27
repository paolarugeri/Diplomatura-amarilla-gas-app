const {chromium}=require('playwright');const fs=require('fs');
const jobs=[['logo.svg','logo.png',1024],['logo-oscuro.svg','logo-blanco.png',1024],['isotipo.svg','isotipo.png',256],
['favicon.svg','favicon.png',64],['icono-completo.svg','icon-192.png',192],['icono-completo.svg','icon-512.png',512],
['icono-maskable.svg','icon-maskable-512.png',512],['icono-completo.svg','apple-touch-icon.png',180]];
(async()=>{const b=await chromium.launch();const p=await b.newPage();fs.mkdirSync('app/png',{recursive:true});
for(const [src,out,w] of jobs){const svg=fs.readFileSync('app/'+src,'utf8');const vb=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
const h=Math.round(w*vb[3]/vb[2]);await p.setViewportSize({width:w,height:h});
await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ',`<svg width="${w}" height="${h}" style="display:block" `)}</body></html>`);
await p.screenshot({path:'app/png/'+out,omitBackground:true,clip:{x:0,y:0,width:w,height:h}});}
await b.close();})();
