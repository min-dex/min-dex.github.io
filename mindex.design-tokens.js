(function () {
  const TYPOGRAPHY = Object.freeze({
    label: Object.freeze({ size: 12, weight: 600 }),
    meta: Object.freeze({ size: 12, weight: 500 }),
    control: Object.freeze({ size: 14, weight: 600 }),
    cardTitle: Object.freeze({ size: 16, weight: 700 }),
    pageTitle: Object.freeze({ size: 22, weight: 700 }),
  });

  const ICONS = Object.freeze({
    helper: 14,
    normal: 16,
    large: 20,
    stroke: 1.5,
  });

  const TABS = Object.freeze({
    width: 180,
    size: 14,
    weight: 600,
    activeWeight: 700,
  });

  const BUTTONS = Object.freeze({
    topbar: Object.freeze({ size: 40 }),
    icon: Object.freeze({ size: 35 }),
    dense: Object.freeze({ size: 30 }),
    compact: Object.freeze({ size: 28 }),
  });

  const SPACING = Object.freeze({
    denseStep: 5,
    layoutStep: 10,
    detailPadding: 25,
  });

  const MOTION = Object.freeze({
    shell: Object.freeze({
      duration: "120ms",
      easing: "cubic-bezier(.2, 0, .2, 1)",
    }),
  });

  const SERVICE_NAVIGATION = Object.freeze({
    homeWeekTitle: "최근 예배",
    serviceWeekTitle: "최근 예배",
    serviceListTitle: "전체 예배",
    templatesTitle: "템플릿",
  });

  const BUTTON_INTENT = Object.freeze({
    primary: "primary",
    secondary: "secondary",
    iconOnly: "iconOnly",
    danger: "danger",
  });

  window.MINDEX_DESIGN_TOKENS = Object.freeze({
    version: "2026-08-30",
    surfaces: Object.freeze({ canvas: "--ui-surface-canvas", panel: "--ui-surface-panel", field: "--ui-surface-field" }),
    colorIntents: Object.freeze({ selected: "--accent", primary: "--accent", incomplete: "--warn", failed: "--danger", success: "--success", neutral: "--ink-3" }),
    typography: TYPOGRAPHY,
    icons: ICONS,
    tabs: TABS,
    buttons: BUTTONS,
    motion: MOTION,
    spacing: SPACING,
    serviceNavigation: SERVICE_NAVIGATION,
    buttonIntent: BUTTON_INTENT,
  });
}());

// Derived artwork data is loaded before the presenter rendering helpers.
// BEGIN GENERATED BACKGROUND LUMINANCE
const PRESENTER_BACKGROUND_LUMINANCE = Object.freeze({
  "26-A1": 0.021915,
  "26-A2": 0.015800,
  "26-A3": 0.004375,
  "26-A4": 0.187702,
  "26-A5": 0.116077,
  "26-A6": 0.004697,
  "26-B1": 0.431074,
  "26-B2": 0.417014,
  "26-B3": 0.307186,
  "26-B4": 0.005927,
  "26-B5": 0.052116,
  "26-B6": 0.018370,
  "26-C1": 0.273571,
  "26-C2": 0.290693,
  "26-C3": 0.710122,
  "26-C5": 0.833448,
  "26-C6": 0.776097,
  "26-S4": 0.836764,
  "26-S5": 0.727394,
  "26-S6": 0.606454,
  "scripture-reading-cross": 0.009832,
});
// END GENERATED BACKGROUND LUMINANCE
