
# nobsidian

My own Notion →  Obsidian converter

## Steps

1. `./set-notion-token.js <token>`: sets the token to use with Notion APIs (see docs for `notion-backup`)
1. `./set-file-token.js <token>`: sets the file token to use with Notion APIs
1. `./export-notion.sh`: export all your Notion space to data/exports (you'll need to have `notion-backup` installed)
1. `./ids-from-exports.js`: extracts and stores all content identifiers from the export tree (you can then discard the tree)
1. `./download-ids.js`: downloads all the JSON content (with full context, so lots of rich duplication but we should have everything)
1. `./make-big-index.js`: makes one big index with all the JSON (for easier further processing)
1. `./get-files.js`: downloads all the files
1. `./extract-features.js`: analysis of the big index to generate files that are used for other steps, but also to understand what is going on
2. `./convert.js`: convert all the things
