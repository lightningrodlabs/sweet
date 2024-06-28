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
  import dmp from 'dmp';
  import type { WAL } from "@lightningrodlabs/we-applet";
  import '@lightningrodlabs/we-elements/dist/elements/wal-embed.js';

  import type { IWorkbookData } from '@univerjs/core';

  import "@univerjs/design/lib/index.css";
  import "@univerjs/ui/lib/index.css";
  import "@univerjs/sheets-ui/lib/index.css";
  import "@univerjs/sheets-formula/lib/index.css";
  import "@univerjs/sheets-numfmt/lib/index.css";
  import '@univerjs/thread-comment-ui/lib/index.css';
  
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
  // import { UniverDocsDrawingUIPlugin } from '@univerjs/docs-drawing-ui';
  import { UniverSlidesPlugin } from '@univerjs/slides';
  import { UniverSlidesUIPlugin } from '@univerjs/slides-ui';

  import type { JSONOpComponent } from 'ot-json1';

  import { FUniver } from "@univerjs/facade";
  import { spread } from "svelte/internal";
  import App from "./App.svelte";

  export let activeBoard: Board
  export let myProfile;
  export let participants; //this is to make sure they are available on load
  export let standAlone = false

  const DMP = new dmp();
  
  const delay = ms => new Promise(res => setTimeout(res, ms));

  let currentSheet;
  let lastReceivedState;
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
  
// ================== Register Plugins ==================
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
univer.registerPlugin(UniverDocsUIPlugin);
univer.registerPlugin(UniverSheetsPlugin, {
    notExecuteFormula: true,
});
univer.registerPlugin(UniverSheetsUIPlugin);
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
univer.registerPlugin(UniverSheetsDataValidationPlugin);
univer.registerPlugin(UniverSheetsSortPlugin);
univer.registerPlugin(UniverSheetsSortUIPlugin);
univer.registerPlugin(UniverSheetsConditionalFormattingUIPlugin);
// univer.registerPlugin(UniverDocsDrawingUIPlugin);
univer.registerPlugin(UniverSlidesPlugin);
univer.registerPlugin(UniverSlidesUIPlugin);
univer.registerPlugin(UniverSheetsDrawingUIPlugin);
// ================== Register Plugins Ends ==================

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

 const debouncedMaybeSave = debounce(async () => {
    // await delay(100)
    const previousVersion = JSON.stringify(previousState);
    const newVersion = JSON.stringify($synState);
    if ($synState.type == 'spreadsheet') {
      saveSheet();
    } else if ($synState.type == 'document') {
      saveDocument();
    } else {
      console.log("no save");
    }
  }, 400);


function removeSymbolFields(obj) {
  let newObj = cloneDeep(obj)
  for (const key in newObj) {
      if (key.startsWith("Symbol") || key.startsWith("[[")) {
          delete newObj[key];
      } else if (typeof newObj[key] === "object" && newObj[key] !== null) {
          removeSymbolFields(newObj[key]);
      }
  }
  return newObj;
}

function changeUndefinedToEmptyString(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => changeUndefinedToEmptyString(item));
    } else if (typeof obj === 'object' && obj !== null) {
      let newObj = {};
      for (const key in obj) {
        if (obj[key] === undefined || obj[key] === null) {
          newObj[key] = "";
        } else if (typeof obj[key] === "object") {
          newObj[key] = changeUndefinedToEmptyString(obj[key]);
        } else {
          newObj[key] = obj[key];
        }
      }
      return newObj;
    }
    return obj
  }

const updateDocument = async () => {
  console.log("updating document", currentSheet.snapshot)
  console.log("coming in", $synState)
  const spreadsheet = $synState.spreadsheet
  console.log("spreadsheet", spreadsheet)
  const localState = currentSheet.snapshot
  console.log("localState", localState)
  currentSheet.reset({...localState})

  console.log(lastReceivedState)
  let dataStream0 = lastReceivedState.spreadsheet.body.dataStream;
  let dataStream1 = spreadsheet.body.dataStream;
  let dataStream2 = localState.body.dataStream;
  console.log("dataStream0", dataStream0)
  console.log("dataStream1", dataStream1)
  console.log("dataStream2", dataStream2)
  // const modified = dmp.diff_main(dataStream1, dataStream2);
  // const patch = dmp.patch_make(dataStream1, dataStream2);
  // const result = dmp.patch_apply(patch, dataStream1);

  // Step 1: Find differences between dataStream1 and dataStream2
  const diffs1 = DMP.diff_main(dataStream0, dataStream1);
  const diffs2 = DMP.diff_main(dataStream0, dataStream2);

  const allDiffs = diffs1.concat(diffs2);
  const uniqueDiffs = allDiffs.filter((diff, index, self) =>
    index === self.findIndex((t) => (
      t[0] === diff[0] && t[1] === diff[1]
    ))
  );

  // Step 2: Create patches based on the differences
  const patches = DMP.patch_make(dataStream0, uniqueDiffs);

  // Step 3: Apply patches to dataStream1 to get a merged result
  const [mergedDataStream, results] = DMP.patch_apply(patches, dataStream0);
  

  console.log("results", results)
  
  // Check if all patches were applied successfully
  const allApplied = results.every(result => result);
  if (allApplied) {
    console.log("Merged Data Stream:", mergedDataStream);
  } else {
    console.log("Some patches were not applied successfully.");
  }

  // console.log("patches", patches)

  // let convertedPatches = patches.map(patch => {
  //   // Map each diff to its corresponding component
  //   let components = patch.diffs.map(diff => {
  //     let component = {};
  //     if (diff[0] === 0) { // Equal
  //       component["es"] = diff[1]; // Assuming 'es' is the correct key for 'equal' in your operational transformation library
  //     } else if (diff[0] === 1) { // Insert
  //       component["i"] = diff[1];
  //     } else if (diff[0] === -1) { // Delete
  //       component["d"] = diff[1]; // Assuming 'd' is the correct key for 'delete'
  //     }
  //     return component;
  //   });
  //   return components; // Return the full array of components for this patch
  // });

  // console.log("convertedPatches", JSON.stringify(convertedPatches))
  // currentSheet.apply(convertedPatches)

  // console.log("actually applied", currentSheet.snapshot)
  // lastReceivedState = cloneDeep({...$synState, 
  //   spreadsheet: {
  //     ...$synState.spreadsheet,
  //     body: {
  //       ...$synState.spreadsheet.body,
  //       dataStream: currentSheet.snapshot.body.dataStream
  //     }
  //   }
  // })

  currentSheet.reset({...localState, body: {...localState.body, dataStream: mergedDataStream}})

  let activeDoc = univerAPI.getActiveDocument()
  // activeDoc.appendText('Univer')

  lastReceivedState = cloneDeep({...$synState, 
    spreadsheet: {
      ...$synState.spreadsheet,
      body: {
        ...$synState.spreadsheet.body,
        dataStream: mergedDataStream
      }
    }
  })

  // // update style
  // let originalStyle = JSON.stringify(localState.documentStyle);
  // let newStyle1 = JSON.stringify(spreadsheet.documentStyle);
  // let newStyle2 = JSON.stringify(localState.documentStyle);
  // let diffsStyle1 = DMP.diff_main(originalStyle, newStyle1);
  // let diffsStyle2 = DMP.diff_main(originalStyle, newStyle2);
  // let allDiffsStyle = diffsStyle1.concat(diffsStyle2);
  // let uniqueDiffsStyle = allDiffsStyle.filter((diff, index, self) =>
  //   index === self.findIndex((t) => (
  //     t[0] === diff[0] && t[1] === diff[1]
  //   ))
  // );
  // let patchesStyle = DMP.patch_make(originalStyle, uniqueDiffsStyle);
  // let [mergedStyle, resultsStyle] = DMP.patch_apply(patchesStyle, originalStyle);
  // console.log("resultsStyle", resultsStyle)
  // console.log("mergedStyle", mergedStyle)

  // currentSheet.reset({...localState, body: {...localState.body, dataStream: mergedDataStream}, documentStyle: JSON.parse(mergedStyle)})

  // currentSheet.updateDocumentStyle(JSON.parse(styleResult[0]))
}

  const updateSheet = async () => {
    // await delay(100)
    console.log("updating sheet", currentSheet.save())
    // const activeSheet = funiver.getActiveWorkbook().getActiveSheet();
    const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
    console.log("SNAPSHOT", univerAPI.getActiveWorkbook().getSnapshot());
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
    if ($synState.type == "spreadsheet") {
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
        debouncedMaybeSave()
       }
    } else if ($synState.type == "document") {
      // all typing keys
      const nonModifyingKeys = [
        "F1", "F2", "F3", "F4", "F5", "F6", 
        "F7", "F8", "F9", "F10", "F11", "F12",
        "Shift", "Control", "Alt", "Meta",
        "CapsLock", "NumLock", "ScrollLock",
        "Pause", "Insert", "PrintScreen",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      ];
      if (!nonModifyingKeys.includes(e.key) && !e.shiftKey) {
        debouncedMaybeSave()
      }
    }
    //   e.preventDefault();
    //   open = false;
  }

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();
  const univerAPI = FUniver.newAPI(univer);
  
  let previousState = {};
  $: uiProps = store.uiProps
  // $: participants = activeBoard.participants()
  $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: synState = activeBoard.readableState()

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Your update logic wrapped in a debounced function
  const debouncedUpdate = debounce(() => {
    if ($synState.type == "spreadsheet") {
      updateSheet();
    } else if ($synState.type == "document") {
      updateDocument();
    } else {
      console.log("no update");
    }
  }, 100); // 1000ms = 1 second


  $: if ($synState && univerAPI) {
    console.log("state change", $synState);
    debouncedUpdate();
    // console.log("state change", $synState)
    // if ($synState.type == "spreadsheet") {
    //   updateSheet()
    // } else if ($synState.type == "document") {
    //   updateDocument()
    // } else {
    //   console.log("no update")
    // }
  }

  const saveDocument = async () => {
    const docSnapshot = changeUndefinedToEmptyString(removeSymbolFields(currentSheet.snapshot))
    // console.log("Doc data", docSnapshot)

    let changes: BoardDelta[] = [{
      type: "set-spreadsheet",
      spreadsheet: docSnapshot
    }]
    activeBoard.requestChanges(changes)
    previousState = {...cloneDeep($synState)}
  }

  const saveSheet = async () => {
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
    console.log("THIS IS THE BOARD", savedBoard)
    console.log($synState.spreadsheet)
    // sheet = univer.createUniverSheet($synState.spreadsheet);
    if ($synState.type === "spreadsheet") {
      console.log("spreadsheet")
      currentSheet = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
    } else if ($synState.type === "document") {
      console.log("not spreadsheet")
      currentSheet = univer.createUnit(UniverInstanceType.UNIVER_DOC, $synState.spreadsheet);
    } else {
      console.log("not spreadsheet")
      currentSheet = univer.createUnit(UniverInstanceType.UNIVER_SLIDE, $synState.spreadsheet);
    }
    console.log(currentSheet)
    // sheet = univer.createUniverDoc($synState.spreadsheet);

    previousState = cloneDeep($synState)
    lastReceivedState = cloneDeep($synState)
    console.log("clonedeep", previousState)

    if ($synState.type == "spreadsheet") {
      window.addEventListener("keydown", checkKey);
      window.addEventListener("click", checkKey);
    } else if ($synState.type == "document") {
      window.addEventListener("keydown", checkKey);
    }

    funiver = FUniver.newAPI(univer);
    console.log("funiver", funiver)

    return () => {
      window.removeEventListener("click", checkKey);
    };
	});
  
  const copyWalToPocket = () => {
    const attachment: WAL = { hrl: [store.dnaHash, activeBoard.hash], context: "" }
    store.weClient?.walToPocket(attachment)
  }

</script>
<div class="board" >
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
  <div class="top-bar">
    <div class="left-items">
      {#if standAlone}
        <h2>{$synState.name}</h2>
        {:else}
        <!-- {JSON.stringify($synState)} -->
        <button  class="board-button close" on:click={closeBoard} title="Close">
          <SvgIcon icon=faClose size="16px"/>
        </button>
        <ClickEdit
            text={$synState.name}
            handleSave={(value) => {
              activeBoard.requestChanges([{type: 'set-name', name: value}])
            }}
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
   <div
   on:click={debouncedMaybeSave}
    id="spreadsheet" style="height:100%; position: relative;"></div>
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
