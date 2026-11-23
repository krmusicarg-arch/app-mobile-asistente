import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpeechText, splitSpeechText } from "./speechText.js";

test("normalizes dates, weather units, links and symbols for Spanish speech", () => {
  const spoken = normalizeSpeechText(
    "El 2026-11-23 a las 14:00: 22 °C, 4 mm de lluvia y viento de 15 km/h. [Fuente](https://example.com)",
  );

  assert.match(spoken, /23 de noviembre de 2026/);
  assert.match(spoken, /14 horas/);
  assert.match(spoken, /22 grados Celsius/);
  assert.match(spoken, /4 milímetros/);
  assert.match(spoken, /15 kilómetros por hora/);
  assert.match(spoken, /Fuente/);
  assert.doesNotMatch(spoken, /https|\.com|\]\(/);
});

test("normalizes numeric dates, percentages, markdown and emoji", () => {
  const spoken = normalizeSpeechText("• **Listo**: 23/11/2026, humedad 70% 🌧️");

  assert.match(spoken, /23 de noviembre de 2026/);
  assert.match(spoken, /humedad 70 por ciento/);
  assert.match(spoken, /Listo/);
  assert.doesNotMatch(spoken, /\*|🌧/);
});

test("splits long answers into pronounceable sequential chunks", () => {
  const source = [
    "Primera idea con una pausa clara.",
    "Una explicación larga que conserva sus palabras y se corta por espacios sin dejar pedazos incompletos. ".repeat(5),
    "Cierre final.",
  ].join(" ");
  const chunks = splitSpeechText(source, 90);

  assert.ok(chunks.length > 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 90));
  assert.match(chunks[0], /Primera idea con una pausa clara\./);
  assert.match(chunks.at(-1), /Cierre final\./);
  assert.match(chunks.join(" "), /sin dejar pedazos incompletos/);
});
