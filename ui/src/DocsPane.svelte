<script lang="ts">
  import { getContext, onMount } from "svelte";
  import type { CalcyStore } from "./store";
  import { v1 as uuidv1 } from "uuid";
  import type {  Board, BoardDelta, BoardProps } from "./board";
  import EditBoardDialog from "./EditBoardDialog.svelte";
  import Avatar from "./Avatar.svelte";
  import { decodeHashFromBase64,encodeHashToBase64, type Timestamp } from "@holochain/client";
  import { cloneDeep, isEqual } from "lodash";
  import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
  import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
  import ClickEdit from "./ClickEdit.svelte";
  import { onVisible } from "./util";
  import SvgIcon from "./SvgIcon.svelte";
  import { exportBoard } from "./export";
  import AttachmentsList from './AttachmentsList.svelte';
  import AttachmentsDialog from "./AttachmentsDialog.svelte"
  import type { AppClient } from '@holochain/client';

  import type { WAL } from "@lightningrodlabs/we-applet";
  import '@lightningrodlabs/we-elements/dist/elements/wal-embed.js';

  // import  {Workbook}  from "@fortune-sheet/react";
  // import ReactAdapter from "./ReactAdapter.svelte";
  // import "@fortune-sheet/react/dist/index.css"
  import type { IWorkbookData } from '@univerjs/core';

  import "@univerjs/design/lib/index.css";
  import "@univerjs/ui/lib/index.css";
  import "@univerjs/sheets-ui/lib/index.css";
  import "@univerjs/sheets-formula/lib/index.css";
  import "@univerjs/sheets-numfmt/lib/index.css";
  import '@univerjs/thread-comment-ui/lib/index.css';

  // import { Univer, LocaleType, Tools, LogLevel } from "@univerjs/core";
  
  import ThreadCommentUIEnUS from '@univerjs/thread-comment-ui/locale/en-US';
  import SheetsThreadCommentEnUS from '@univerjs/sheets-thread-comment/locale/en-US';
  import DesignEnUS from '@univerjs/design/locale/en-US';
  import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
  import SheetsEnUS from '@univerjs/sheets/locale/en-US';
  import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
  import UIEnUS from '@univerjs/ui/locale/en-US';

  import { LocaleType, LogLevel, Univer, UniverInstanceType, UserManagerService , Tools} from '@univerjs/core';
  import { defaultTheme } from '@univerjs/design';
  import { UniverDocsPlugin } from '@univerjs/docs';
  import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
  import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
  import { UniverSheetsPlugin } from '@univerjs/sheets';
  import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
  import { UniverUIPlugin } from '@univerjs/ui';
  import { UniverSheetsConditionalFormattingUIPlugin } from '@univerjs/sheets-conditional-formatting-ui';
  import { UniverSheetsThreadCommentPlugin } from '@univerjs/sheets-thread-comment';
  import { UniverDebuggerPlugin } from '@univerjs/debugger';
  import { UniverSheetsHyperLinkUIPlugin } from '@univerjs/sheets-hyper-link-ui';
  import { IThreadCommentMentionDataService, UniverThreadCommentUIPlugin } from '@univerjs/thread-comment-ui';
  import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
  import type { IUniverRPCMainThreadConfig } from '@univerjs/rpc';
  import { UniverRPCMainThreadPlugin } from '@univerjs/rpc';
  import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
  import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
  import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';
  import { UniverSheetsDrawingUIPlugin } from '@univerjs/sheets-drawing-ui';
  import { UniverSheetsZenEditorPlugin } from '@univerjs/sheets-zen-editor';
  import { UniverSheetsSortPlugin } from '@univerjs/sheets-sort';
  import { UniverSheetsSortUIPlugin } from '@univerjs/sheets-sort-ui';
  
  import { FUniver } from "@univerjs/facade";
  import { spread } from "svelte/internal";
  import App from "./App.svelte";

  export let activeBoard: Board
  export let myProfile;
  export let participants; //this is to make sure they are available on load
  export let standAlone = false

  const delay = ms => new Promise(res => setTimeout(res, ms));
  let currentSheet;
  let funiver;

  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: Tools.deepMerge(
        DesignEnUS,
        DocsUIEnUS,
        SheetsEnUS,
        SheetsUIEnUS,
        UIEnUS,
        ThreadCommentUIEnUS,
        SheetsThreadCommentEnUS
      ),
    },
  });
  
 // core plugins
univer.registerPlugin(UniverDocsPlugin, {
    hasScroll: false,
});
univer.registerPlugin(UniverRenderEnginePlugin);
univer.registerPlugin(UniverUIPlugin, {
    container: "spreadsheet",
    header: true,
    toolbar: true,
    footer: true,
  });
// window.univerAPI = FUniver.newAPI(univer);

univer.registerPlugin(UniverDocsUIPlugin);

univer.registerPlugin(UniverSheetsPlugin, {
    notExecuteFormula: true,
});
univer.registerPlugin(UniverSheetsUIPlugin);

// sheet feature plugins

univer.registerPlugin(UniverSheetsNumfmtPlugin);
univer.registerPlugin(UniverSheetsZenEditorPlugin);
univer.registerPlugin(UniverFormulaEnginePlugin, {
    notExecuteFormula: true,
});
univer.registerPlugin(UniverSheetsFormulaPlugin);
univer.registerPlugin(UniverRPCMainThreadPlugin, {
    workerURL: './worker.js',
} as IUniverRPCMainThreadConfig);

univer.registerPlugin(UniverSheetsHyperLinkUIPlugin);

// data validation
univer.registerPlugin(UniverSheetsDataValidationPlugin);

// sort
univer.registerPlugin(UniverSheetsSortPlugin);
univer.registerPlugin(UniverSheetsSortUIPlugin);

// sheet condition formatting
univer.registerPlugin(UniverSheetsConditionalFormattingUIPlugin);

// drawing
univer.registerPlugin(UniverSheetsDrawingUIPlugin);
  const mockUser = {
    userID: myProfile.agentPubKey,
    name: myProfile.entry.nickname || "Anonymous User",
    avatar: myProfile.entry.fields.avatar,
    anonymous: false,
    canBindAnonymous: false,
  };

  class CustomMentionDataService implements IThreadCommentMentionDataService {
    trigger: string = '@';

    async getMentions() {
      return [
          {
              id: mockUser.userID,
              label: mockUser.name,
              type: 'user',
              icon: mockUser.avatar,
              anonymous: false,
              canBindAnonymous: false,
          },
          // {
          //     id: '2',
          //     label: 'User2',
          //     type: 'user',
          //     icon: mockUser.avatar,
          // },
      ];
    }
  }

  univer.registerPlugin(UniverSheetsThreadCommentPlugin);

  univer.registerPlugin(UniverThreadCommentUIPlugin, {
      overrides: [[IThreadCommentMentionDataService, { useClass: CustomMentionDataService }]],
  });

  const maybeSave = async () =>{
    await delay(100)
    const previousVersion = JSON.stringify(previousState)
    const newVersion = JSON.stringify($synState)
    // console.log(previousVersion)
    // console.log("-------------")
    // console.log(newVersion)
    // if (previousVersion !== newVersion) {
      // console.log("unsaved changes")
      saveSheet()
    // }
  }

  const updateSheet = async () => {
    // await delay(100)
    console.log("updating sheet", currentSheet.save())
    console.log("hijhhih")
    // const activeSheet = funiver.getActiveWorkbook().getActiveSheet();
    const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
    console.log("SNAPSHOT", univerAPI.getActiveWorkbook().getSnapshot());
    console.log("hjhhhj")
    const spreadsheet = $synState.spreadsheet.sheets
    // console.log("spreadsheet", spreadsheet)
    const localState = currentSheet.save().sheets;
    // const localState = univerAPI.getActiveWorkbook().getSnapshot().sheets;
    console.log("localState", localState)
    let changed = false;

    // for each sheet in spreadsheet
    for (const sheet in spreadsheet) {
      // console.log("sheet", sheet)
      let fullRange = activeSheet.getRange(1, 1, 100, 100);
      // let replacementRange = spreadsheet[sheet].cellData;
      // console.log("fullRange", fullRange)
      // console.log("replacementRange", replacementRange)

      // console.log("compromiseValue", localState[sheet].cellData)
      let compromiseValue = {...localState[sheet].cellData}
      // for each cell in sheet
      // console.log("sheet", spreadsheet[sheet].cellData)
      for (const row in spreadsheet[sheet].cellData) {
        if (compromiseValue[row] === undefined) {
          compromiseValue[row] = {}
        }
        // console.log("row", row)
        for (const col in spreadsheet[sheet].cellData[row]) {
          if (compromiseValue[row][col] === undefined) {
            compromiseValue[row][col] = {}
          }
          // console.log("col", col, row, spreadsheet[sheet].cellData[row][col])
          const previousValue = compromiseValue[row][col]
          const newValue = spreadsheet[sheet].cellData[row][col]
          // check if object values in previousValue differ from newValue
          if (!isEqual(previousValue, newValue)) {
            // let microRange = activeSheet.getRange(row, col, 1, 1);
            // microRange.setValue(newValue)
            compromiseValue[row][col] = newValue
            changed = true;
          } //else {
            // console.log("no update", previousValue.v, newValue.v)
          // }
        }
      }

      if (changed) {
        fullRange.setValues(compromiseValue);
      }
    }
  }

  function checkKey(e: any) {
    if (["Enter", 
        "Tab", 
        "ArrowUp", 
        "ArrowDown", 
        "ArrowLeft", 
        "ArrowRight", 
        "Backspace", 
        "Delete", 
        "Escape", 
        "Home", 
        "End", 
        "PageUp", 
        "PageDown"
      ].includes(e.key) && !e.shiftKey) {
    //   e.preventDefault();
    //   open = false;
        maybeSave()
    }
  }

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();
  const univerAPI = FUniver.newAPI(univer);
  
  let previousState = {};
  $: uiProps = store.uiProps
  // $: participants = activeBoard.participants()
  $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: synState = activeBoard.readableState()
  $: if ($synState && funiver) {
    console.log("state change", $synState)
    updateSheet()
    // const s = sheet.getActiveSheet()
    // console.log(sheet.activeSheet())
    // const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
    // console.log("activeSheet", activeSheet)
  }

  const saveSheet = async () => {
    console.log("saving sheet")
    const sheetData = currentSheet.save();
    const sheetData2 = univerAPI.getActiveWorkbook().getSnapshot();
    console.log("sheetData", sheetData)
    sheetData.resources = sheetData2.resources
    // sheetData.styles = sheetData2.styles
    // console.log("sheetData2", sheetData2)
    // console.log("sheetData", sheetData.sheets["sheet-01"])
    // console.log("sheetData2", sheetData.sheets["sheet-02"])
    // state.spreadsheet = sheetData;
    // change state update spreadsheet
    
    let changes: BoardDelta[] = [{
      type: "set-spreadsheet",
      spreadsheet: sheetData
    }]
    activeBoard.requestChanges(changes)
    previousState = {...cloneDeep($synState)}
    // console.log("previous state set", previousState)

    // const l = await activeBoard.readableState()
    // console.log("active board", l)
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

  onMount(async () => {
    console.log("previous state set", previousState)
    const savedBoard = await activeBoard.readableState()
    console.log($synState.spreadsheet)
    // sheet = univer.createUniverSheet($synState.spreadsheet);
    currentSheet = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
    console.log(currentSheet)
    // sheet = univer.createUniverDoc($synState.spreadsheet);

    previousState = cloneDeep($synState)
    console.log("clonedeep", previousState)
    window.addEventListener("keydown", checkKey);

    funiver = FUniver.newAPI(univer);
    console.log("funiver", funiver)
	});
  
  const copyWalToPocket = () => {
    const attachment: WAL = { hrl: [store.dnaHash, activeBoard.hash], context: "" }
    store.weClient?.walToPocket(attachment)
  }

</script>
HI
<div class="board" >
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
  <div class="top-bar">
    <div class="left-items">
      {#if standAlone}
        <h2>{$synState.name}</h2>
      {:else}
        <sl-button  class="board-button close" on:click={closeBoard} title="Close">
          <SvgIcon icon=faClose size="16px"/>
        </sl-button>
        <sl-dropdown class="board-options board-menu" skidding=15>
          <sl-button slot="trigger"   class="board-button settings" caret>{$synState.name}</sl-button>
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
          <div style="display:flex; flex-direction: row">
            <Avatar agentPubKey={store.myAgentPubKey} showNickname={false} size={30} />

            {#each Array.from(participants.entries()) as [agentPubKey, sessionData]}
            <div class:idle={Date.now()-sessionData.lastSeen >30000}>
              <Avatar agentPubKey={agentPubKey} showNickname={false} size={30} />
            </div>
            {/each}

          </div>
        </div>
      {/if}

    </div>
  </div>
  {#if $synState}
   <div id="spreadsheet" style="height:100%; position: relative;" on:click={maybeSave}></div>
  {/if}
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
  }
  .right-items {
    display: flex;
    align-items: center;
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
    background: #FFFFFF;
    border: 1px solid rgba(35, 32, 74, 0.1);
    box-shadow: 0px 4px 4px rgba(66, 66, 66, 0.1);
    border-radius: 5px;
    padding: 5px 10px;
    display: flex;
    transform: scale(1);
    align-items: center;
    justify-content: center;
    transition: all .25s ease;
  }
  
  .board-button:hover {
    transform: scale(1.25);
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
    border: 1px solid rgba(235, 235, 238, 1.0);
    background-color: rgba(255,255,255,.8);    
  }
  :global(.attachment-button:hover) {
    transform: scale(1.25);
  }
  .idle {
    opacity: 0.5;
  }

</style>
