# Quan Nguyen — portfolio

Personal portfolio of Quan Nguyen, an AI builder from Czechia who makes websites, web apps and automations.

**Live:** https://quandevcz.github.io/portfolio/

## What's on it

- **Hero:** a short intro (photo, name, one line, availability, two buttons) centred on the same column as the cards below, aligned with the text inside them.
- **Cards:** all projects, services, a short "beyond code" section and contact.

## Run locally

Zero dependencies, no build step. It's plain `index.html`, `style.css` and `main.js`.

```bash
npx serve .      # or any static server, then open the printed URL
```

Opening `index.html` straight from disk works too.

## Notes

- Font: Inter 400 from Google Fonts (free stand-in for Suisse Intl).
- Project screenshots are in `assets/shots/`. Colours, type and radii are tokens at the top of `style.css`.
- The X and LinkedIn rows are placeholders. Swap each `.socials__soon` span for a link once the profiles are live.
- Design references: [adrien-ninet.com](https://adrien-ninet.com/) (card column) and [gabrielbeaugonin.com](https://www.gabrielbeaugonin.com/) (design system: font, colours, shapes). The code is original.
