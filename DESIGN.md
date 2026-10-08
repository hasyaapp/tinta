# Tinta Design Direction

Direction set by the owner (2026-10-08 interview): a total chrome overhaul
toward a friendly, consistent, Duolingo-*inspired* identity — borrowing the
approach (chunky pressable surfaces, bold rounded type, one brave core color,
warm microcopy), never the identity (no owl, no Feather font, no green).

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

## Principle: playful chrome, quiet canvas

Tinta is a drawing tool. The user's artwork is the hero. Shelf, dialogs,
buttons, menus, and copy are warm and playful; the paper surface and its
surroundings stay calm and neutral so ink wins.

## Color

- Core: **Coral `#ed5340`** — already Tinta's accent; now promoted to brand
  core. Hover `#d8432f`, pressed-shadow `#b23422`, tint `#fdeae6`.
- Ink: `#1d3557` (text on light, primary dark surfaces).
- Paper: `#faf6ee` (light surfaces), existing canvas paper unchanged.
- Shelf backdrop keeps its slate tone; covers remain the color stars.
- Max 2–3 core colors + 1 accent (coral IS the accent and the core; ink and
  paper are the neutrals). Reason: one brave color reads as identity; more
  reads as noise.

## Typography

- Display/buttons: **Baloo 2** (600/700) — chunky, rounded, friendly.
- Body: **Nunito** (400/600/700) — rounded but highly readable at small sizes.
- Reason: closest open (OFL) pairing to the chunky-rounded feel without
  copying a proprietary face.

## Shape

- Radius scale: 20px cards/dialogs, 14px buttons/inputs, pill (999px) chips
  and the save-state badge. No other radii.
- Chunky press: interactive chrome gets a hard bottom-shadow
  (`box-shadow: 0 4px 0 <darker>`); on press the element translates down 4px
  and the shadow collapses. Reason: affordance you can feel; the signature
  move of the friendly style.

## Motif

- The **ink drop** (from the app icon) is the repeated identity mark:
  loading state, empty states, success toast. No eyes, no character.

## Motion

- MOTION 2: press-down on pointerdown, small spring pop on success
  (toast/save), existing book/page WebGL animations unchanged.
- `prefers-reduced-motion` always wins.

## Voice

- Dialog titles and toasts talk like a friendly studio-mate, short and warm.
  No exclamation spam, no buzzwords, no em dashes.
