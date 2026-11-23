function formatIsoDate(match) {
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() !== Number(month) - 1
      || date.getUTCDate() !== Number(day)) return match[0];
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatSlashDate(match) {
  const [, day, month, year] = match;
  return formatIsoDate([match[0], year, month, day]);
}

export function normalizeSpeechText(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1")
    .replace(/https?:\/\/\S+/gi, " enlace web ")
    .replace(/\bEE\.?\s*UU\.?\b/gi, "Estados Unidos")
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (...match) => formatIsoDate(match))
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (...match) => formatSlashDate(match))
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, hour, minute) => (
      minute === "00" ? `${hour} horas` : `${hour} horas ${minute}`
    ))
    .replace(/(\d[\d.,]*)\s*(?:°\s*C|º\s*C|grados? Celsius)\b/gi, "$1 grados Celsius")
    .replace(/(\d[\d.,]*)\s*km\/h\b/gi, "$1 kilómetros por hora")
    .replace(/(\d[\d.,]*)\s*mm\b/gi, "$1 milímetros")
    .replace(/(\d[\d.,]*)\s*km\b/gi, "$1 kilómetros")
    .replace(/(\d[\d.,]*)\s*%/g, "$1 por ciento")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\*/g, "")
    .replace(/[`_~#>|]/g, " ")
    .replace(/&/g, " y ")
    .replace(/\s*\/\s*/g, " o ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSpeechText(value, maxCharacters = 240) {
  const text = normalizeSpeechText(value);
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [text];
  const chunks = [];
  let current = "";

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (sentence.length > maxCharacters) {
      if (current) chunks.push(current.trim());
      current = "";
      let remainder = sentence;
      while (remainder.length > maxCharacters) {
        let splitAt = remainder.lastIndexOf(" ", maxCharacters);
        if (splitAt < maxCharacters * 0.55) splitAt = maxCharacters;
        chunks.push(remainder.slice(0, splitAt).trim());
        remainder = remainder.slice(splitAt).trim();
      }
      current = remainder;
      continue;
    }
    if (current && `${current} ${sentence}`.length > maxCharacters) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
