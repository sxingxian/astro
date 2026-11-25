import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

let registered = false;

/** Registers the Astro easing curves once: astroOut (strong ease-out) and astroInOut. */
export function registerEases() {
  if (registered) return;
  gsap.registerPlugin(CustomEase);
  CustomEase.create("astroOut", "M0,0 C0.23,1 0.32,1 1,1");
  CustomEase.create("astroInOut", "M0,0 C0.77,0 0.175,1 1,1");
  registered = true;
}
