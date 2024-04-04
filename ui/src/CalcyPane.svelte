<script lang="ts">
  import { getContext, onMount } from "svelte";
  import type { CalcyStore } from "./store";
  import { v1 as uuidv1 } from "uuid";
  import type {  Board, BoardDelta, BoardProps } from "./board";
  import EditBoardDialog from "./EditBoardDialog.svelte";
  import Avatar from "./Avatar.svelte";
  import { decodeHashFromBase64, type Timestamp } from "@holochain/client";
  import { cloneDeep, isEqual } from "lodash";
  import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
  import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
  import ClickEdit from "./ClickEdit.svelte";
  import { onVisible } from "./util";
  import SvgIcon from "./SvgIcon.svelte";
  import { exportBoard } from "./export";
  import AttachmentsList from './AttachmentsList.svelte';
  import AttachmentsDialog from "./AttachmentsDialog.svelte"

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

  import { enUS as UniverDesignEnUS } from '@univerjs/design';
  // import { enUS as UniverDocsUIEnUS } from '@univerjs/docs-ui';
  import { enUS as UniverSheetsEnUS } from '@univerjs/sheets';
  import { enUS as UniverSheetsUIEnUS } from '@univerjs/sheets-ui';
  import { enUS as UniverUiEnUS } from '@univerjs/ui';

  import { Univer, LocaleType, LogLevel } from "@univerjs/core";
  import { defaultTheme } from "@univerjs/design";
  import { UniverDocsPlugin } from "@univerjs/docs";
  import { UniverDocsUIPlugin } from "@univerjs/docs-ui";
  import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";
  import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
  import { UniverSheetsPlugin } from "@univerjs/sheets";
  import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
  import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
  import { UniverUIPlugin } from "@univerjs/ui";

  // import {Univer } from "@univerjs/core";
  // import { defaultTheme } from "@univerjs/design";
  // import { UniverDocsPlugin } from "@univerjs/docs";
  // import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";
  // import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
  // import { UniverSheetsPlugin } from "@univerjs/sheets";
  // import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
  // import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
  // import { UniverUIPlugin } from "@univerjs/ui";
  import { FUniver } from "@univerjs/facade";
  // import FUniver from "@univerjs/facade";

  import { spread } from "svelte/internal";

  const delay = ms => new Promise(res => setTimeout(res, ms));
  let sheet;
  let funiver;

  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    logLevel: LogLevel.VERBOSE,

    locales: {
      [LocaleType.EN_US]: {
        ...UniverSheetsEnUS,
        ...UniverSheetsUIEnUS,
        ...UniverUiEnUS,
        ...UniverDesignEnUS,
      },
    }
  });

  // doc plugins
  univer.registerPlugin(UniverDocsPlugin, {
    hasScroll: false,
  });
  univer.registerPlugin(UniverDocsUIPlugin);

  // core plugins
  univer.registerPlugin(UniverRenderEnginePlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin);
  univer.registerPlugin(UniverUIPlugin, {
    container: "spreadsheet",
    header: true,
    toolbar: true,
    footer: true,
  });


  // sheet plugins
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverSheetsUIPlugin);

  // sheet feature plugins
  univer.registerPlugin(UniverSheetsFormulaPlugin);

  const maybeSave = async () =>{
    await delay(100)
    const previousVersion = JSON.stringify(previousState)
    const newVersion = JSON.stringify($state)
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
    console.log("updating sheet")
    const activeSheet = funiver.getActiveWorkbook().getActiveSheet();
    const spreadsheet = $state.spreadsheet.sheets
    // console.log("spreadsheet", spreadsheet)
    const localState = sheet.save().sheets;
    // console.log("localState", localState)
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
  // const univerAPI = FUniver.newAPI(univer);

  export let activeBoard: Board
  export let standAlone = false
  
  let previousState = {};
  $: uiProps = store.uiProps
  $: participants = activeBoard.participants()
  $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: state = activeBoard.readableState()
  $: if ($state && funiver) {
    console.log("state change", $state)
    updateSheet()
    // const s = sheet.getActiveSheet()
    // console.log(sheet.activeSheet())
    // const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
    // console.log("activeSheet", activeSheet)
  }

  const saveSheet = async () => {
    console.log("saving sheet")
    const sheetData = sheet.save();
    // console.log("sheetData", sheetData.sheets["sheet-01"])
    // console.log("sheetData2", sheetData.sheets["sheet-02"])
    // state.spreadsheet = sheetData;
    // change state update spreadsheet
    
    let changes: BoardDelta[] = [{
      type: "set-spreadsheet",
      spreadsheet: sheetData
    }]
    activeBoard.requestChanges(changes)
    previousState = {...cloneDeep($state)}
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
    console.log($state.spreadsheet)
    sheet = univer.createUniverSheet($state.spreadsheet);
    console.log(sheet)
    // sheet = univer.createUniverDoc($state.spreadsheet);

    previousState = cloneDeep($state)
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
<div class="board" >
  <!-- {JSON.stringify($state.spreadsheet.sheets["sheet-01"])} -->
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
  <div class="top-bar">
    <div class="left-items">
      {#if standAlone}
        <h2>{$state.name}</h2>
      {:else}
        <sl-button  class="board-button close" on:click={closeBoard} title="Close">
          <SvgIcon icon=faClose size="16px"/>
        </sl-button>
        <sl-dropdown class="board-options board-menu" skidding=15>
          <sl-button slot="trigger"   class="board-button settings" caret>{$state.name}</sl-button>
          <sl-menu className="settings-menu">
            <sl-menu-item on:click={()=> editBoardDialog.open(cloneDeep(activeBoard.hash))} class="board-settings" >
                <SvgIcon icon="faCog"  style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px"/> <span>Settings</span>
            </sl-menu-item>
            <sl-menu-item on:click={() => exportBoard($state)} title="Export" class="board-export" >
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
          {#if $state.boundTo.length>0}
            <div style="margin-left:10px;display:flex; align-items: center">
              <span style="margin-right: 5px;">Bound To:</span>
              <AttachmentsList allowDelete={false} attachments={$state.boundTo} />
            </div>
          {/if}
          <div style="margin-left:10px; margin-top:2px;display:flex">
            <button title="Add Board to Pocket" class="attachment-button" style="margin-right:10px" on:click={()=>copyWalToPocket()} >          
              <SvgIcon icon="addToPocket" size="20px"/>
            </button>
            <button class="attachment-button" style="margin-right:10px" on:click={()=>attachmentsDialog.open(undefined)} >          
              <SvgIcon icon="link" size="16px"/>
            </button>
            {#if $state.props.attachments}
              <AttachmentsList attachments={$state.props.attachments}
                allowDelete={false}/>
            {/if}
          </div>
        {/if}
  
      {/if}
    </div>
    <div class="right-items">
      {#if $participants}
        <div class="participants">
          <div style="display:flex; flex-direction: row">
            <Avatar agentPubKey={store.myAgentPubKey} showNickname={false} size={30} />

            {#each Array.from($participants.entries()) as [agentPubKey, sessionData]}
            <div class:idle={Date.now()-sessionData.lastSeen >30000}>
              <Avatar agentPubKey={agentPubKey} showNickname={false} size={30} />
            </div>
            {/each}

          </div>
        </div>
      {/if}

    </div>
  </div>
  {#if $state}
  <!-- <button on:click={saveSheet}>Save</button> -->
  <!-- <div id="spreadsheet" style="height:100%; position: relative; top: -32px;"> -->
   <div id="spreadsheet" style="height:100%; position: relative;" on:click={maybeSave}>
      <!-- <ReactAdapter
        el={Workbook}
        data={[{ name: "Sheet1", rows:20}]} 
      /> -->
    </div>
  {/if}
  <div class="bottom-fade"></div>
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
    box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1);
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
