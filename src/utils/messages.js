function extractPointsFromMessage(message) {
  if (!message.webhookId || !message.embeds?.length) return null;
  const description = message.embeds[0].description || message.embeds[0].title || '';
  const m1 = description.match(/\(([^)]+?) ha conseguido ([\d,.]+) puntos[^)]*\)/si);
  const m2 = description.match(/^[^(\n]*?!\s*([^\n(]+?) ha conseguido ([\d,.]+) puntos/sim);
  const m = m1 || m2;
  if (!m) return null;
  const puntos = parseInt(m[2].replace(/[.,]/g, ''));
  if (isNaN(puntos)) return null;
  return { usuario: m[1].trim(), puntos };
}

async function fetchMessagesAfter(channel, afterId, limit = 5000) {
  let messages = [], currentId = afterId;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: currentId });
    if (!batch.size) break;
    batch.forEach(m => messages.push(m));
    currentId = batch.last().id;
    if (messages.length >= limit) { console.warn('[FETCH] Límite alcanzado'); break; }
    await new Promise(r => setTimeout(r, 300));
  }
  return messages.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

async function fetchMessagesBetween(channel, startId, endId) {
  let messages = [], lastId = startId;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastId });
    if (!batch.size) break;
    let done = false;
    batch.forEach(m => {
      if (BigInt(m.id) <= BigInt(endId)) messages.push(m);
      else done = true;
    });
    lastId = batch.first().id;
    if (done) break;
    if (messages.length > 10000) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return messages;
}

module.exports = { extractPointsFromMessage, fetchMessagesAfter, fetchMessagesBetween };
