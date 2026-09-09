# Content guide

This guide is for the museum staff. No technical knowledge is required.

Everything happens in the **dashboard**, at the address your provider gave you (it ends with
`/_/`). What you save there appears in the visitors' app **within a minute**, with no update to
download.

> Starting from scratch, or never opened the dashboard before? Open
> [`getting-started.html`](getting-started.html) in a web browser: same content, with screenshots
> and the order to follow. Come back here for the detail, field by field.

---

## The main principles

Content is organised in three levels:

```
Exhibition          "Permanent collection"
  └── Artwork       "Narrow-necked jug", no. 1, room S1
        └── Translation   the title, the text and the audio, in ONE language
```

Two rules to remember:

1. **An artwork holds no text by itself.** The title and the text live in the translations. An
   artwork with no translation will display nothing.
2. **Nothing is visible until the `published` box is ticked.** It is your safety net: you can
   prepare an exhibition for months without anyone seeing it.

---

## Adding an artwork

1. Open the **`artwork`** collection then "New record".
2. Fill in:
   - **exhibition** — the exhibition it belongs to *(required)*
   - **room** — the room where it hangs
   - **code** — the number printed on the label, which the visitor types in the app (e.g. `12`).
     Digits and capitals only, and never twice the same in the museum.
   - **artist**, **year**, **technique**, **inventory_number** — the information on the label.
     `year` is free text: "1889", "around 1500", "18th century".
   - **images** — up to 10 photos, 5 MB each. **The first one is used as the thumbnail** in
     lists: put the overall photo first, not a detail.
     JPEG or WebP (PNG is accepted), **at least 1600 px on the long side**, 2400 px is plenty:
     below that the app has to enlarge the photo and it shows, above it nothing is gained.
   - **pos_x** / **pos_y** — see "Placing an artwork on the map" below. Optional.
   - **sort** — to force the display order (0 first). Leave it at 0 if the order does not matter
     to you.
3. Tick **published**, then "Create".
4. Now add at least one translation — without it, the artwork is empty.

## Adding the text and the audio guide

Open **`artwork_translation`** then "New record".

- **artwork** — the artwork concerned
- **language** — the language of this text
- **title** — the title in this language *(required)*
- **text** — the long text, with formatting (bold, paragraphs, lists)
- **audio** — the audio guide file **for this language**, up to 25 MB
- **audio_duration** — the duration in seconds, shown before playback. Optional.

> **One row per language.** For an artwork in French and English, you create two records. This is
> deliberate: the English audio guide is a different sound file from the French one, it cannot be
> shared.

Accepted audio formats: MP3, M4A/AAC, WAV, OGG. **Prefer MP3**: at equivalent quality it weighs
five to ten times less than a WAV, which makes all the difference for a visitor on mobile data.

## Adding an exhibition

**`exhibition`** collection:

- **slug** — an identifier in lowercase-with-dashes (`cobalt-blue`).
  **Do not change it once the exhibition is published**: it is what identifies the exhibition.
- **cover** — the cover image, 5 MB max
- **color** — the exhibition's colour code, in `#RRGGBB` format (`#2A4B9B` for a cobalt blue).
  The app uses it to tint the exhibition's screens, which lets a temporary exhibition carry the
  colour of its poster. Leave it empty to keep the museum's accent colour.
- **is_permanent** — tick for a permanent collection; the dates are then ignored
- **start_date** / **end_date** — for a temporary exhibition
- **requires_ticket** — tick if a ticket is needed to see this exhibition. See
  "Making an exhibition paying" below. Left unticked, the exhibition is free, which is the
  case of most of them.
- **unlock_code** — the code that unlocks it, only useful when the box above is ticked
- **rooms** — the rooms occupied
- **published**

Then one row in **`exhibition_translation`** per language, with title, subtitle, introduction
text and, if you have one, the audio introduction.

## Making an exhibition paying

Tick **requires_ticket** on the exhibition, then fill in **unlock_code**.

The visitor who opens a paying exhibition in the app sees its cover, its title and its
description — enough to want to come in. The artworks are there in the list, but their photo is
blurred, their title is cut off and a padlock replaces the arrow. Tapping one says: buy your
ticket at the museum and scan the QR code to unlock.

**The code is what you print on the ticket, as a QR code.** Choose whatever text you want —
`COBALT2026`, `BLEU-2026`, a series of digits. Any QR code generator on the web produces the
image from that text; you paste it into your ticket layout. Nothing to install, nothing to ask
your provider for.

Two things to know before you print:

- **One code per exhibition.** Scanning the cobalt-blue code unlocks the cobalt-blue exhibition,
  not the others. A visitor who bought two exhibitions scans two QR codes.
- **Changing the code invalidates the tickets already printed.** Only change it between two
  exhibitions, never during one.

How long a scan lasts is set once for the whole museum, in the **`museum`** collection:
**ticket_validity_hours**. `4` means the visitor's phone stays unlocked for four hours after the
scan, then asks for the code again. Leave the field empty or at `0` and a scan never expires —
which suits a season ticket, less so a day ticket.

> This padlock discourages, it does not protect. Someone technical enough could read the content
> without a ticket, because the app has to work without any visitor account. It is there so that
> an honest visitor buys their ticket, not to fight a determined one.

## Placing an artwork on the map

Each floor's map is an image, uploaded in **`floor`** → `map` field.

The **`pos_x`** and **`pos_y`** positions of an artwork are proportions of that image:

- `pos_x`: `0` = left edge, `0.5` = middle, `1` = right edge
- `pos_y`: `0` = top, `0.5` = middle, `1` = bottom

An artwork at the centre of the map is therefore at `pos_x = 0.5`, `pos_y = 0.5`.

Simple method: open the map image, spot the artwork by eye, estimate the fraction. `0.25` and
`0.3` are enough — hundredth precision brings nothing.

> If you replace a map image with another one **framed differently**, every position on that
> floor has to be reviewed.

## Changing the museum name, logo or colours

**`museum`** collection. It holds a single record, which you edit but neither delete nor
duplicate — the system will refuse both anyway.

There you set the displayed name, the subtitle, the logo, the home image, the app's two colours,
the default language, how long a scanned ticket lasts, the coordinates and the address.

These two colours are the app's default. An exhibition that carries its own `color` overrides the
accent colour on its own screens only.

## Adding an information page

**`page`** collection: opening hours, prices, accessibility, legal notices. Every page has a
`slug`, an icon, and one row per language in **`page_translation`**.

The icon is an [SF Symbols](https://developer.apple.com/sf-symbols/) name — for example
`info.circle`, `clock`, `figure.roll`. When in doubt, ask your provider, or leave it empty.

## Adding a language

**`language`** collection: the code (`de`, `es`, `it`…) and the name of the language **written in
that language** (`Deutsch`, `Español`, `Italiano`).

The language appears in the app as soon as it exists. So create it **after** translating the
essentials, or untick `active` in the meantime: otherwise visitors who choose it would only see
empty artworks.

---

## Careful

**Deleting an exhibition deletes all its artworks**, and their texts, and their audio. The
operation is immediate and permanent. To remove an exhibition from the app without losing
anything, **untick `published`** — it disappears from the app and stays intact in the dashboard.

The same reasoning applies everywhere: *unticking `published`* is reversible, *deleting* is not.

## Why is the app not showing my change?

In order, the most frequent causes:

1. The **`published`** box is not ticked — on the artwork **or** on its exhibition. An artwork
   published inside an unpublished exhibition stays invisible.
2. **The translation is missing** in the language of the visitor's phone.
3. The **language** exists but its `active` box is unticked.
4. The app is less than a minute behind its cache. Close it completely and reopen it.

If none of this explains the problem, contact your provider stating the name of the artwork and
the language concerned.
