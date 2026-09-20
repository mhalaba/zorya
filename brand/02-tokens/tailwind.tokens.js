/* Zorya — Tailwind theme extension, generated from tokens.json. Semantic colours are CSS variables from tokens.css, so they follow data-theme. */
module.exports = {
  "theme": {
    "extend": {
      "colors": {
        "night": "#0E1219",
        "night-raised": "#161C26",
        "night-line": "#2A3341",
        "night-line-strong": "#5C6878",
        "ivory": "#F3EDE0",
        "ash": "#A9B0BA",
        "fog": "#EEF1F5",
        "fog-raised": "#FFFFFF",
        "fog-line": "#CDD4DC",
        "fog-line-strong": "#7D8794",
        "slate": "#545E6B",
        "dawn": "#F2B544",
        "dawn-deep": "#7D4F00",
        "ember": "#F0783A",
        "ember-deep": "#A83A10",
        "alarm": "#FF6157",
        "alarm-deep": "#B5241C",
        "calm": "#8FC7EA",
        "calm-deep": "#1C5A83",
        "bg": "var(--z-bg)",
        "bg-raised": "var(--z-bg-raised)",
        "line": "var(--z-line)",
        "line-strong": "var(--z-line-strong)",
        "text": "var(--z-text)",
        "text-2": "var(--z-text-2)",
        "on-status": "var(--z-on-status)",
        "link": "var(--z-link)",
        "link-underline": "var(--z-link-underline)",
        "focus": "var(--z-focus)",
        "status-cisza": "var(--z-status-cisza)",
        "status-obserwacja": "var(--z-status-obserwacja)",
        "status-ostrzezenie": "var(--z-status-ostrzezenie)",
        "status-alarm": "var(--z-status-alarm)",
        "status-odwolanie": "var(--z-status-odwolanie)",
        "fill-obserwacja": "var(--z-fill-obserwacja)",
        "fill-ostrzezenie": "var(--z-fill-ostrzezenie)",
        "fill-alarm": "var(--z-fill-alarm)",
        "fill-odwolanie": "var(--z-fill-odwolanie)",
        "map-water": "var(--z-map-water)",
        "map-land": "var(--z-map-land)",
        "map-roads": "var(--z-map-roads)",
        "map-boundary": "var(--z-map-boundary)"
      },
      "fontFamily": {
        "ui": [
          "Atkinson Hyperlegible Next",
          "Atkinson Hyperlegible",
          "system-ui",
          "sans-serif"
        ],
        "mono": [
          "Atkinson Hyperlegible Mono",
          "ui-monospace",
          "Menlo",
          "monospace"
        ]
      },
      "spacing": {
        "$description": "4px base. Use the steps; do not invent 10px or 18px.",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px"
      },
      "borderRadius": {
        "none": "0",
        "full": "9999px",
        "DEFAULT": "0"
      },
      "boxShadow": {
        "none": "none",
        "DEFAULT": "none"
      },
      "fontSize": {
        "display": [
          "40px",
          {
            "lineHeight": "44px",
            "fontWeight": "800",
            "letterSpacing": "-0.01em"
          }
        ],
        "h1": [
          "28px",
          {
            "lineHeight": "34px",
            "fontWeight": "700",
            "letterSpacing": "0"
          }
        ],
        "h2": [
          "22px",
          {
            "lineHeight": "28px",
            "fontWeight": "700",
            "letterSpacing": "0"
          }
        ],
        "h3": [
          "18px",
          {
            "lineHeight": "24px",
            "fontWeight": "700",
            "letterSpacing": "0"
          }
        ],
        "body": [
          "17px",
          {
            "lineHeight": "26px",
            "fontWeight": "400",
            "letterSpacing": "0"
          }
        ],
        "body-strong": [
          "17px",
          {
            "lineHeight": "26px",
            "fontWeight": "700",
            "letterSpacing": "0"
          }
        ],
        "small": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400",
            "letterSpacing": "0"
          }
        ],
        "label": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "500",
            "letterSpacing": "0.08em"
          }
        ],
        "mono": [
          "15px",
          {
            "lineHeight": "22px",
            "fontWeight": "500",
            "letterSpacing": "0"
          }
        ],
        "mono-small": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "500",
            "letterSpacing": "0.02em"
          }
        ]
      },
      "maxWidth": {
        "app": "40rem",
        "site": "72rem",
        "measure": "64ch"
      }
    }
  }
};
