import { durationLabel } from './workout-history';
export function createWorkoutSummaryImage(summary: {name:string;date:string;durationSeconds:number;sets:number;plannedSets:number;volume:number;calories:number;delta:number|null}): string {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export unavailable');
    ctx.fillStyle = '#101014'; ctx.fillRect(0,0,1080,1350);
    const text = (value:string,x:number,y:number,size:number,color='#f5f5f7',weight=600) => { ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`; ctx.fillStyle=color; ctx.fillText(value,x,y); };
    text('FitTrack.',80,110,38); text('SESSION COMPLETE',80,220,20,'#64b5ff');
    let line = '', y = 306;
    ctx.font = '600 52px Arial';
    for (const char of summary.name) {
      if (ctx.measureText(line + char).width > 900) { text(line.trim(),80,y,52); y += 62; line = char; }
      else line += char;
    }
    text(line,80,y,52); y += 60;
    text(new Date(`${summary.date.slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),80,y,25,'#a1a1aa',400);
    const top = Math.max(520, y + 70);
    const cells = [ ['DURATION',durationLabel(summary.durationSeconds)],['SETS',`${summary.sets} / ${summary.plannedSets}`],['VOLUME',`${summary.volume.toLocaleString('en-US')} kg`],['EST. ENERGY',`${summary.calories} kcal`] ];
    cells.forEach(([label,value],i) => { const x = i % 2 ? 570 : 80; const row = top + Math.floor(i / 2) * 180; text(label,x,row,19,'#a1a1aa',500); text(value,x,row+66,44); });
    if (summary.delta !== null) text(`${summary.delta > 0 ? '+' : ''}${summary.delta.toLocaleString('en-US')} kg vs previous session`,80,top+380,25,'#64b5ff',500);
    text('One session at a time.',80,1260,26,'#a1a1aa',400);
    return canvas.toDataURL('image/png');
}
