const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const { fmtNum, formatDate } = require('../utils/format');

// Registrar fuente
try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../../Poppins-Bold.ttf'), 'Poppins');
  console.log('✅ Fuente Poppins registrada');
} catch (e) {
  console.warn('⚠️ No se pudo cargar Poppins:', e.message);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawMedal(ctx, x, y, rank) {
  const c = [null,
    { bg:'#B8860B44', br:'#FFD700', tx:'#FFD700' },
    { bg:'#66666644', br:'#C0C0C0', tx:'#C0C0C0' },
    { bg:'#7a3a0044', br:'#CD7F32', tx:'#CD7F32' }
  ][rank];
  ctx.fillStyle=c.bg; ctx.beginPath(); ctx.arc(x,y,18,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=c.br; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,18,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle=c.tx; ctx.font='700 16px "Poppins"'; ctx.textAlign='center';
  ctx.fillText(String(rank),x,y+6);
}

function drawTrophy(ctx, x, y, size, color) {
  ctx.fillStyle=color; ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x-size*0.4,y-size*0.5); ctx.lineTo(x+size*0.4,y-size*0.5);
  ctx.quadraticCurveTo(x+size*0.45,y,x,y+size*0.2);
  ctx.quadraticCurveTo(x-size*0.45,y,x-size*0.4,y-size*0.5); ctx.fill();
  ctx.fillRect(x-size*0.15,y+size*0.2,size*0.3,size*0.2);
  ctx.fillRect(x-size*0.3,y+size*0.38,size*0.6,size*0.1);
  ctx.beginPath(); ctx.arc(x-size*0.4,y-size*0.2,size*0.15,Math.PI*0.5,Math.PI*1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x+size*0.4,y-size*0.2,size*0.15,-Math.PI*0.5,Math.PI*0.5); ctx.stroke();
}

async function generarRankingCanvas({ usuarios, temporada, totalPuntos, guildIconURL }) {
  const W=900, H=740;
  const GOLD='#FFD700', GOLD_DIM='#D4AF37', GOLD_DARK='#8a6010';
  const SILVER='#C0C0C0', BRONZE='#CD7F32';
  const BG='#0a0a0a', LINE='#1e1a0a';
  const TEXT_DIM='#6a5a30', TEXT_MID='#a09060', TEXT_LIGHT='#c8b878';
  const MONO='DejaVu Sans Mono';

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fondo + grid
  ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(212,175,55,0.04)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='#2a2000'; ctx.lineWidth=2; roundRect(ctx,0,0,W,H,18,false,true);

  // Línea top dorada
  const topGrad=ctx.createLinearGradient(0,0,W,0);
  topGrad.addColorStop(0,'transparent'); topGrad.addColorStop(0.3,GOLD_DIM);
  topGrad.addColorStop(0.5,GOLD); topGrad.addColorStop(0.7,GOLD_DIM); topGrad.addColorStop(1,'transparent');
  ctx.strokeStyle=topGrad; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,1.5); ctx.lineTo(W,1.5); ctx.stroke();

  // Header
  const headerH=100, iconR=28, iconX=22, iconY=22;
  let guildIcon = null;
  if (guildIconURL) { try { guildIcon = await loadImage(guildIconURL); } catch(_){} }
  ctx.save();
  ctx.beginPath(); ctx.arc(iconX+iconR,iconY+iconR,iconR,0,Math.PI*2); ctx.clip();
  if (guildIcon) { ctx.drawImage(guildIcon,iconX,iconY,iconR*2,iconR*2); }
  else {
    const ig=ctx.createRadialGradient(iconX+iconR,iconY+iconR,0,iconX+iconR,iconY+iconR,iconR);
    ig.addColorStop(0,'#3a2a00'); ig.addColorStop(1,'#1a1200');
    ctx.fillStyle=ig; ctx.fillRect(iconX,iconY,iconR*2,iconR*2);
    ctx.fillStyle=GOLD; ctx.font='700 14px "Poppins"'; ctx.textAlign='center';
    ctx.fillText('CLAN',iconX+iconR,iconY+iconR+5);
  }
  ctx.restore();
  ctx.shadowColor='rgba(212,175,55,0.5)'; ctx.shadowBlur=14;
  ctx.strokeStyle=GOLD_DIM; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(iconX+iconR,iconY+iconR,iconR,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;

  const textX=iconX+iconR*2+18;
  ctx.textAlign='left';
  ctx.fillStyle=TEXT_DIM; ctx.font='700 12px "Poppins"'; ctx.fillText('TEMPORADA DE CLAN', textX, 40);
  ctx.fillStyle=GOLD; ctx.font='700 30px "Poppins"';
  ctx.shadowColor='rgba(255,215,0,0.25)'; ctx.shadowBlur=12;
  ctx.fillText(temporada, textX, 78); ctx.shadowBlur=0;
  ctx.shadowColor='rgba(255,215,0,0.4)'; ctx.shadowBlur=10;
  drawTrophy(ctx,W-50,55,38,GOLD); ctx.shadowBlur=0;
  ctx.strokeStyle=LINE; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(20,headerH); ctx.lineTo(W-20,headerH); ctx.stroke();

  // Strip total
  const stripY=headerH, stripH=46;
  const sg=ctx.createLinearGradient(0,stripY,W,stripY);
  sg.addColorStop(0,'#120e00'); sg.addColorStop(0.5,'#1c1600'); sg.addColorStop(1,'#120e00');
  ctx.fillStyle=sg; ctx.fillRect(0,stripY,W,stripH);
  ctx.fillStyle=TEXT_DIM; ctx.font='700 12px "Poppins"'; ctx.textAlign='left';
  ctx.fillText('TOTAL DEL CLAN',30,stripY+28);
  ctx.fillStyle=GOLD; ctx.font=`700 18px "${MONO}"`; ctx.textAlign='right';
  ctx.fillText(fmtNum(totalPuntos)+' pts',W-30,stripY+28);
  ctx.strokeStyle=LINE; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,stripY+stripH); ctx.lineTo(W,stripY+stripH); ctx.stroke();

  // Ranking
  const listStartY=stripY+stripH+8, rowH=54;
  const topPoints=usuarios[0]?.puntos||1;
  const nameColors=[GOLD,SILVER,BRONZE,TEXT_LIGHT,TEXT_LIGHT,TEXT_LIGHT,TEXT_MID,TEXT_MID,TEXT_MID,TEXT_MID];
  const ptsColors=[GOLD,SILVER,BRONZE,TEXT_MID,TEXT_MID,TEXT_MID,TEXT_DIM,TEXT_DIM,TEXT_DIM,TEXT_DIM];
  const accentColors=[GOLD,SILVER,BRONZE];
  const barGrads=[[GOLD_DARK,GOLD],['#707070',SILVER],['#8B4513',BRONZE]];
  const rowBgColors=[
    ['rgba(255,215,0,0.09)','transparent'],
    ['rgba(192,192,192,0.06)','transparent'],
    ['rgba(205,127,50,0.06)','transparent']
  ];

  usuarios.slice(0,10).forEach((row,i) => {
    const y=listStartY+i*rowH, isPodio=i<3;
    if(isPodio){
      const bg=ctx.createLinearGradient(20,y,W-20,y);
      bg.addColorStop(0,rowBgColors[i][0]); bg.addColorStop(1,rowBgColors[i][1]);
      ctx.fillStyle=bg; roundRect(ctx,20,y+2,W-40,rowH-4,8,true,false);
      ctx.fillStyle=accentColors[i];
      if(i===0){ctx.shadowColor='rgba(255,215,0,0.7)';ctx.shadowBlur=10;}
      ctx.fillRect(20,y+10,4,rowH-20); ctx.shadowBlur=0;
    }

    const posX=54;
    if(isPodio){ drawMedal(ctx,posX,y+rowH/2,i+1); }
    else{ ctx.fillStyle=TEXT_DIM; ctx.font='700 15px "Poppins"'; ctx.textAlign='center'; ctx.fillText(String(i+1),posX,y+rowH/2+5); }

    ctx.fillStyle=nameColors[i];
    ctx.font=(isPodio?'700 20px ':'600 17px ')+'\"Poppins\"';
    ctx.textAlign='left';
    let nombre=row.usuario;
    while(ctx.measureText(nombre).width>320&&nombre.length>3) nombre=nombre.slice(0,-1);
    if(nombre!==row.usuario) nombre+='…';
    ctx.fillText(nombre,84,y+rowH/2+7);

    ctx.fillStyle=ptsColors[i];
    ctx.font=(isPodio?'700 17px ':'600 15px ')+`"${MONO}"`;
    ctx.textAlign='right';
    ctx.fillText(fmtNum(row.puntos)+' pts',W-150,y+rowH/2+7);

    const barW=120,barH2=6,barX=W-136,barY=y+rowH/2-2,pct=row.puntos/topPoints;
    ctx.fillStyle='#1a1500'; roundRect(ctx,barX,barY,barW,barH2,3,true,false);
    const bf=ctx.createLinearGradient(barX,barY,barX+barW,barY);
    if(i<3){bf.addColorStop(0,barGrads[i][0]);bf.addColorStop(1,barGrads[i][1]);}
    else{bf.addColorStop(0,'#3a2e00');bf.addColorStop(1,GOLD_DARK);}
    ctx.fillStyle=bf;
    if(i===0){ctx.shadowColor='rgba(255,215,0,0.4)';ctx.shadowBlur=6;}
    roundRect(ctx,barX,barY,Math.max(barW*pct,6),barH2,3,true,false); ctx.shadowBlur=0;

    if(i===2){
      ctx.strokeStyle='#2a2000'; ctx.lineWidth=1; ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(28,y+rowH+2); ctx.lineTo(W-28,y+rowH+2); ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // Footer
  const footerY=H-32;
  ctx.strokeStyle=LINE; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(20,footerY); ctx.lineTo(W-20,footerY); ctx.stroke();
  ctx.fillStyle=TEXT_DIM; ctx.font='12px "Poppins"'; ctx.textAlign='left';
  ctx.fillText('Ranking · Actualizado '+formatDate(new Date()),28,footerY+20);
  [0,1,2].forEach((_,i)=>{
    ctx.fillStyle=i===0?GOLD_DIM:'#2a2010';
    ctx.beginPath(); ctx.arc(W-36+i*12,footerY+16,5,0,Math.PI*2); ctx.fill();
  });

  return canvas.toBuffer('image/png');
}

module.exports = { generarRankingCanvas };
