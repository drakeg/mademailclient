// Format conversion only. Uses macOS tools; no runtime/build dependency added.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') throw new Error('Icon regeneration requires macOS sips. Generated assets are committed for all platforms.');
const icons = fileURLToPath(new URL('../apps/desktop/icons/', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'mademail-icons-'));
const resize = (size, output) => execFileSync('sips', ['-z', String(size), String(size), join(icons,'source.png'), '--out', output], {stdio:'ignore'});
try {
  resize(1024, join(icons,'icon.png'));
  // ICNS PNG representations, including Retina resolutions.
  const chunks=[];
  for (const [type,size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]) {
    const path=join(temp,`${type}.png`); resize(size,path);
    const png=readFileSync(path); const chunk=Buffer.alloc(8);
    chunk.write(type,0,4,'ascii'); chunk.writeUInt32BE(png.length+8,4);
    chunks.push(chunk,png);
  }
  const icnsHeader=Buffer.alloc(8); icnsHeader.write('icns');
  icnsHeader.writeUInt32BE(8+chunks.reduce((sum,chunk)=>sum+chunk.length,0),4);
  writeFileSync(join(icons,'icon.icns'),Buffer.concat([icnsHeader,...chunks]));
  // Modern ICO files support PNG entries; preserve alpha at each resolution.
  const sizes = [16,24,32,48,64,128,256];
  const header = Buffer.alloc(6 + sizes.length*16);
  header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  let offset=header.length; const images=[];
  sizes.forEach((size,index)=>{
    const path=join(temp,`${size}.png`); resize(size,path);
    const png=readFileSync(path); const at=6+index*16;
    header[at]=size===256?0:size; header[at+1]=header[at];
    header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6);
    header.writeUInt32LE(png.length,at+8); header.writeUInt32LE(offset,at+12);
    offset+=png.length; images.push(png);
  });
  writeFileSync(join(icons,'icon.ico'),Buffer.concat([header,...images]));
} finally {rmSync(temp,{recursive:true,force:true});}
