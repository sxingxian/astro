import type { Card, Element } from "./types";

const numerals = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

const data: Array<[string, Element, [string, string, string]]> = [
  ["The Fool", "air", ["Beginnings", "Trust", "Leap"]],
  ["The Magician", "air", ["Skill", "Focus", "Willpower"]],
  ["The High Priestess", "water", ["Intuition", "Stillness", "Mystery"]],
  ["The Empress", "earth", ["Abundance", "Nurture", "Creation"]],
  ["The Emperor", "fire", ["Structure", "Authority", "Stability"]],
  ["The Hierophant", "earth", ["Tradition", "Learning", "Belonging"]],
  ["The Lovers", "air", ["Union", "Choice", "Values"]],
  ["The Chariot", "water", ["Drive", "Direction", "Resolve"]],
  ["Strength", "fire", ["Courage", "Patience", "Gentleness"]],
  ["The Hermit", "earth", ["Solitude", "Insight", "Guidance"]],
  ["Wheel of Fortune", "fire", ["Cycles", "Change", "Timing"]],
  ["Justice", "air", ["Fairness", "Truth", "Accountability"]],
  ["The Hanged Man", "water", ["Pause", "Surrender", "Perspective"]],
  ["Death", "water", ["Endings", "Release", "Renewal"]],
  ["Temperance", "fire", ["Balance", "Moderation", "Healing"]],
  ["The Devil", "earth", ["Attachment", "Temptation", "Shadow"]],
  ["The Tower", "fire", ["Upheaval", "Revelation", "Breakthrough"]],
  ["The Star", "air", ["Hope", "Renewal", "Guidance"]],
  ["The Moon", "water", ["Dreams", "Uncertainty", "Instinct"]],
  ["The Sun", "fire", ["Joy", "Clarity", "Vitality"]],
  ["Judgement", "fire", ["Awakening", "Reckoning", "Calling"]],
  ["The World", "earth", ["Completion", "Wholeness", "Arrival"]]
];

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

export const majors: readonly Card[] = data.map(([name, element, keywords], number) => ({
  id: slug(name),
  name,
  arcana: "major",
  suit: null,
  number,
  numeral: numerals[number] ?? String(number),
  element,
  keywords
}));
