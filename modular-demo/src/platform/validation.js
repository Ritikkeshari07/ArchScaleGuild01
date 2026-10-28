function cleanText(value, label, max = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(`${label} is required (max ${max} characters).`);
  return text;
}
function number(value, label, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new Error(`${label} must be a number greater than or equal to ${min}.`);
  return n;
}
module.exports = { cleanText, number };
