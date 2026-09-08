# Releasing Spreadsheets (repo `sweet`, happ `calcy`)

Spreadsheets is distributed as a `.webhapp` referenced by the
[weave-tool-curation](https://github.com/lightningrodlabs/weave-tool-curation)
list. A release is **UI-only**: it bundles the current UI with the *exact same*
frozen happ as every previous release on the same line, so all installs stay on
the same DNA / network and existing users' data is preserved.

## The 0.7 line is a new network

This branch targets Holochain 0.7, which has no data migration path from 0.6:
the DNA hash changed, 0.6 and 0.7 conductors cannot read each other's databases,
and 0.6 and 0.7 agents form disjoint networks. Spreadsheets created on the 0.6
line (Spreadsheets `0.2.x`) do not carry over, and a group has to move across
together — a 0.7 agent cannot see 0.6 peers at all.

To carry content over, use the export/import the UI already offers:

- a single board: its **⋯ menu → Export** (writes a `spreadsheets_export_<name>.json`;
  0.2.x wrote `calcy_export_<name>.json` and those import unchanged — import reads the
  file's contents, not its name),
- everything: the **About dialog → Export All Documents**, and
  **About dialog → Import Boards** on the 0.7 side.
- CSV also still works: **board menu → Import**.

## Why the happ is frozen (never rebuilt)

The zome wasm embeds the builder's absolute paths (`~/.cargo/...` and source
paths via the HDK macros). That makes the happ **non-reproducible** on a
different machine/user or in CI — a rebuild produces a different DNA hash, i.e. a
different network. The happ is built once and those exact bytes are reused
forever.

The canonical bytes live as the `happ-v<dnaVersion>` GitHub release (tag in
`.happ-version`); their sha256 is recorded in `.happ-sha256` and checked by both
`scripts/release-happ.sh` and the release workflow.

> ⚠️ Do **not** release by uploading the output of `npm run package`. That
> rebuilds the happ locally (your paths → wrong DNA → a forked network).
> Releases must go through the tag-triggered workflow below.

## One-time per DNA version: publish the canonical happ

```bash
nix develop --command bash -c "npm run build:happ:release"
nix develop --command bash scripts/release-happ.sh
```

`build:happ:release` is the canonical build: it runs `scripts/wasm-opt-zomes.mjs`
over every zome named in `dnas/calcy/workdir/dna.yaml` (`wasm-opt -Oz
--strip-debug --strip-producers`) before packing. Plain `build:happ` skips that
and therefore produces a **different DNA hash** — a different network. That is
intentional: dev builds must never join the canonical network. Only
`build:happ:release` output may be published.

The script verifies `workdir/calcy.happ` against `.happ-sha256` and
creates/updates the `happ-v<dnaVersion>` release. It also accepts the URL of an
already-published `.webhapp` as its first argument, to recover the exact bytes of
a line that is already live.

This must be done **before the first 0.7 webhapp release**. If the local build
does not match `.happ-sha256` (a different machine, a `cargo clean`, a dependency
bump), the script refuses and tells you what to do: that mismatch is the tripwire
that stops a silent network fork. Deliberately starting a new DNA line means
bumping `dnaVersion` in `ui/package.json`, updating `.happ-version`, and writing
the new sha into `.happ-sha256`.

## Each release: cut a webhapp

1. Bump `version` in `ui/package.json` (must be higher than the installed
   version for Moss to offer it as an upgrade).
2. Commit, then:

   ```bash
   npm run release:webhapp        # tags v<version> and pushes
   ```

   > ⚠️ **Tag-namespace warning — SKIP 0.3.1.** This repo carries tags from two
   > earlier, unrelated versioning schemes: `v0.2.0`–`v0.2.6`, `v0.3.1`,
   > `v0.10.1`–`v0.10.6` (the old `sweet` app line) and
   > `spreadsheets-0.1.0`/`-0.2.0`/`-0.2.1` (the Moss tool line). `v0.3.0` is
   > free, so the first 0.7 release is fine. **The next patch is not: `v0.3.1`
   > already exists**, pointing at `3e80b3f` (2024-04-04), and it carries a
   > published GitHub prerelease with assets that older curation lists may still
   > link to.
   >
   > **The decision is to skip it: go 0.3.0 → 0.3.2.** Do **not** delete the 2024
   > tag — deleting it destroys published artifacts. Do not reuse it either. The
   > cost of skipping is one cosmetic gap in the curation list's `versions[]`.
   >
   > `release:webhapp` now guards this. If the tag exists it prints the collision,
   > names this file, tells you to bump to the next free patch, and exits 1
   > **before** `git tag` or `git push` runs — so nothing is tagged and nothing is
   > pushed. The check is against local tags, so run `git fetch --tags` first if
   > this checkout might be missing remote ones.
   >
   > Switching the prefix to `spreadsheets-*` (this script plus
   > `release-webhapp.yaml`'s trigger) would escape the legacy namespace for good
   > and matches this repo's own tool-line tags, but it diverges from the phase
   > standard — that is a cross-phase decision, not one to make mid-release. The
   > curation list carries an explicit download URL, so either scheme works there.

3. The [`release-webhapp`](.github/workflows/release-webhapp.yaml) workflow then:
   - downloads the frozen happ from `happ-v<dnaVersion>` and checks its sha256
     against `.happ-sha256`,
   - builds the UI and packs `calcy.webhapp` (no `--recursive`, so the happ
     is embedded verbatim — never rebuilt),
   - re-verifies the embedded happ still equals the frozen DNA,
   - prints the three curation hashes to the run summary,
   - publishes a **prerelease** GitHub release with `calcy.webhapp` attached.
      It is deliberately not a draft: draft assets are not served at the public
      `releases/download/<tag>/...` URL Moss fetches, so they 404.
4. Nothing is live yet — updating the curation list below is the go-live gate.

## Update the curation list

The workflow run summary (and the release body) contains:

```json
"hashes": {
  "happSha256": "<frozen>",         // always the frozen DNA, from .happ-sha256
  "webhappSha256": "<new>",
  "uiSha256": "<new>"
}
```

Add a new `versions[]` entry for tool id `spreadsheets` in the 0.16 curation list
(`versionBranch: "0.3.x"`) with the new `version`, the release's `calcy.webhapp`
`url`, and these hashes. Because `happSha256` is unchanged, Moss treats it as an
in-place upgrade on the same network. To get the hashes for an artifact locally:
`npm run weave-hash`.

## A note on npm

This repo used to be a yarn workspace. It is now npm (`package-lock.json`), which
is what CI and both release paths use.

`@univerjs/icons` used to be pinned to `1.1.1` in both `ui/package.json` and the
root `overrides`: `@univerjs/design@0.21.1` imports `DropdownIcon`, which later
1.x releases of `@univerjs/icons` no longer export, so an unpinned `npm i`
produced a UI that did not build — yarn.lock had held that pin implicitly. **The
pin is gone as of the Univer 0.25.1 upgrade**, which is most of why that upgrade
was worth doing: `@univerjs/design@0.25.1` declares `@univerjs/icons` at an exact
`1.4.0` itself, and the tree resolves to one copy of each.

One trap when cutting a release: `npm test` runs `hc app pack workdir`, a plain
dev build, and **overwrites `workdir/calcy.happ`**. Run `npm run
build:happ:release` again before `npm run release:happ` if you have run the tests
— the script's sha check will refuse to publish otherwise, which is the safety
net rather than the workflow.
