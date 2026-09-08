<script lang="ts">
import { getContext, onMount } from "svelte";
import type { CalcyStore } from "./store";
import { v1 as uuidv1 } from "uuid";
import type {  Board, BoardDelta, BoardProps } from "./board";
import EditBoardDialog from "./shared/EditBoardDialog.svelte";
import Avatar from "./shared/Avatar.svelte";
import { decodeHashFromBase64, type Timestamp } from "@holochain/client";
import { cloneDeep } from "lodash";
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
import ClickEdit from "./ClickEdit.svelte";
import SvgIcon from "./shared/SvgIcon.svelte";
import { exportBoard } from "./export";
import AttachmentsList from './shared/AttachmentsList.svelte';
import AttachmentsDialog from "./shared/AttachmentsDialog.svelte"
import Participants from "./shared/Participants.svelte";
import { deepEqual } from "fast-equals";
import { debounce, removeSymbolFields, changeUndefinedToEmptyString, extractActionsFromCommands, extractJSONXFromCommands } from "./util";

import type { WAL } from "@theweave/api";;
import type { IWorkbookData } from '@univerjs/core';

import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";
import '@holochain-syn/core/dist/elements/session-participants.js'

import { LogLevel, ILogService, LocaleService, Univer, UniverInstanceType, type JSONXActions, type ICommand, TextXActionType, TextX, JSONX, ICommandService, CommandService, UserManagerService , Tools, IUniverInstanceService, MemoryCursor, type DocumentDataModel} from '@univerjs/core';

import { createUniver, defaultTheme, LocaleType, mergeLocales } from '@univerjs/presets'

import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/presets/preset-sheets-core/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-core.css'

import { UniverSheetsConditionalFormattingPreset } from '@univerjs/presets/preset-sheets-conditional-formatting'
import sheetsConditionalFormattingEnUS from '@univerjs/presets/preset-sheets-conditional-formatting/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-conditional-formatting.css'

import { UniverSheetsDataValidationPreset } from '@univerjs/presets/preset-sheets-data-validation'
import sheetsDataValidationEnUS from '@univerjs/presets/preset-sheets-data-validation/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-data-validation.css'

import { UniverSheetsDrawingPreset } from '@univerjs/presets/preset-sheets-drawing'
import sheetsDrawingEnUS from '@univerjs/presets/preset-sheets-drawing/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-drawing.css'

import { UniverSheetsFilterPreset } from '@univerjs/presets/preset-sheets-filter'
import sheetsFilterEnUS from '@univerjs/presets/preset-sheets-filter/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-filter.css'

import { UniverSheetsHyperLinkPreset } from '@univerjs/presets/preset-sheets-hyper-link'
import sheetsHyperLinkEnUS from '@univerjs/presets/preset-sheets-hyper-link/locales/en-US'
import '@univerjs/presets/lib/styles/preset-sheets-hyper-link.css'

import { FDataValidationBuilder } from '@univerjs/sheets-data-validation/facade'

let sheet;
let applyingRemoteChange = false;
let commandService;
let previousSpreadsheet = null;
const appliedCommandIds = new Set<string>();

// Dev-only boundary tracer, stripped from release builds. Records what crosses
// each of the four boundaries so a single reproduction shows WHERE a change is
// lost: Univer's command pipeline -> capture -> syn -> replay, plus whether the
// updateSheet() reconciler ever runs.
//   __traceDump()   print the trace   |   __traceClear()   start a fresh one
const TRACE = import.meta.env.DEV;
const trace = (kind: string, detail: any) => {
  if (!TRACE) return;
  const w = window as any;
  if (!w.__trace) {
    w.__trace = [];
    w.__traceClear = () => { w.__trace.length = 0; console.log('trace cleared') };
    w.__traceDump = () => { console.table(w.__trace.map((e: any) => ({ t: e.t, kind: e.kind, detail: e.detail }))); return w.__trace };
  }
  w.__trace.push({ t: Math.round(performance.now()), kind, detail });
  console.log(`[trace] ${kind}`, detail);
};

const replayPendingCommands = () => {
  if (!commandService || !$synState?.commands?.length) return;

  const pendingCommands = $synState.commands.filter((command) => !appliedCommandIds.has(command.syncId));

  if (!pendingCommands.length) return;
  if (TRACE) trace('replay', { count: pendingCommands.length, ids: pendingCommands.map((c: any) => c.id) });

  applyingRemoteChange = true;
  try {
    for (const command of pendingCommands) {
      (commandService as any).syncExecuteCommand(command.id, command.params, { fromCollab: true, fromChangeset: true });
      appliedCommandIds.add(command.syncId);
    }
  } finally {
    applyingRemoteChange = false;
  }
};

// Trigger a save for any low-level sheet mutation (covers all user edits)

const updateSheet = async () => {
  const incoming = $synState.spreadsheet;
  const local = sheet.save();
  if (deepEqual(incoming, local)) { if (TRACE) trace('updateSheet', 'entered, no-op (equal)'); return; }
  if (TRACE) trace('updateSheet', {
    note: 'RECONCILING local workbook to the stored snapshot',
    incomingSheets: Object.keys(incoming?.sheets ?? {}).length,
    localSheets: Object.keys(local?.sheets ?? {}).length,
  });

  applyingRemoteChange = true;
  try {
    const wb = univerAPI.getActiveWorkbook();
    const localSheets = new Map(wb.getSheets().map(s => [s.getSheetId(), s]));

    // Pre-compute plugin resource maps for per-sheet diffing
    const findRes = (wb: any, name: string) => (wb.resources ?? []).find((r: any) => r.name === name);
    const parseRes = (res: any) => res ? JSON.parse((res as any).data || '{}') : {};

    const CF_PLUGIN   = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';
    const LINK_PLUGIN = 'SHEET_HYPER_LINK_PLUGIN';
    const IMG_PLUGIN  = 'SHEET_DRAWING_PLUGIN';
    const DV_PLUGIN   = 'SHEET_DATA_VALIDATION_PLUGIN';

    const inCFBySheet:   Record<string, any[]> = parseRes(findRes(incoming, CF_PLUGIN));
    const loCFBySheet:   Record<string, any[]> = parseRes(findRes(local,    CF_PLUGIN));
    const inLinkBySheet: Record<string, any[]> = parseRes(findRes(incoming, LINK_PLUGIN));
    const loLinkBySheet: Record<string, any[]> = parseRes(findRes(local,    LINK_PLUGIN));
    const inImgBySheet:  Record<string, any[]> = parseRes(findRes(incoming, IMG_PLUGIN));
    const loImgBySheet:  Record<string, any[]> = parseRes(findRes(local,    IMG_PLUGIN));
    const inDVBySheet:   Record<string, any[]> = parseRes(findRes(incoming, DV_PLUGIN));
    const loDVBySheet:   Record<string, any[]> = parseRes(findRes(local,    DV_PLUGIN));

    // Remember the currently active sheet so we can restore it after updating non-active sheets.
    // Univer only re-renders the active sheet, so any sheet with changes must be temporarily activated.
    const originalActiveSheet = wb.getActiveSheet();

    // 1. Add new sheets / update existing
    for (const [sheetId, sheetData] of Object.entries(incoming.sheets) as any[]) {
      const ws = localSheets.get(sheetId);
      if (!ws) {
        wb.insertSheet(sheetData.name, sheetData);
        continue;
      }

      const localSheet = local.sheets[sheetId] ?? {};

      // Activate this sheet if it's not already active so Univer re-renders changes.
      const isActive = ws.getSheetId() === originalActiveSheet?.getSheetId();
      if (!isActive) ws.activate();

      // 2. Cell data — resolve style IDs to inline objects before applying
      if (!deepEqual(sheetData.cellData, localSheet.cellData)) {
        const rowCount = sheetData.rowCount ?? 1000;
        const colCount = sheetData.columnCount ?? 26;
        const styles = incoming.styles ?? {};
        const resolved: any = {};
        for (const [rowKey, row] of Object.entries(sheetData.cellData ?? {}) as any[]) {
          resolved[rowKey] = {};
          for (const [colKey, cell] of Object.entries(row as any) as any[]) {
            if (cell && typeof cell.s === 'string') {
              resolved[rowKey][colKey] = { ...cell, s: styles[cell.s] ?? cell.s };
            } else {
              resolved[rowKey][colKey] = cell;
            }
          }
        }
        ws.getRange(0, 0, rowCount - 1, colCount - 1).setValues(resolved);
      }

      // 3. Merges — clear all then re-apply from snapshot
      if (!deepEqual(sheetData.mergeData, localSheet.mergeData)) {
        ws.getMergeData().forEach(r => r.breakApart());
        for (const m of (sheetData.mergeData ?? [])) {
          const numRows = m.endRow - m.startRow + 1;
          const numCols = m.endColumn - m.startColumn + 1;
          ws.getRange(m.startRow, m.startColumn, numRows, numCols)
            .merge({ isForceMerge: true, defaultMerge: true });
        }
      }

      // 4. Row heights
      const inRows = sheetData.rowData ?? {};
      const loRows = localSheet.rowData ?? {};
      const rowKeys = new Set([...Object.keys(inRows), ...Object.keys(loRows)].map(Number));
      for (const rowIdx of rowKeys) {
        const inH = inRows[rowIdx]?.h;
        const loH = loRows[rowIdx]?.h;
        if (inH != null && inH !== loH) ws.setRowHeight(rowIdx, inH);
      }

      // 5. Column widths
      const inCols = sheetData.columnData ?? {};
      const loCols = localSheet.columnData ?? {};
      const colKeys = new Set([...Object.keys(inCols), ...Object.keys(loCols)].map(Number));
      for (const colIdx of colKeys) {
        const inW = inCols[colIdx]?.w;
        const loW = loCols[colIdx]?.w;
        if (inW != null && inW !== loW) ws.setColumnWidth(colIdx, inW);
      }

      // 6. Freeze panes
      if (!deepEqual(sheetData.freeze, localSheet.freeze)) {
        const freeze = sheetData.freeze;
        if (freeze) {
          const startRow = freeze.startRow ?? 0;
          const startCol = freeze.startColumn ?? 0;
          if (freeze.ySplit) ws.setFrozenRows(startRow, startRow + freeze.ySplit);
          if (freeze.xSplit) ws.setFrozenColumns(startCol, startCol + freeze.xSplit);
        }
      }

      // 7. Sheet name
      if (sheetData.name && sheetData.name !== localSheet.name) {
        ws.setName(sheetData.name);
      }

      // 8. Tab color
      if (sheetData.tabColor !== localSheet.tabColor && sheetData.tabColor != null) {
        ws.setTabColor(sheetData.tabColor);
      }

      // 9. Conditional formatting rules
      const inCFRules = inCFBySheet[sheetId] ?? [];
      const loCFRules = loCFBySheet[sheetId] ?? [];
      if (!deepEqual(inCFRules, loCFRules)) {
        (ws as any).clearConditionalFormatRules?.();
        for (const rule of inCFRules) {
          (ws as any).addConditionalFormattingRule?.(rule);
        }
      }

      // 10. Hyperlinks — remove stale, update changed, add new
      const inLinks: any[] = inLinkBySheet[sheetId] ?? [];
      const loLinks: any[] = loLinkBySheet[sheetId] ?? [];
      if (!deepEqual(inLinks, loLinks)) {
        const loLinkMap = new Map(loLinks.map((l: any) => [l.id, l]));
        const inLinkIds = new Set(inLinks.map((l: any) => l.id));
        // Cancel links no longer present
        for (const link of loLinks) {
          if (!inLinkIds.has(link.id)) {
            (ws.getRange(link.row, link.column) as any).cancelHyperLink?.(link.id);
          }
        }
        // Add new or update changed links
        for (const link of inLinks) {
          const existing = loLinkMap.get(link.id);
          if (!existing) {
            await (ws.getRange(link.row, link.column) as any).setHyperLink?.(link.payload, link.display ?? '');
          } else if (!deepEqual(link, existing)) {
            await (ws.getRange(link.row, link.column) as any).updateHyperLink?.(link.id, link.payload, link.display ?? '');
          }
        }
      }

      // 11. Drawings/images — delete removed, update changed, insert new
      const inImgsItem = (inImgBySheet[sheetId] as any) ?? {};
      const loImgsItem = (loImgBySheet[sheetId] as any) ?? {};
      const inImgsData: Record<string, any> = inImgsItem.data ?? {};
      const loImgsData: Record<string, any> = loImgsItem.data ?? {};
      if (!deepEqual(inImgsData, loImgsData)) {
        const inImgIds = new Set(Object.keys(inImgsData));
        const loImgIds = new Set(Object.keys(loImgsData));
        // Delete drawings no longer present
        const existingImages: any[] = (ws as any).getImages?.() ?? [];
        const toDelete = existingImages.filter((img: any) => !inImgIds.has(img.getId?.()));
        if (toDelete.length) (ws as any).deleteImages?.(toDelete);
        // Update drawings that exist in both but have changed (resize, move)
        const toUpdate = Object.values(inImgsData).filter((d: any) =>
          loImgIds.has(d.drawingId) && !deepEqual(d, loImgsData[d.drawingId])
        );
        if (toUpdate.length) (ws as any).updateImages?.(toUpdate);
        // Insert new drawings
        const toInsert = Object.values(inImgsData).filter((d: any) => !loImgIds.has(d.drawingId));
        if (toInsert.length) (ws as any).insertImages?.(toInsert);
      }

      // 12. Data validation rules — remove, update, add
      const inDVRules: any[] = inDVBySheet[sheetId] ?? [];
      const loDVRules: any[] = loDVBySheet[sheetId] ?? [];
      if (!deepEqual(inDVRules, loDVRules)) {
        const loDVMap = new Map(loDVRules.map((r: any) => [r.uid, r]));
        const inDVMap = new Map(inDVRules.map((r: any) => [r.uid, r]));
        // Remove rules no longer present
        for (const rule of loDVRules) {
          if (!inDVMap.has(rule.uid)) {
            for (const range of (rule.ranges ?? [])) {
              ws.getRange(range.startRow, range.startColumn,
                range.endRow - range.startRow + 1,
                range.endColumn - range.startColumn + 1
              ).setDataValidation(null);
            }
          }
        }
        // Add new or update changed rules
        for (const rule of inDVRules) {
          const existing = loDVMap.get(rule.uid);
          if (!existing || !deepEqual(rule, existing)) {
            const dvRule = new FDataValidationBuilder(rule).build();
            for (const range of (rule.ranges ?? [])) {
              ws.getRange(range.startRow, range.startColumn,
                range.endRow - range.startRow + 1,
                range.endColumn - range.startColumn + 1
              ).setDataValidation(dvRule);
            }
          }
        }
      }
    }

    // 13. Remove deleted sheets
    for (const [sheetId, ws] of localSheets) {
      if (!incoming.sheets[sheetId]) wb.deleteSheet(ws);
    }

    // Restore the originally active sheet (we may have switched away to trigger re-renders)
    if (originalActiveSheet && originalActiveSheet.getSheetId() !== wb.getActiveSheet()?.getSheetId()) {
      originalActiveSheet.activate();
    }
  } finally {
    applyingRemoteChange = false;
  }
}

const { getStore } :any = getContext("store");
let store: CalcyStore = getStore();
// const univerAPI = FUniver.newAPI(univer);

export let tabView = false;
export let activeBoard: Board
export let standAlone = false

$: uiProps = store.uiProps
$: participants = activeBoard.participants()
$: sessionStore = activeBoard.session
$: activeHashB64 = store.boardList.activeBoardHashB64;
$: synState = activeBoard.readableState()

// Dev-only, stripped from release builds. syn writes a commit every
// CommitEveryNDeltas (30) changes or CommitEveryNMs (10s), whichever comes
// first, and caps a delta chain at SnapshotEveryNCommits (20) before writing a
// fresh snapshot. The R11 walk needs to know where a board sits in that cycle
// and there is no UI for it, so expose a counter:
//   await boardCommits()   -> number of commits on this board
$: if (TRACE && activeBoard) armDevHelpers(activeBoard);

let devArmedFor: any = null;
let devCommitsUnsub: (() => void) | null = null;
let devLastCommitCount = -1;
function armDevHelpers(board: any) {
  if (!TRACE || devArmedFor === board) return;
  devArmedFor = board;
  const w = window as any;
  w.board = board;
  w.boardCommits = () =>
    new Promise((resolve) => {
      const unsub = board.document.allCommits.subscribe((s: any) => {
        if (s.status === 'complete') { resolve(s.value.size); setTimeout(() => unsub(), 0) }
        else if (s.status === 'error') { resolve(s); setTimeout(() => unsub(), 0) }
      });
    });
  // Log the count as it changes, so the R11 walk does not need the console to be
  // pointed at this iframe at all -- Moss renders each applet in its own frame,
  // and `boardCommits` lives on THAT frame's window, not the top one.
  devCommitsUnsub?.();
  devLastCommitCount = -1;
  devCommitsUnsub = board.document.allCommits.subscribe((s: any) => {
    if (s.status !== 'complete') return;
    const n = s.value.size;
    if (n === devLastCommitCount) return;
    devLastCommitCount = n;
    console.log(`[sweet dev] syn commits: ${n}`);
  });
  console.log(
    `[sweet dev] helpers armed on ${window.location.origin} -- boardCommits(), board, __traceDump(), __traceClear().\n` +
    `[sweet dev] if calling them says "not defined", switch the devtools console's frame selector to this origin.`
  );
}
$: if ($synState && univerAPI && sheet) {
  // The reconciler is deliberately NOT wired to this reaction.
  //
  // updateSheet() reconciles the live workbook to `state.spreadsheet`, but that
  // snapshot is written exactly once -- by Board.Create's set-state -- and never
  // again: `set-spreadsheet` and `execute-command-batch` are declared in
  // board.ts and handled in the reducer, but dispatched nowhere. So the snapshot
  // is frozen at the board's creation state, the command log below is the real
  // source of truth (a reload rebuilds every sheet from it), and every run of
  // updateSheet() could only revert the board towards creation state -- step 13
  // deleting every sheet the snapshot doesn't have, step 9 clearing conditional
  // formatting it doesn't know about.
  //
  // Guarding the trigger was not enough. It was first an identity comparison,
  // then a content one, and the reconciler still fired: `previousSpreadsheet`
  // holds a reference into a syn Automerge document, and syn frees superseded
  // documents (`freeDoc`/`freeDocLater` in @holochain-syn/store), so the
  // baseline being compared against is not stable in the first place. Rather
  // than keep guessing at a comparison that survives that, don't call it: while
  // nothing writes the snapshot the reconciler has no work to do, by
  // construction.
  //
  // updateSheet() is kept, and is correct, for when a real snapshot write is
  // wired up -- `execute-command-batch` is exactly that path. Re-enable it here
  // in the same change.
  replayPendingCommands()
}

const saveSheetCommand = async (command) => {
  const syncId = uuidv1();
  appliedCommandIds.add(syncId);
  if (TRACE) trace('send-to-syn', { id: command.id, syncId });

  activeBoard.requestChanges([
    {
      type: "execute-command",
      command: {
        syncId,
        id: command.id,
        params: JSON.parse(JSON.stringify(command.params ?? {})),
      },
    },
  ]);
}

const closeBoard = async () => {
  await store.closeActiveBoard(false);
};

const leaveBoard = async () => {
  await store.closeActiveBoard(true);
};

let editBoardDialog

const close = ()=> {
}


const doFocus = (node) => {
  // otherwise we get an error from the shoelace element
  setTimeout(() => {
    node.focus()
  }, 50);
}

let attachmentsDialog : AttachmentsDialog

const removeAttachment = (props: BoardProps, idx: number) => {
  let newProps = cloneDeep(props)
  newProps.attachments.splice(idx,1)
  activeBoard.requestChanges([{type: 'set-props', props : newProps }])
}

let univerAPI;
let univer;

onMount(async () => {
  const createRes = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
    sheetsCoreEnUS,
    sheetsConditionalFormattingEnUS,
    sheetsDataValidationEnUS,
    sheetsDrawingEnUS,
    sheetsFilterEnUS,
    sheetsHyperLinkEnUS,
      ),
    },
    theme: defaultTheme,
    presets: [
      UniverSheetsCorePreset(),
      UniverSheetsConditionalFormattingPreset(),
      UniverSheetsDataValidationPreset(),
      UniverSheetsDrawingPreset(),
      UniverSheetsFilterPreset(),
      UniverSheetsHyperLinkPreset(),
    ],
  });

  univerAPI = createRes.univerAPI
  univer = createRes.univer

  // registerPlugins()
  // const savedBoard = await activeBoard.readableState()
  // sheet = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
  // console.log("savedBoard", savedBoard)
  sheet = univerAPI.createWorkbook($synState.spreadsheet);
  // sheet = univer.createUniverDoc($synState.spreadsheet);

  commandService = (univerAPI as any)._injector.get(ICommandService)
  previousSpreadsheet = $synState.spreadsheet
  replayPendingCommands()

  sheet.onCommandExecuted((command) => {
    const captured = !applyingRemoteChange && command.id.startsWith('sheet.mutation.');
    if (TRACE) trace('univer-command', { id: command.id, captured, applyingRemoteChange });
    if (captured) {
      console.log("Command executed", command)
      saveSheetCommand(command);
    }
  })
});

const test = () => {
  console.log("this is a test")
}
  
  const copyWalToPocket = () => {
    const attachment: WAL = {
        hrl: [store.dnaHash, activeBoard.hash],
        context: JSON.stringify({docType: 'spreadsheet'}),
      };
      console.log("attachment", attachment)
      store.weClient?.assets.assetToPocket(attachment);
  }

</script>
<div class="board" >
  <!-- {JSON.stringify($synState.spreadsheet.sheets["sheet-01"])} -->
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
    <!-- <div class="top-bar"> -->
      <div class="left-items">
        {#if standAlone}
          <h2>{$synState.name}</h2>
          {:else}

          {#if !tabView}
            <button  class="board-button close" on:click={closeBoard} title="Close">
              <SvgIcon icon=faClose size="16px"/>
            </button>
          {/if}

          <input
            type="text"
            value={$synState.name}
            on:input={(e) => {
              activeBoard.requestChanges([{type: 'set-name', name: e.target.value}])
            }}
            on:blur={(e) => {
              activeBoard.requestChanges([{type: 'set-name', name: e.target.value}])
            }}
            on:keydown={(e) => {
              if (e.key === "Enter") {
                e.target.blur()
              }
            }}
            style="font-size: 16px; font-weight: bold; border: none; background: transparent; color: rgba(86, 92, 108, 1.0); width: 120px;"
          />
          <sl-dropdown class="board-options board-menu" skidding=15>
            <sl-button slot="trigger"   class="board-button settings" caret>&nbsp;</sl-button>
              <!-- editable name input -->
            <sl-menu className="settings-menu">
              <sl-menu-item on:click={()=> editBoardDialog.open(cloneDeep(activeBoard.hash))} class="board-settings" >
                  <SvgIcon icon="faCog"  style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px"/> <span>Settings</span>
              </sl-menu-item>
              <sl-menu-item on:click={() => exportBoard($synState)} title="Export" class="board-export" >
                <SvgIcon icon="faFileExport"  style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px" /> <span>Export</span>
              </sl-menu-item>
              <sl-menu-item on:click={() => {
                store.archiveBoard(activeBoard.hash)
                }} title="Archive" class="board-archive" >
                <SvgIcon icon="faArchive" style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px" /> <span>Archive</span>
              </sl-menu-item>
              <sl-menu-item  on:click={leaveBoard} class="leave-board" >
                  <SvgIcon icon="faArrowTurnDown" style="background: transparent; opacity: .5; position: relative; top: -2px;" size="12px" /> <span>Leave board</span>
              </sl-menu-item>
            </sl-menu>
          </sl-dropdown>
          {#if store.weClient}
            <AttachmentsDialog activeBoard={activeBoard} bind:this={attachmentsDialog}></AttachmentsDialog>
            {#if $synState.boundTo.length>0}
              <div style="margin-left:10px;display:flex; align-items: center">
                <span style="margin-right: 5px;">Bound To:</span>
                <AttachmentsList allowDelete={false} attachments={$synState.boundTo} />
              </div>
            {/if}
            <div style="margin-left:10px; margin-top:2px;display:flex">
              <button title="Add Board to Pocket" class="attachment-button" style="margin-right:10px" on:click={()=>copyWalToPocket()} >          
                <SvgIcon icon="addToPocket" size="20px"/>
              </button>
              <button class="attachment-button" style="margin-right:10px" on:click={()=>attachmentsDialog.open(undefined)} >          
                <SvgIcon icon="link" size="16px"/>
              </button>
              {#if $synState.props.attachments}
                <AttachmentsList attachments={$synState.props.attachments}
                  allowDelete={false}/>
              {/if}
            </div>
          {/if}
    
        {/if}
      </div>
      <div class="right-items">
        {#if participants}
          <div class="participants">
            <div style="display:flex; flex-direction: row; transform: scale(0.8); transform-origin: right center;">
              <session-participants direction="row" showOffline={true} sessionstore={sessionStore} />
            </div>
          </div>
        {/if}
  
      </div>
    <!-- </div> -->
  {#if $synState}
  <!-- <button on:click={saveSheet}>Save</button> -->
  <!-- <div id="spreadsheet" style="height:100%; position: relative; top: -32px;"> -->
    <div id="app" style="height:100vh; position: relative;">
      <!-- <ReactAdapter
        el={Workbook}
        data={[{ name: "Sheet1", rows:20}]} 
      /> -->
    </div>
  {/if}
  <!-- <div class="bottom-fade"></div> -->
</div>
<style>
  .univer-menubar {
    height: 0px !important;
  }
  
  .board {
    display: flex;
    flex-direction: column;
    background: transparent;
    border-radius: 0;
    min-height: 0;
    overflow-x: auto;
    width: 100%;
    position: relative;
    max-height: calc(100vh - 50px);
  }
  .top-bar {
    border-bottom: 1px solid rgba(35, 32, 74, 0.1);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background-color: #fff;
    padding-left: 10px;
    padding-right: 10px;
    border-radius: 0;
    position: sticky;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 200;
    color: white
  }
  .left-items {
    display: flex;
    align-items: center;
    float: left;
    position: absolute;
    z-index: 25;
  }
  .right-items {
    display: flex;
    align-items: center;
    right: 0;
    position: absolute;
    z-index: 25;
  }

  sl-button.board-button::part(base) {
    background-color: transparent;
  }

  .board-button.close {
    margin-left: 0;
    margin-right: 5px;
  }

  .board-button.close::part(base) {
    font-size: 16px;
    line-height: 36px;
  }

  .right-items .board-button::part(base) {
    font-size: 24px;
  }
  
  .board-button {
    margin-left: 10px;
  }

  .board-button.settings {
    width: auto;
    margin-left: 0;
  }
  .board-options .board-settings {
    width: 100%;
    position: relative;
  }
  .board-options .board-settings span, .board-export span, .board-archive span, .board-options .leave-board span, .board-options .participants span {
    font-size: 16px;
    font-weight: bold;
  }

  .board-button.settings:hover {
    transform: scale(1.1);
  }

  .board-button.settings::part(base) {
    width: auto;
    font-size: 18px;
    font-weight: bold;
    color: rgba(86, 92, 108, 1.0);
  }

  .board-button.settings::part(label) {
    padding: 0 0 0 0;
    height: 36px;
    line-height: 36px;
  }

  .board-button.settings:hover {
    opacity: 1;
  }

  .board-button::part(base) {
    border: none;
    padding: 0;
    margin: 0;
  }
  
  .board-button {
    width: 30px;
    height: 30px;
    /* background: #FFFFFF; */
    background: transparent;
    /* border: 1px solid rgba(35, 32, 74, 0.1); */
    border: none;
    /* box-shadow: 0px 4px 4px rgba(66, 66, 66, 0.1); */
    border-radius: 5px;
    /* padding: 3px 6px; */
    padding: 0;
    display: flex;
    transform: scale(1);
    align-items: center;
    justify-content: center;
    transition: all .1s ease;
  }
  
  .board-button:hover {
    /* background-color: rgb(233, 233, 233); */
    transform: scale(1.2);
  }

  .board-button:active {
    box-shadow: 0px 8px 10px rgba(53, 39, 211, 0.35);
    transform: scale(1.1);
  }

  sl-menu-item::part(checked-icon) {
    display: none;
  }

  sl-menu-item::part(base) {
    padding-left: 8px;
  }


  .bottom-fade {
    position: fixed;
    bottom: 0;
    z-index: 100;
    width: 100%;
    height: 20px;
    bottom: 10px;
    background: linear-gradient(180deg, rgba(189, 209, 230, 0) 0%, rgba(102, 138, 174, 0.81) 100%);
    opacity: 0.4;
  }
  

  .board::-webkit-scrollbar {
    height: 10px;
    background-color: transparent;
  }

  .board::-webkit-scrollbar-thumb {
    border-radius: 0 0 0 0;
    background: rgba(20,60,119,.7);
    /* background: linear-gradient(180deg, rgba(20, 60, 119, 0) 0%, rgba(20,60,119,.6) 100%); */
  }


  :global(.attachment-button) {
    width: 30px;
    height: 30px;
    padding: 4px;
    border-radius: 50%;
    /* border: 1px solid rgba(235, 235, 238, 1.0); */
    border: none;
    /* background-color: rgba(255,255,255,.8);     */
    background: transparent;
  }
  :global(.attachment-button:hover) {
    transform: scale(1.25);
  }
  .idle {
    opacity: 0.5;
  }
</style>