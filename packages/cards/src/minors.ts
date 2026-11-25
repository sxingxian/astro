import type { Card, Element, Suit } from "./types";

const ranks = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];
const suitNames: Record<Suit, string> = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" };
const elements: Record<Suit, Element> = { wands: "fire", cups: "water", swords: "air", pentacles: "earth" };

const keywords: Record<Suit, Array<[string, string, string]>> = {
  wands: [
    ["Spark", "Inspiration", "Potential"], ["Planning", "Vision", "Choice"], ["Expansion", "Foresight", "Momentum"],
    ["Celebration", "Home", "Harmony"], ["Friction", "Competition", "Energy"], ["Recognition", "Progress", "Confidence"],
    ["Defence", "Conviction", "Stand"], ["Speed", "Movement", "News"], ["Resilience", "Persistence", "Boundaries"],
    ["Burden", "Duty", "Overload"], ["Curiosity", "Enthusiasm", "Discovery"], ["Adventure", "Passion", "Haste"],
    ["Warmth", "Determination", "Charisma"], ["Leadership", "Vision", "Boldness"]
  ],
  cups: [
    ["Openness", "Love", "Feeling"], ["Partnership", "Connection", "Mutuality"], ["Friendship", "Joy", "Community"],
    ["Apathy", "Reflection", "Withdrawal"], ["Loss", "Regret", "Grief"], ["Nostalgia", "Innocence", "Memory"],
    ["Daydreams", "Options", "Illusion"], ["Departure", "Seeking", "Release"], ["Contentment", "Gratitude", "Wishes"],
    ["Fulfilment", "Family", "Peace"], ["Sensitivity", "Wonder", "Messages"], ["Romance", "Charm", "Ideals"],
    ["Compassion", "Empathy", "Calm"], ["Steadiness", "Diplomacy", "Care"]
  ],
  swords: [
    ["Clarity", "Breakthrough", "Truth"], ["Stalemate", "Indecision", "Avoidance"], ["Heartache", "Sorrow", "Honesty"],
    ["Rest", "Recovery", "Retreat"], ["Conflict", "Pride", "Cost"], ["Transition", "Passage", "Calmer waters"],
    ["Strategy", "Secrecy", "Cunning"], ["Restriction", "Fear", "Self-doubt"], ["Worry", "Sleeplessness", "Anxiety"],
    ["Ending", "Exhaustion", "Bottom line"], ["Alertness", "Inquiry", "Wit"], ["Ambition", "Drive", "Bluntness"],
    ["Independence", "Perception", "Directness"], ["Reason", "Authority", "Judgement"]
  ],
  pentacles: [
    ["Opportunity", "Prosperity", "Grounding"], ["Juggling", "Adaptability", "Priorities"], ["Teamwork", "Craft", "Collaboration"],
    ["Security", "Control", "Holding on"], ["Hardship", "Isolation", "Need"], ["Generosity", "Sharing", "Balance"],
    ["Patience", "Investment", "Growth"], ["Diligence", "Mastery", "Practice"], ["Self-reliance", "Comfort", "Reward"],
    ["Legacy", "Wealth", "Roots"], ["Study", "Ambition", "Diligence"], ["Routine", "Reliability", "Method"],
    ["Practicality", "Nurture", "Comfort"], ["Abundance", "Security", "Discipline"]
  ]
};

const suits: Suit[] = ["wands", "cups", "swords", "pentacles"];

export const minors: readonly Card[] = suits.flatMap((suit) =>
  ranks.map((rank, i): Card => {
    const name = `${rank} of ${suitNames[suit]}`;
    const kw = keywords[suit][i];
    if (!kw) throw new Error(`Missing keywords for ${name}`);
    return {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      arcana: "minor",
      suit,
      number: i + 1,
      numeral: "",
      element: elements[suit],
      keywords: kw
    };
  })
);
