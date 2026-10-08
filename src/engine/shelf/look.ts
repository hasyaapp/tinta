// Calibration for the Home shelf rendered as real geometry.
//
// Numbers come from measurements recorded in docs/11-ui-buku-jurnal.md: the
// reference shelf shows a rounded spine board, a paper stack that protrudes below
// and to the right of the cover, and shadows that ramp over tens of pixels rather
// than stopping at a hard edge. Everything tunable lives here so the look can be
// recalibrated against the reference frames without touching other modules.

/** Thickness of the closed book, in the cover's own units. The reference paper
 *  stack protrudes about 11 px below and 3 px to the right of a 350x516 cover. */
export const BOOK_THICKNESS = 13;

/** Fore-edge corner radius of the cover boards, matching --book-radius. */
export const COVER_RADIUS = 28;

/** The spine board wraps the pages, so its cross-section is a half round. */
export const SPINE_ROUND_SEGMENTS = 8;

/** The cover overhangs the page block on the spine side by this much. */
export const SPINE_INSET = 2;

export const PAPER = {
  light: "#e7e4d9",
  mid: "#c2bfb3",
  dark: "#a3a299",
  rim: "#3c3f3a",
};

/** Paper tone measured from the reference (native page stack reads 125-135). */
export const PAPER_SHADE = 1;

export const LIGHT = {
  /** Key light, upper-left and slightly in front, as the reference shelf is lit. */
  direction: [-0.42, 0.72, 0.55] as const,
  ambient: 0.6,
  /** Wrap lighting keeps the matte board from going fully black on the far side. */
  wrap: 0.35,
  coverRoughness: 0.62,
  spineRoughness: 0.5,
};

/** The spine board faces the reader as a band across the left of the cover; the
 *  reference cross-section runs lit edge, groove, band face, dark seam. */
export const BAND_WIDTH = 0.12;

export const BAND_GLSL = `
float bandLight(float u) {
  float lit = 1.0 - smoothstep(0.02, 0.12, u);
  float groove = smoothstep(0.05, 0.16, u) * (1.0 - smoothstep(0.16, 0.34, u));
  float seam = smoothstep(0.88, 1.0, u);
  return 1.0 + 0.32 * lit - 0.26 * groove - 0.3 * seam;
}
`;

export const SHADOW = {
  lifted: { offset: [33, 71] as const, blur: 14, opacity: 0.4 },
  resting: { offset: [10, 17] as const, blur: 10, opacity: 0.28 },
};

/** Fragment lighting shared by the cover, the spine and the paper stack. */
export const LIGHTING_GLSL = `
float wrapLight(vec3 n, vec3 l, float wrap) {
  return clamp((dot(n, l) + wrap) / (1.0 + wrap), 0.0, 1.0);
}
float shade(vec3 n, vec3 l, float ambient, float wrap, float roughness) {
  float diffuse = wrapLight(n, l, wrap);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float specular = pow(max(dot(n, h), 0.0), mix(48.0, 8.0, roughness)) * (1.0 - roughness) * 0.18;
  return ambient + (1.0 - ambient) * diffuse + specular;
}
`;
