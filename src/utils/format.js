function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.length ? parts.join(' ') : 'menos de 1m';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'
  }).format(date);
}

function fmtNum(n) {
  return Number(n).toLocaleString('es');
}

module.exports = { formatDuration, formatDate, fmtNum };
