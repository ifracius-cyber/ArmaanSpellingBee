# 🐝 Spelling Hive

A private, interactive study hub to get Armaan ready for the **Dallas Regional Spelling Bee**. It covers all
**4,003 words** from the Scripps *2027 Words of the Champions* list (One Bee, Two Bee and Three Bee).

## What's inside

| Area | What it does |
| --- | --- |
| **Hive (home)** | Daily goal, day streak, honey points, and progress per difficulty level. |
| **Learn** | One word at a time: hear it, watch 3D honeycomb tiles spell it letter by letter, then read the definition, synonyms, a sentence, the language of origin and a spelling tip. "Teach me everything" reads the whole card aloud. Filter by level, starting letter, new, not mastered, or starred. |
| **Spelling Bee** | Works like the real bee: the voice says the word, and you can ask for the definition, a sentence, the origin or the part of speech before typing. Right answers set off 3D confetti. Wrong answers show which letters were off, and the voice spells the word out. |
| **Word List** | Search all words by spelling, meaning or synonym. |
| **Settings** | ElevenLabs key, voice, model and speed; learner name; daily goal. |

Progress uses spaced repetition (Leitner boxes). Missed words come back soon, and known words come back later.
A word counts as *mastered* after it has been spelled correctly several times. Progress is saved in the browser.

## Tech

- **React 19 + TypeScript + Vite** for the UI, with **Tailwind CSS v4** for styling and **Zustand** for saved state
- **Three.js** through **React Three Fiber**: the moving honeycomb background, the flying bee mascot, the 3D letter
  tiles and the confetti. Everything is built from code, so there are no model files to download.
- **ElevenLabs text-to-speech** for the teacher voice. The default voice is "Bella", a premade voice made for
  education. Each phrase is cached in the browser after it is first made, so hearing it again costs no credits. If
  there is no key, or the request fails, the app uses the device's built-in voice instead.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:host   # also reachable from other devices on your Wi-Fi (use the "Network:" URL it prints)
npm run build      # static site in dist/
```

### Turning on the ElevenLabs voice

1. Create an API key at <https://elevenlabs.io/app/settings/api-keys>. It only needs the *Text to Speech* and
   *Voices (read)* permissions.
2. Open **Settings** in the app, paste the key, and press **Save & check**. Then press **Test voice**.

The key is stored in that browser only (localStorage). The app is a static site that calls ElevenLabs directly
from the browser, so **don't publish it on a public URL with a key built in**. For a private family app, pasting the
key in Settings on each device is the simplest safe setup.

## Word data

- `scripts/parse_pdf.py` and `scripts/clean_words.py` pull the word list out of the official PDF using
  `pdftotext -bbox-layout`. They keep the three-column order, the difficulty levels and alternate spellings
  (`OR …`, British `*`).
- Claude wrote the definitions, synonyms, example sentences, origins and spelling tips for a 4th-grade reader.
  `scripts/build_words.py` merges them into `src/data/words.json`.
- These are study aids, not the official Scripps pronouncer guide. Check very rare words against Merriam-Webster
  Unabridged, which is the bee's official dictionary. For example, *nodiak* only has a placeholder definition.

## Sharing without running a server

`npm run build:single` builds the whole app into one file, `dist-single/index.html`. You can host that file anywhere,
or publish it as a page. When the app runs inside a locked-down page, browser rules block calls to ElevenLabs, so it
uses the device's built-in voice instead.
