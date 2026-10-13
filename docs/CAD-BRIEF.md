# CAD and 3D brief: jewelry pieces for the Aura Luxe try-on booth

Send this page to the CAD designer or manufacturer. Every piece they deliver goes through an automatic check (section 9), so following the rules below means it works on the booth the first time.

## 1. What the booth does with your file

A visitor stands in front of a camera. The booth finds their ears and neck and draws your 3D piece on them, live, at real size. The piece must therefore be:

- **At true size** (a 46 mm earring must measure 46 mm).
- **Light enough** to run smoothly on a mini PC and, later, a phone.
- **Clean and simple**: the booth adds the metal shine, stone sparkle and lighting itself, so the file only needs the shape and the part names.

## 2. First batch

Start with five pieces, the best sellers. Each must look good moving on a face, not only alone in a viewer.

| # | Piece | Type | Real size (mm) used by the app |
|---|---|---|---|
| 1 | Royal Kundan Jhumka | earrings | drop height 46 |
| 2 | Chandelier Diamond Drops | earrings | drop height 42 |
| 3 | Solitaire Diamond Studs | earrings | height 10.5 |
| 4 | Heritage Polki Choker | necklace | width 124 |
| 5 | Imperial Rani Haar | necklace | width 132 |

Later: Eternity Pavé Hoops (24), Solitaire Diamond Pendant (112), Imperial Ruby Amulet (98), then rings and bangles (a separate brief when we get there).

## 3. What to deliver for every piece

1. **Original CAD file**: STEP, 3DM (Rhino) or the native file (Matrix, RhinoGold, JewelCAD). We keep it for later changes.
2. **`<id>.glb`**: the file the booth loads (rules in sections 4 to 7). Example: `ear-001.glb`.
3. **6 reference renders**, PNG, 2048 px, neutral grey background: front, three-quarter left, three-quarter right, side, back, top. Same lighting on all.
4. **Macro photos** of the real piece (2 or 3 close-ups of the best craft details, for the "Craft story" panel). Our own or licensed photos only.
5. **One row in the piece sheet** (`docs/piece-sheet.csv`, section 8).

If there is no CAD, a 3D artist can rebuild the piece from **40 to 70 turntable photos** (soft even light, light tent, plain background, a ruler in frame). Never use matte scanning spray on a real piece (it leaves residue and can harm pearls and soft stones). Phone scan apps are fine for a test but not for the final.

## 4. Size and units

- Model at **real size in millimetres** in the CAD tool.
- The `.glb` format uses **metres**: a 46 mm earring is 0.046 units tall in the file. (In Blender: 1 unit = 1 m, so scale the model by 0.001 if it was built in mm.)
- Do not scale or stretch anything after export. The check reports the real size it sees and compares it to the table in section 2.

What counts as "size":
- **Earring**: the full height from the top contact point down to the lowest part, in mm.
- **Necklace**: the widest left-to-right span of the piece in its worn shape, in mm.

## 5. Orientation, origin and shape

The file uses the glTF directions: **Y is up, Z points toward the viewer (the front of the piece), X is left to right.**

### Earrings: one earring per file

```
          ●   <- the highest point of the file = where it meets the earlobe
          |
        .-'-.     body hangs straight down (-Y)
       |     |
        '-.-'
          v

   Y up, front of the piece faces +Z (toward the viewer)
```

- The **top of the file is the contact point** on the earlobe. A short stud post (3 mm or less) is fine. Do not model a long ear-wire loop above the contact point.
- The piece hangs **straight down** as it would on a person, facing the front.
- The booth uses the same file for the left and right ear. Design it so a single piece suits both ears. If the left and right differ, deliver two files, `ear-001_L.glb` and `ear-001_R.glb`.
- Pieces that swing (jhumka bells, tassels): model them in their **resting, hanging** pose. The booth adds the sway.

### Necklaces: modelled as worn, not flat

```
   top view, worn                       front view
                                  ends meet the neck here
        .------.                      |                  |
      /          \                     \                /
     |  neck form |    depth             '-.        .-'
      \          /     25 to 60 mm            '-.  .-'
        '------'                                 \/   <- centre pendant hangs down
   piece curves around the neck                  (Y up, symmetric about X = 0)
```

- Model it **curved the way it sits on a neck** (a standard neck form is about 100 to 120 mm across at the base). A flat-laid necklace looks pasted onto the screen.
- Symmetric left to right, centred on **X = 0**.
- The **highest points are the two ends** where it meets the sides of the neck. The centre pendant or drop hangs down from the bottom centre.
- Model only what a viewer sees from the front, plus a little going round the sides. The back half and the clasp are not needed.
- Chains: a visible thickness (not paper thin), and enough segments that the curve looks smooth.

## 6. Structure and part names (this is how metal and stones get their look)

The booth replaces every material with its own shiny, reflective version, chosen from the **name of each part**. Name each mesh with one of these prefixes, then anything you like:

| Name starts with | Booth material |
|---|---|
| `GOLD_` | yellow gold |
| `ROSEGOLD_` | rose gold |
| `SILVER_`, `PLATINUM_`, `WHITEGOLD_` | silver / white metal |
| `DIAMOND_`, `POLKI_` | diamond and clear stones |
| `RUBY_` | ruby |
| `EMERALD_` | emerald |
| `PEARL_` | pearl |
| `KEEP_` | **keeps your own material**, for example blue meenakari enamel |

Examples: `GOLD_frame`, `GOLD_filigree_top`, `DIAMOND_centre`, `RUBY_01`, `PEARL_drop_04`, `KEEP_enamel_blue`.

Rules:
- **Merge parts of the same material** into one mesh where you can. Aim for **12 meshes or fewer** per piece.
- One root object per piece, named by its id (`ear-001`). No cameras, lights or animations in the file.
- A coloured part you want to keep as made (enamel, a coloured stone that is not in the table) uses `KEEP_`. Give it a simple material colour, or a texture up to 1024 px.

## 7. Quality limits (lean, not lossy)

| | Earrings | Necklaces |
|---|---|---|
| Triangles | 40,000 or fewer | 80,000 or fewer |
| File size | 5 MB or less (hard limit 8) | 5 MB or less (hard limit 8) |
| Textures | none needed; 1024 px at most | none needed; 1024 px at most |

- **Stones**: simplified faceted shapes. A small pavé stone can be 12 to 20 triangles, a hero stone up to about 200. Do not model real light bending (refraction); the booth fakes sparkle with its own lighting.
- **Remove hidden geometry**: inside settings, under stones, faces nobody can ever see. This is usually where the weight is.
- **Smooth shading** on gold bodies and curved parts, **flat shading** on stone facets.
- **No baked lighting, shadows or reflections** in textures. Plain PBR (metallic and roughness) only. No custom shaders. No see-through (transparent) stones.
- Close any open modifier stack (subdivision and similar) before export.

## 8. Piece sheet

Fill in one row per piece in `docs/piece-sheet.csv`. These numbers drive the booth, so they must be real measurements of the physical piece, not estimates.

| Column | Meaning |
|---|---|
| `id` | `ear-001`, `neck-004`... same as the file name |
| `name` | name shown to the visitor |
| `type` | `earrings` or `necklace` |
| `size_mm` | earring: full drop height. Necklace: widest span, worn shape |
| `y_offset_mm` | optional. How far lower (+) or higher (-) it should sit than the default; leave 0 if unsure |
| `rigid` | `yes` for studs that must not swing, otherwise `no` |
| `metals_stones` | for the label, for example `22K gold, pearls, polki` |
| `weight_g` | optional |
| `pair` | `symmetric` or `L+R files` |
| `story_title`, `story_text` | optional, up to 30 characters and about 25 words. Real craft facts only, no invented claims |

## 9. How we accept a file

We run an automatic check on every `.glb`. It must say **READY** (warnings are acceptable, failures are not):

```
npm run check:glb -- ear-001.glb --id ear-001
```

It checks: file size, triangle count, real size against the table, orientation and centring, part names, textures, and that there are no cameras or lights. If the file is a little heavy, we can shrink it ourselves (`npm run optimize:glb -- in.glb out.glb`), but please deliver a lean file first.

Then a person looks at it on a moving face on the booth and signs it off. A piece is only done when it looks right on a real person, not only in a viewer.

## 10. Folder layout for delivery

```
ear-001/
  ear-001.glb
  ear-001.step            (or .3dm)
  renders/   front.png  three-quarter-left.png  three-quarter-right.png  side.png  back.png  top.png
  macro/     detail-1.jpg  detail-2.jpg
neck-004/
  ...
piece-sheet.csv
```
