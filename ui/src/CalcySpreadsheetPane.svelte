<script lang="ts">
import { getContext, onMount } from "svelte";
import type { CalcyStore } from "./store";
import { v1 as uuidv1 } from "uuid";
import type {  Board, BoardDelta, BoardProps } from "./board";
import EditBoardDialog from "./shared/EditBoardDialog.svelte";
import Avatar from "./shared/Avatar.svelte";
import { decodeHashFromBase64, type Timestamp } from "@holochain/client";
import { cloneDeep, isEqual } from "lodash";
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











    const delay = ms => new Promise(res => setTimeout(res, ms));
    let sheet;
    // let funiver;
  
    const maybeSave = async () =>{
      await delay(100)
      // const previousVersion = JSON.stringify(previousState.spreadsheet)
      const previousVersion = $synState.spreadsheet
      const newVersion = sheet.save()
      // console.log(previousVersion)
      // console.log("-------------")
      // console.log(newVersion)
      // console.log('deep equal', deepEqual(previousVersion.sheets, newVersion.sheets))
      if (!deepEqual(previousVersion, newVersion)) {
        console.log("unsaved changes")
        saveSheet()
      }
      // if (previousVersion !== newVersion) {
        // console.log("unsaved changes")
        // saveSheet()
      // }
    }
  
    const updateSheet = async () => {
      // await delay(100)
      console.log("updating sheet")
      const activeSheet = univerAPI.getActiveSheet() //.getActiveWorkbook().getActiveSheet();
      const spreadsheets = $synState.spreadsheet.sheets
      // console.log("spreadsheet", spreadsheet)
      const localState = sheet.save().sheets
      console.log("current sheet", sheet)
      console.log("localState", localState)
      let changed = false;

      // console.log("active sheet", activeSheet.worksheet._worksheet._sheetId)
      let correspondingSpreadsheet = spreadsheets[activeSheet.worksheet._worksheet._sheetId]
      // console.log("corresponding spreadsheet", correspondingSpreadsheet.cellData)
      // fullRange.setValues(correspondingSpreadsheet.cellData)
  
      // for each sheet in spreadsheet
      const sheetpage = activeSheet.worksheet._worksheet._sheetId
      // for (const sheetpage in spreadsheets) {
        // console.log("sheet", sheetpage)
        // let fullRange = activeSheet.worksheet.getRange(1, 1, 1000, 1000);
        // let fullRange
        // console.log("fullRange", fullRange)

        let beginRow = null;
        let endRow = null;
        let maxRow = 0;
        let maxCol = 0;

        let replacementRange = spreadsheets[sheetpage];
        console.log("replacementRange", replacementRange)
  
        console.log("compromiseValue", localState, sheetpage)
        let compromiseValue = {...localState[sheetpage].cellData}
        // for each cell in sheet
        // console.log("sheet", spreadsheet[sheet].cellData)
        for (const row in spreadsheets[sheetpage].cellData) {
          if (compromiseValue[row] === undefined) {
            compromiseValue[row] = {}
          }
          // console.log("row", row)
          for (const col in spreadsheets[sheetpage].cellData[row]) {
            if (compromiseValue[row][col] === undefined) {
              compromiseValue[row][col] = {}
            }
            // console.log("col", col, row, spreadsheet[sheet].cellData[row][col])
            const previousValue = compromiseValue[row][col]
            const newValue = spreadsheets[sheetpage].cellData[row][col]
            // check if object values in previousValue differ from newValue
            if (!isEqual(previousValue, newValue)) {
              const rowNum = Number(row)
              const colNum = Number(col)
              console.log(rowNum,colNum,rowNum+1,colNum+1)
              maxRow = rowNum
              maxCol = colNum
              if (!beginRow && !endRow) {
                beginRow = rowNum
                endRow = rowNum
              }

              // console.log("replaceement range", sheet, activeSheet.worksheet)
              // let microRange = sheet.getRange(row, col, row, col);
              // console.log("microrange", microRange)
              // microRange.setValue(newValue)
              compromiseValue[row][col] = newValue
              changed = true;
            } //else {
              // console.log("no update", previousValue.v, newValue.v)
            // }
          }
        }
  
        if (changed) {
          let fullRange = activeSheet.worksheet.getRange(beginRow | 1, endRow | 1, maxRow, maxCol);
          fullRange.setValues(compromiseValue);
          // replacementRange.setValues(compromiseValue);
        }
      // }
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
  
    export let tabView = false;
    export let activeBoard: Board
    export let standAlone = false
    
    let previousState = {};
    $: uiProps = store.uiProps
    $: participants = activeBoard.participants()
    $: sessionStore = activeBoard.session
    $: activeHashB64 = store.boardList.activeBoardHashB64;
    $: synState = activeBoard.readableState()
    $: if ($synState && univerAPI && sheet) {
      // console.log("state change", $synState)
      // console.log("incoming spreadsheet", $synState.spreadsheet)
      // console.log("unvier api", univerAPI.getActiveSheet().worksheet._worksheet._cellData)
      
      // const currentSheetId = univerAPI.getActiveSheet().worksheet._worksheet._sheetId
      // const sheets = Object.keys($synState.spreadsheet.sheets)
      // console.log("sheets", sheets)
      // const newCellData = removeSymbolFields($synState.spreadsheet.sheets[currentSheetId].cellData)
      // console.log("newCellData", newCellData)
      
      
      // const currentCellData = cloneDeep(univerAPI.getActiveSheet().worksheet._worksheet._cellData._matrix)
      // console.log("test========", resetMatrix)

      // resetMatrix(currentCellData, newCellData)

      // univerAPI.getActiveSheet().worksheet._worksheet._cellData._matrix = newCellData

      // univerAPI.getActiveSheet().worksheet._worksheet._cellData = test

      // console.log("unvier api", univerAPI.getActiveSheet().worksheet._worksheet._cellData)
      
      // const createRES = univerAPI.createWorkbook($synState.spreadsheet);
      // univerAPI = createRES.univerAPI
      // univer = createRES.univer

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
      // previousState = {...cloneDeep($synState)}
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
    // console.log("previous state set", previousState)
    // const savedBoard = await activeBoard.readableState()
    console.log("syn state", JSON.stringify($synState.spreadsheet))
    // sheet = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
    // console.log("savedBoard", savedBoard)
    console.log("funiver", univerAPI)
    sheet = univerAPI.createWorkbook($synState.spreadsheet);
    console.log("create sheet result", sheet)
    // sheet = univer.createUniverDoc($synState.spreadsheet);

    previousState = cloneDeep($synState)
    console.log("clonedeep", previousState)
    window.addEventListener("keydown", checkKey);

    // listen for tab click
    // window.addEventListener("mousedown", test)
    // const tabs = document.querySelectorAll('.univer-slide-tab-div');
    // console.log("tabs", tabs)
    // tabs.forEach(tab => {
    //   console.log("tab", tab)
    //   tab.addEventListener('click', copyWalToPocket)
    // });

    univerAPI.onCommandExecuted((command) => {
      if (command.id == "sheet.operation.set-worksheet-active") {
        console.log("command", command)
        updateSheet()
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
      <div class="top-bar">
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
              style="font-size: 16px; font-weight: bold; border: none; background: transparent; color: rgba(86, 92, 108, 1.0);"
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
              <div style="display:flex; flex-direction: row; margin: 3px 0;">
                <session-participants direction="row" showOffline={true} sessionstore={sessionStore} />
              </div>
            </div>
          {/if}
    
        </div>
      </div>
    {#if $synState}
    <!-- <button on:click={saveSheet}>Save</button> -->
    <!-- <div id="spreadsheet" style="height:100%; position: relative; top: -32px;"> -->
     <div id="app" style="height:100vh; position: relative;" on:click={maybeSave}>
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