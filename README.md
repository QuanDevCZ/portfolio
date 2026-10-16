# Quan Nguyen — portfolio

Personal portfolio of Quan Nguyen, an AI builder from Czechia who makes websites, web apps and automations.

**Live:** https://quandevcz.github.io/portfolio/

## What's on it

- **Hero:** a short intro on the left. On the right is a 3D "drum" of project cards that you turn with the mouse wheel (only while hovering it), drag, arrow keys or the dots. At the first and last card the wheel goes back to scrolling the page.
- **Cards:** all projects, services, a short "beyond code" section and contact.

## Run locally

Zero dependencies, no build step. It's plain `index.html`, `style.css` and `main.js`.

```bash
npx serve .      # or any static server, then open the printed URL
```

Opening `index.html` straight from disk works too.

## Notes

- Fonts: Inter Tight and JetBrains Mono from Google Fonts.
- Project screenshots are in `assets/shots/`. Drum card tints are set inline on each `.dcard` in `index.html`.
- The X and LinkedIn rows are placeholders. Swap each `.socials__soon` span for a link once the profiles are live.
- Design references: [adrien-ninet.com](https://adrien-ninet.com/) (card column) and [gabrielbeaugonin.com](https://www.gabrielbeaugonin.com/) (drum hero). The code is original.
