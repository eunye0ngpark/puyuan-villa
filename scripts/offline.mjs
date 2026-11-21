// Run after vite build. Keep the module, styles and all model dependencies in
// a single page so that file:// works without CORS, installation or a server.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const html = await readFile(path.join(root,'index.html'),'utf8');
const packed={};
const types={'.hdr':'application/octet-stream','.json':'application/json','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
async function collect(dir){
  for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){
    const key=path.posix.join(dir,e.name);
    if(e.isDirectory()) await collect(key);
    else if(types[path.extname(key)])packed[key]='data:'+types[path.extname(key)]+';base64,'+(await readFile(path.join(root,key))).toString('base64');
  }
}
await collect('models');
await collect('textures');
await collect('hdri');
await collect('details');
await collect('garden');
const jsTag=html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*><\/script>/);
const cssTag=html.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/);
if(!jsTag||!cssTag)throw new Error('The production bundle is missing.');
const code=await readFile(path.join(root,jsTag[1]),'utf8');
const css=await readFile(path.join(root,cssTag[1]),'utf8');
const notices=await readFile(path.join(root,'THIRD-PARTY-NOTICES.txt'),'utf8');
const page=html.replace(jsTag[0],'').replace(cssTag[0],()=>'<style>'+css+'</style>')
  .replace('</body>',()=>'<script id="third-party-notices" type="text/plain">'+notices+'</script><script id="packed-assets" type="application/json">'+JSON.stringify(packed)+'</script>\n<script type="module">'+code.replace(/<\/script/gi,'<\\/script')+'</script></body>');
const output=process.argv[2]||path.join(root,'离线漫游.html');
await writeFile(output,page);
console.info('Wrote '+output+' ('+Object.keys(packed).length+' embedded assets).');
