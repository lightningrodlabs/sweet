<script lang="ts">
  import { getContext, onDestroy, onMount } from "svelte";
  import type { CalcyStore } from "./store";
  import { v1 as uuidv1 } from "uuid";
  import type {  Board, BoardDelta, BoardProps } from "./board";
  import EditBoardDialog from "./EditBoardDialog.svelte";
  import Avatar from "./Avatar.svelte";
  import { get } from 'svelte/store';
  import { RichText, DocumentViewModel, DocumentSkeleton, Documents, IRenderManagerService } from '@univerjs/engine-render';
  import { decodeHashFromBase64,encodeHashToBase64, type Timestamp, type Link } from "@holochain/client";
  import { cloneDeep, isEqual } from "lodash";
  import { encode, decode } from '@msgpack/msgpack';
  import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
  import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
  import ClickEdit from "./ClickEdit.svelte";
  import { onVisible } from "./util";
  import SvgIcon from "./SvgIcon.svelte";
  import { exportBoard } from "./export";
  import AttachmentsList from './AttachmentsList.svelte';
  import AttachmentsDialog from "./AttachmentsDialog.svelte"
  import type { AppClient } from '@holochain/client';
  import { createEventDispatcher } from "svelte";
  import dmp from 'dmp';
  import Participants from "./Participants.svelte";
  import type { WAL } from "@lightningrodlabs/we-applet";
  import '@lightningrodlabs/we-elements/dist/elements/wal-embed.js';

  import "@univerjs/sheets-numfmt/lib/index.css";
  import '@univerjs/thread-comment-ui/lib/index.css';
  import "@univerjs/design/lib/index.css";
  import "@univerjs/ui/lib/index.css";
  import "@univerjs/sheets-ui/lib/index.css";
  // import "@univerjs/sheets-formula/lib/index.css";
  import "@univerjs/docs-ui/lib/index.css";
  
  import ThreadCommentUIEnUS from '@univerjs/thread-comment-ui/locale/en-US';
  import SheetsThreadCommentEnUS from '@univerjs/sheets-thread-comment/locale/en-US';
  import DesignEnUS from '@univerjs/design/locale/en-US';
  import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
  import SheetsEnUS from '@univerjs/sheets/locale/en-US';
  import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
  import UIEnUS from '@univerjs/ui/locale/en-US';

  import { LocaleType, LogLevel, ILogService, LocaleService, Univer, UniverInstanceType, type JSONXActions, type ICommand, TextXActionType, TextX, JSONX, ICommandService, CommandService, UserManagerService , Tools, IUniverInstanceService, MemoryCursor, type DocumentDataModel} from '@univerjs/core';
  import { defaultTheme } from '@univerjs/design';
  import { UniverDocsPlugin, DocSkeletonManagerService, DocSelectionManagerService } from '@univerjs/docs';
  import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
  import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
  import { UniverSheetsPlugin } from '@univerjs/sheets';
  import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
  import { UniverUIPlugin } from '@univerjs/ui';
  import { IRangeSelectorService, RangeSelector, TextEditor, IEditorService } from '@univerjs/docs-ui';
  import { UniverSheetsConditionalFormattingUIPlugin } from '@univerjs/sheets-conditional-formatting-ui';
  import { UniverSheetsThreadCommentPlugin } from '@univerjs/sheets-thread-comment';
  // import { UniverDebuggerPlugin } from '@univerjs/debugger';
  import { UniverSheetsHyperLinkUIPlugin } from '@univerjs/sheets-hyper-link-ui';
  import { IThreadCommentMentionDataService, UniverThreadCommentUIPlugin } from '@univerjs/thread-comment-ui';
  import { UniverThreadCommentPlugin, ThreadCommentDataSourceService } from '@univerjs/thread-comment';
  import { UniverSheetsThreadCommentBasePlugin } from '@univerjs/sheets-thread-comment-base';
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
  import { UniverDocsDrawingUIPlugin } from '@univerjs/docs-drawing-ui';
  import { UniverDocsThreadCommentUIPlugin } from '@univerjs/docs-thread-comment-ui';
  // import { UniverDocsMentionUIPlugin } from '@univerjs/docs-mention-ui';
  import { UniverSlidesPlugin } from '@univerjs/slides';
  import { UniverSlidesUIPlugin } from '@univerjs/slides-ui';
  import { FUniver } from "@univerjs/facade";
  import { text } from "svelte/internal";
  import { SynClient, stateFromCommitOT, type Commit, type SessionMessage } from "@holochain-syn/core";
    import { FreezeObject, from } from "automerge";
    // import { act } from "react";

  export let activeBoard: Board
  export let myProfile;
  export let profiles;
  export let participants; //this is to make sure they are available on load
  export let standAlone = false

  const dispatch = createEventDispatcher()

  const DMP = new dmp();
  
  const delay = ms => new Promise(res => setTimeout(res, ms));

  let currentUniverEditable: DocumentDataModel;
  let lastReceivedState;
  let appliedCommandIds = [];
  let lastKnownCommand
  let lastCursorPosition = null;
  let allSelections = {}
  // let funiver;
  let resetStrikes = 0;
  let safeToType = true; // to prevent typing while fetching new operations
  let unsafeToTypeBacklog = [] // to store typing events while unsafe to type
  let keyDownCount = 0;
  let lastTypedTime = Date.now()
  let timeToRetrieve = false

  let processes = []
  let unsubs = []

  let univer = new Univer({
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
        SheetsThreadCommentEnUS,
        ThreadCommentUIEnUS,
      ),
    },
  });
    
  // ================== Register Plugins ==================
  function registerPlugins() {
    univer.registerPlugin(UniverDocsPlugin, {
        hasScroll: false,
    });
    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverUIPlugin, {
        container: "univer-container",
        header: true,
        toolbar: true,
        footer: true,
      });

    // univer.registerPlugin(UniverDocsUIPlugin);
    univer.registerPlugin(UniverDocsUIPlugin, {
      container: 'univer-container',
      layout: {
        docContainerConfig: {
          innerLeft: false,
        },
      },
    });

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
  }
  // ================== Register Plugins Ends ==================

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();

  const injector = univer.__getInjector();
  const iLogService = injector.get(ILogService)
  const userManagerService = injector.get(UserManagerService);
  const univerAPI = injector.get(ICommandService);
  $: activeHash = store.boardList.activeBoardHash;
  $: synState = activeBoard.readableState()
  $: clerkStatus = activeBoard.session ? activeBoard.session.clerkStatus: null
  $: clerk = activeBoard.session ? activeBoard.session.clerk: null
  $: chronicle = activeBoard.session ? activeBoard.session.chronicle: null

  let workingFromCommit: Uint8Array;
  let workingFromState: any;
  let chronicleEstimation = []
  let chronicleEstimationLength = 0
  let lastSelection = {startOffset: 0, endOffset: 0}
  let loading = true;

  const mockUser = {
    userID: encodeHashToBase64(store.myAgentPubKey),
    name: myProfile.entry.nickname || "Anonymous User",
    avatar: myProfile.entry.fields.avatar,
    anonymous: false,
    canBindAnonymous: true,
  };

  class CustomMentionDataService implements IThreadCommentMentionDataService {
    trigger: string = '@';

    async getMentions() {
      // return [
      //   {
      //       id: mockUser.userID,
      //       label: mockUser.name,
      //       type: 'user',
      //       icon: mockUser.avatar,
      //   },
      // ];
      return $synState.users.map(profile => {
        return {
          id: profile.userID,
          label: profile.name,
          type: 'user',
          icon: profile.avatar,
          anonymous: false,
          canBindAnonymous: false,
        }
      })
    }
    // async getMentions() {
    //   return profiles.map(profile => {
    //     return {
    //       id: profile.agentPubKey,
    //       label: profile.entry.nickname,
    //       type: 'user',
    //       icon: profile.entry.fields.avatar,
    //       anonymous: false,
    //       canBindAnonymous: false,
    //     }
    //   })
    // }
  }
  
  univer.registerPlugin(UniverThreadCommentPlugin);
  univer.registerPlugin(UniverDocsThreadCommentUIPlugin);
  // univer.registerPlugin(UniverDocsMentionUIPlugin);

  univer.registerPlugin(UniverSheetsThreadCommentBasePlugin);
  univer.registerPlugin(UniverSheetsThreadCommentPlugin)

  univer.registerPlugin(UniverThreadCommentUIPlugin, {
      overrides: [[IThreadCommentMentionDataService, { useClass: CustomMentionDataService }]],
  });

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


  const debouncedMaybeSave = debounce(async () => {
      // await delay(100)
      // const previousVersion = JSON.stringify(previousState);
      const newVersion = JSON.stringify($synState);
      if ($synState.type == 'spreadsheet') {
        saveSheet();
      } else if ($synState.type == 'document') {
        // console.log("0011", appliedCommandIds, command.uniqueId)
        // let newCommands = $synState.commands.filter(command => !appliedCommandIds.includes(command.uniqueId))
        // if (newCommands.length > 0) {
        //   newCommands.forEach(command => {
        //     if ( !["thread-comment-ui.operation.set-active-comment", "doc.operation.set-selections"].includes(command.id)) {
        //       console.log("executing command", command)
        //       univerAPI.executeCommand(command.id, command.params)
        //       appliedCommandIds.push(command.uniqueId)
        //     }
        //   })
        //   // previousState = {...cloneDeep($synState)}
        // }
        // saveDocument();
      } else {
        console.log("no save");
      }
    }, 0);

  // function newCursorPosition (externalCommand, lastCursorPosition) {
  //   // console.log("last internal command", lastCursorPosition)
  //   // console.log("external command", externalCommand)
  //   let lastLocalStartPosition = lastCursorPosition?.startOffset ? lastCursorPosition.startOffset : 0
  //   try {
  //     let externalLength = externalCommand.params?.actions[1]?.e[1]?.len
  //     let externalStartPosition = externalCommand.params?.actions[1]?.e[0]?.len
  //     let externalTrueStartPosition = externalStartPosition// - externalLength
  //     // console.log("external true start position", externalTrueStartPosition)
  //     // console.log("local start position", lastLocalStartPosition)
  //     if (externalTrueStartPosition < lastLocalStartPosition) {
  //       return [lastLocalStartPosition + externalLength, lastLocalStartPosition + externalLength]
  //     } else {
  //       return [lastLocalStartPosition, lastLocalStartPosition]
  //     }
  //   } catch (e) {
  //     // console.log("last local start position", lastLocalStartPosition)
  //     return [lastLocalStartPosition, lastLocalStartPosition]
  //   }
  // }

  const updateSheet = async () => {
    // await delay(100)
    console.log("updating sheet", currentUniverEditable.save())
    // const activeSheet = funiver.getActiveWorkbook().getActiveSheet();
    const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
    // console.log("SNAPSHOT", univerAPI.getActiveWorkbook().getSnapshot());
    const spreadsheet = $synState.spreadsheet.sheets
    // console.log("spreadsheet", spreadsheet)
    const localState = currentUniverEditable.save().sheets;
    // const localState = univerAPI.getActiveWorkbook().getSnapshot().sheets;
    console.log("localState", localState)
    let changed = false;

    // for each sheet in spreadsheet
    for (const sheet in spreadsheet) {
      let fullRange = activeSheet.getRange(1, 1, 100, 100);
      let compromiseValue = {...localState[sheet].cellData}
      for (const row in spreadsheet[sheet].cellData) {
        if (compromiseValue[row] === undefined) { compromiseValue[row] = {} }
        for (const col in spreadsheet[sheet].cellData[row]) {
          if (compromiseValue[row][col] === undefined) {
            compromiseValue[row][col] = {}
          }
          const previousValue = compromiseValue[row][col]
          const newValue = spreadsheet[sheet].cellData[row][col]
          if (!isEqual(previousValue, newValue)) {
            // let microRange = activeSheet.getRange(row, col, 1, 1);
            // microRange.setValue(newValue)
            compromiseValue[row][col] = newValue
            changed = true;
          }
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

  const saveSheet = async () => {
    const sheetData = currentUniverEditable.save();
    const sheetData2 = univerAPI.getActiveWorkbook().getSnapshot();
    sheetData.resources = sheetData2.resources
    console.log("sheetData", sheetData)
    let changes: BoardDelta[] = [{
      type: "set-spreadsheet",
      spreadsheet: sheetData
    }]
    activeBoard.requestChanges(changes)
    // previousState = {...cloneDeep($synState)}
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

  async function hackRefresh() {
    // console.log("hack refresh selection", selection)
    const unitId = currentUniverEditable.getUnitId()

    let emptySpaceCommand = {
        "id": "doc.mutation.rich-text-editing",
        "type": 2,
        "params": {
            "unitId": unitId,
            "actions": [
                "body",
                {
                    "et": "text-x",
                    "e": [
                        {
                            "t": "r",
                            "len": 0,
                            "segmentId": ""
                        }
                    ]
                }
            ],
            "debounce": true,
            "trigger": "doc.command.insert-text"
        }
    }

    await univerAPI.executeCommand(emptySpaceCommand.id, emptySpaceCommand.params, {"fromCollab": true})
    setCursors()

  }

  // async function saveComment(comment) {
    // console.log("COMMENT", comment.params?.unitId, comment.params?.subUnitId, comment.params?.comment?.threadId, comment)
    // const unitId = currentUniverEditable.getUnitId()
    // const commentDataService = injector.get(ThreadCommentDataSourceService);
    // const threadComments = commentDataService.listThreadComments(comment.)
    // commentDataService.saveToSnapshot(threadComments)
    
  // }

  function soloCursor() {
    const unitId = currentUniverEditable.getUnitId()
    const textSelectionService = injector.get(DocSelectionManagerService);
    const snapshotLength = currentUniverEditable.getSnapshot().body.dataStream.replaceAll(/\n/g, '').length - 1
    let selections = []

    let mySelection = allSelections[mockUser.userID]

    selections.push({
      collapsed: true,
      direction: "none",
      isActive: true,
      startOffset: Math.min(mySelection ? mySelection.startOffset : 0, snapshotLength),
      endOffset: Math.min(mySelection ? mySelection.endOffset : 0, snapshotLength),
      style: {
        strokeWidth: 5,
        stroke: 'rgb(223 141 27 / 1)',
        strokeActive: 'rgb(223 141 27 / 1)',
        fill: 'rgb(223 141 27 / 1)',
      }
    })

    textSelectionService.replaceDocRanges(
      selections,
      {
        unitId: unitId,
        subUnitId: unitId,
      },
      true,
      {}
    )
  }

  function setCursors() {
    // console.log("allSelections", allSelections)

    const unitId = currentUniverEditable.getUnitId()
    const textSelectionService = injector.get(DocSelectionManagerService);
    let selections = []
    const snapshotLength = currentUniverEditable.getSnapshot().body.dataStream.replaceAll(/\n/g, '').length - 1

    Object.keys(allSelections).forEach(author => {
      if (author === mockUser.userID) {
        return
      }
      let selection = allSelections[author]
      selections.push({
        collapsed: false,
        direction: "none",
        isActive: false,
        startOffset: Math.min(selection.startOffset, snapshotLength),
        endOffset: Math.min(selection.endOffset, snapshotLength),
        style: {
          strokeWidth: 5,
          stroke: 'rgb(223 141 27 / 1)',
          strokeActive: 'rgb(223 141 27 / 1)',
          fill: 'rgb(223 141 27 / 1)',
        }
      })
    })

    let mySelection = allSelections[mockUser.userID]

    selections.push({
      collapsed: true,
      direction: "none",
      isActive: true,
      startOffset: Math.min(mySelection ? mySelection.startOffset : 0, snapshotLength),
      endOffset: Math.min(mySelection ? mySelection.endOffset : 0, snapshotLength),
      style: {
        strokeWidth: 5,
        stroke: 'rgb(223 141 27 / 1)',
        strokeActive: 'rgb(223 141 27 / 1)',
        fill: 'rgb(223 141 27 / 1)',
      }
    })

    textSelectionService.replaceDocRanges(
      selections,
      {
        unitId: unitId,
        subUnitId: unitId,
      },
      true,
      {}
    )
  }


  function extractActionsFromCommands(commands) {
    let actions = [];
    commands.forEach(command => {
      if (command.params?.actions) {
        command.params.actions[1]["e"].forEach(item => {
          if (item) {
            actions.push(item);
          }
        });
      }
    });
    return actions;
  }

  let toCommit: any[] = []

  type PositionChange  = {
    addOrRemove: Number,
    fromPosition: Number,
  }
  let positionChanges: PositionChange[] = []

  async function applyCommands(preOps) {
    try {

      // console.log("clerksNewOperations", preOps)

      safeToType = false

      // ==================UN-APPLY MY OPERATIONS==================
      for (let i = toCommit.length - 1; i >= 0; i--) {
        let c = toCommit[i]
        // console.log("to commit", extractHumanReadableFromCommands([c])[0])
        let operations = extractActionsFromCommands([c])
        if (operations.find(op => op.t == "d" || op.t == "r")) {
          operations = TextX.makeInvertible(operations, currentUniverEditable.getSnapshot().body)
        }
        let reversedOps = TextX.invert(operations)
        // console.log("reversedOps", reversedOps)
        TextX.apply(currentUniverEditable.getSnapshot().body, reversedOps)
      }
      // ==================UN-APPLY MY OPERATIONS ENDS==================

      // ==================APPLY CLERK'S NEW OPERATIONS==================
      let allTransformedOps = []
      const combinedOps = preOps.concat(toCommit)
      for (let i = 0; i < combinedOps.length; i++) {
        let c = combinedOps[i]
        let opAuthor = c.authorId

        // if a comment, just add and move on
        if (c.id.includes("comment")) {
          univerAPI.executeCommand(c.id, c.params, {"fromCollab": true})
        }
        
        let operations = extractActionsFromCommands([c])
        let chronicleEstimationPreview = chronicleEstimation.concat([c])
        let firstKnownLocalCommandIndex = chronicleEstimationPreview.findIndex(command => command.uniqueId === c.firstKnownLocalCommandId)
        let lastKnownExternalCommandIndex = Math.max(-1, chronicleEstimationPreview.findIndex(command => command.uniqueId === c.lastKnownExternalCommandId))
        let unknownCommands = chronicleEstimationPreview.slice(lastKnownExternalCommandIndex + 1, firstKnownLocalCommandIndex)
    
        // ****adjust clerk's new operations according to their unknown ops****
        let unknownOps = extractActionsFromCommands(unknownCommands)
        let transformedOps = operations
        let lastRetainPosition = unknownOps[0]?.len ? unknownOps[0].len : 0
        unknownOps.forEach(op => {
          if (op.t === "r") {
            lastRetainPosition = op.len
          }
          if (transformedOps[0] && lastRetainPosition <= transformedOps[0].len) {
            transformedOps = TextX.transform(transformedOps, [op], "left")
          }
        })
        
        allTransformedOps = allTransformedOps.concat(transformedOps)
        TextX.apply(currentUniverEditable.getSnapshot().body
        , transformedOps)
        
        chronicleEstimation.push({
          ...c,
          transformed: transformedOps
        })
        chronicleEstimationLength += 1

        if (!isEqual($clerk, store.myAgentPubKey)) {
          activeBoard.session.saveOperationsToChronicle([{
            ...c,
            transformed: transformedOps
          }])
        }


        // ==================CHANGE CURSOR POSITOINS==================
        // If it's a set, set
        if (c.id.includes("doc.operation.set-selections")) {
          // console.log(3)
          allSelections[opAuthor] = {
            startOffset: c.params.ranges[0].startOffset,
            endOffset: c.params.ranges[0].endOffset
          }
        }
        // only change if this command is an external command we haven't already dealt with
        // else if (opAuthor != mockUser.userID) {
        else {
          // for each selection
          Object.keys(allSelections).forEach(author => {
            // if this author's selection, transform all
            if (author == opAuthor) {
              const opPos = transformedOps[transformedOps.length - 2]?.len + transformedOps[transformedOps.length - 1]?.len
              allSelections[author] = {
                startOffset: opPos ? opPos : TextX.transformPosition(transformedOps, allSelections[author].startOffset),
                endOffset: opPos ? opPos : TextX.transformPosition(transformedOps, allSelections[author].endOffset)
              }
            }
            // if other selection, check if after command
            // only change if this command is an external command we haven't already dealt with
            else if (opAuthor != mockUser.userID) {
              let cStart = transformedOps[0]?.len
              let cAdd = transformedOps[1]?.len
              let opPos = cAdd ? cStart + cAdd : cStart
              if (opPos <= allSelections[author].startOffset) {
                allSelections[author].startOffset = TextX.transformPosition(operations, allSelections[author].startOffset)
              }
              if (opPos <= allSelections[author].endOffset) {
                allSelections[author].endOffset = TextX.transformPosition(transformedOps, allSelections[author].endOffset)
              }
            }
            // ==================CHANGE CURSOR POSITOINS ENDS==================
          })
        }
      }
      
      chronicleEstimation = [...chronicleEstimation];

      // SAVE DOCUMENT IF I'M THE CLERK
      if (isEqual($clerk, store.myAgentPubKey)) {
        const newSynState = {
          ...$synState.spreadsheet,
          body: currentUniverEditable.getSnapshot().body
        }
        activeBoard.requestChanges([{type: 'set-spreadsheet', spreadsheet: removeSymbolFields(newSynState)}])
      }

      hackRefresh()
      safeToTypeAgain()
    } catch(e) {
      console.log(e)
      safeToTypeAgain()
    }
  }

  const debouncedApplyCommandBatch = debounce(async() => {
    
    const preOps = await activeBoard.session.sendOperationsToClerk(toCommit, chronicleEstimationLength - 1);
    
    await applyCommands(preOps)
    toCommit = []
  }, 100);

  async function safeToTypeAgain() {
    safeToType = true
    if (unsafeToTypeBacklog.length > 0) {
      console.log("unsafe to type backlog", unsafeToTypeBacklog)
      // for (let i = 0; i < unsafeToTypeBacklog.length; i++) {
      //   let backlog = unsafeToTypeBacklog[i]
      //   await univerAPI.executeCommand(backlog.command.id, backlog.command.params, backlog.options)
      // }
      unsafeToTypeBacklog = []
    }
  }

  async function getDocumentState(fromCommitHash?): Promise<[FreezeObject<any>, Uint8Array]> {
    let wfc: Uint8Array = fromCommitHash;
    console.log(!wfc, wfc)
    if (!wfc) {
      // const commits = await activeBoard.session.synClient.getCommitsForDocument(activeBoard.document.documentHash)
      const commits = await activeBoard.session.synClient.getWorkspaceTips(activeBoard.workspace.workspaceHash)
      console.log("all commits", commits)
      wfc = commits[commits.length - 1].target
    }
    console.log(wfc)
    const latestCommitState = await activeBoard.session.synClient.getCommit(wfc)
    console.log(latestCommitState)
    const decodedCommitState = decode(latestCommitState.record.entry.Present.entry as Commit)
    console.log(decodedCommitState)
    const fullDocument = stateFromCommitOT(decodedCommitState)
    console.log(fullDocument)
    return [fullDocument, wfc]
  }

  async function buildFromCommands(commands) {
    console.log("c o m m a n d s ", commands)
    let univer2 = new Univer({
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
          SheetsThreadCommentEnUS,
          ThreadCommentUIEnUS,
        ),
      },
    });
    let testDoc = univer2.createUnit(UniverInstanceType.UNIVER_DOC, workingFromState.spreadsheetf);
    
    // let operations = extractActionsFromCommands(commands)
    // let composed = TextX.apply(testDoc.getSnapshot().body, operations)

    // TextX.apply(testDoc.getSnapshot().body, operations)

    for (let i = 0; i < commands.length; i++) {
      let c = commands[i]
      let operations = extractActionsFromCommands([c])
      TextX.apply(testDoc.getSnapshot().body, operations)
    }

    // let composed = TextX.apply({}, operations)
    // operations.forEach(op => {
    //   TextX.apply(testDoc.getSnapshot().body, [op], "left")
    // })
    console.log("testDoc", testDoc)
    let identicalStrings = testDoc.snapshot.body.dataStream.replaceAll(/\r/g, '').replaceAll(/\n/g, '')
     === currentUniverEditable.snapshot.body.dataStream.replaceAll(/\r/g, '').replaceAll(/\n/g, '')
    console.log("identicalStrings string1", JSON.stringify(testDoc.snapshot.body.dataStream.replaceAll(/\r/g, '').replaceAll(/\n/g, '')))
    console.log("identicalStrings string2", JSON.stringify(currentUniverEditable.snapshot.body.dataStream.replaceAll(/\r/g, '').replaceAll(/\n/g, '')))
    console.log("identicalStrings", identicalStrings)
    if (!identicalStrings) {
    // if (true) {
      currentUniverEditable.snapshot = testDoc.snapshot
      hackRefresh()  
      // const hash = $activeHash;
      // await store.closeActiveBoard(false);
      // await store.setActiveBoard(hash);
      // currentUniverEditable.snapshot.body = $synState.spreadsheet.body
      // console.log($synState)
      // TextX.apply(currentUniverEditable.getSnapshot().body, operations)
      // // await openPage()
      // hackRefresh({
      //   startOffset: 0,
      //   endOffset: 0
      // })
    }
    // console.log("testDoc", composed.dataStream, currentUniverEditable.snapshot.body.dataStream)
    // console.log("testDoc", testDoc?.getSnapshot()?.body?.dataStream, composed)
  }

  // }, 1000);

  // Update logic wrapped in a debounced function
  // const debouncedUpdate = debounce(async() => {
  //   if ($synState.type == "spreadsheet") {
  //     updateSheet();
  //   } else if ($synState.type == "document") {
  //     // console.log("commands -- ", $synState.commands)
  //     await updateDocument();
  //   } else {
  //     console.log("no update");
  //   }
  // }, 20);

  function extractHumanReadableFromCommands(commands: ICommand[]) {
    let readableCommands = []
    commands.forEach(command => {
      console.log(command)
      if (command.id.includes("thread-comment-ui.operation.set-active-comment") || command.id.includes("doc.operation.set-selections")) {
        return
      }
      // let textEdit = command.params?.actions[0]?.e[1]?.body?.dataStream + " at " + command.params?.actions[0]?.e[0]?.len
      // if (!textEdit) {
        let textEdit = command.params?.actions[1]?.e[1]?.body?.dataStream + " at " + command.params?.actions[1]?.e[0]?.len
      // }
      readableCommands.push(textEdit)
    })
    return readableCommands
  }

  async function waitToFindClerk() {
    let foundClerk = false
    while (!foundClerk) {
      if ($clerkStatus == "found") {
        foundClerk = true
      }
      await delay(100)
    }
  }

  async function openPage() {
    try {
      // If other agents online, wait to find clerk and then document
      if (participants.length > 1) {
        console.log("all participants", participants)
        const waitClerkProcess = await waitToFindClerk()
        processes.push(waitClerkProcess)
        const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0);
        const wfc: Uint8Array = initialCommits[0] ? decodeHashFromBase64(initialCommits[0].workingFromCommit) as Uint8Array : null
        console.log("found working wfc from session 1")
        const [fullDocument, latestHash] = await getDocumentState(wfc)
        workingFromCommit = latestHash as Uint8Array
        workingFromState = fullDocument
      }
      // If no other agents online, load last document and assign myself clerk
      else {
        const [fullDocument, latestHash] = await getDocumentState(null)
        workingFromCommit = latestHash as Uint8Array
        workingFromState = fullDocument
        console.log("found wfc from storage")
      }
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      // If above process fails, try again
      const waitClerkProcess = await waitToFindClerk()
      processes.push(waitClerkProcess)
      const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0);
      const wfc: Uint8Array = initialCommits[0] ? decodeHashFromBase64(initialCommits[0].workingFromCommit) as Uint8Array : null
      console.log("found working wfc from session 2", wfc, initialCommits[0])
      const [fullDocument, latestHash] = await getDocumentState(wfc)
      workingFromCommit = latestHash as Uint8Array
      workingFromState = fullDocument
    }

    loading = false

    let synSavedProfiles = $synState.users
    let userIdFound = false
    synSavedProfiles.forEach(profile => {
      if (profile.userID != mockUser.userID) {
        userManagerService.addUser(profile)
      } else {
        userIdFound = true
      }
    })
    // add-user request to syn
    if (!userIdFound) {
      activeBoard.requestChanges([{type: 'add-user', user: mockUser}])
    }

    if ($synState.type === "spreadsheet") {
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
    } else if ($synState.type === "document") {
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_DOC, workingFromState.spreadsheet);
      // activeBoard.session._chronicle.set([]);
      await debouncedApplyCommandBatch()
      userManagerService.setCurrentUser(mockUser);
    } else {
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_SLIDE, $synState.spreadsheet);
    }

    $synState.commentCommands.forEach(comment => {
      // console.log("executing comment", comment)
      univerAPI.executeCommand(comment.id, comment.params, {"fromCollab": true})
    })

    lastReceivedState = cloneDeep($synState)

    if ($synState.type == "spreadsheet") {
      window.addEventListener("keydown", checkKey);
      window.addEventListener("click", checkKey);
    } else if ($synState.type == "document") {
      window.addEventListener("keydown", checkKey);
    }

    // SET CURSORS
    participants.forEach(userHash => {
      allSelections[encodeHashToBase64(userHash)] = {
        startOffset: 0,
        endOffset: 0,
      }
    })

    const applyCommandBatchInterval = setInterval(async() => {
      if ($clerkStatus == "found" && Date.now() - lastTypedTime > 500 && timeToRetrieve) {
        timeToRetrieve = false
        await debouncedApplyCommandBatch()
      }
    }, 300)
    processes.push(applyCommandBatchInterval)

    let beforeCommandListerner = univerAPI.beforeCommandExecuted((command, options) => {  
      // if (["thread-comment.mutation.update-comment", "thread-comment.mutation.add-comment", "thread-comment.mutation.resolve-comment", "docs.command.delete-comment"].includes(command.id)) {
      // if (command.id.includes("comment")) {
        // console.log(command)
      //   saveComment(command)
      // }
      if (["doc.operation.move-cursor", "univer.command.copy", "doc.command.inner-paste"].includes(command.id)) {
        soloCursor()
      }
      // TODO: properly implement this cursor movement instead of skipping it
      if (!options?.fromCollab && !command.id.includes("doc.operation.move-")) {

        if (["thread-comment.mutation.update-comment", "thread-comment.mutation.add-comment", "thread-comment.mutation.resolve-comment", "docs.command.delete-comment"].includes(command.id)) {
          activeBoard.requestChanges([{type: 'add-comment', comment: removeSymbolFields(changeUndefinedToEmptyString(command))}])
        }
        // else if (command.id == "doc.operation.set-selections" && command.params.isEditing == false) {
        //   allSelections[mockUser.userID] = {
        //     startOffset: command.params.ranges[0].startOffset,
        //     endOffset: command.params.ranges[0].endOffset
        //   }
        // }
        // else if (command.id.includes("mutation") || (command.id == "doc.operation.set-selections" && command.params.isEditing == false) || command.id.includes("doc.operation.move-")) {
        if (command.id.includes("mutation") || command.id.includes("docs.command.delete-comment") || (command.id == "doc.operation.set-selections" && command.params.isEditing == false && command.params.ranges.length == 1) || command.id.includes("doc.operation.move-")) {
          
          if (command.id == "doc.operation.set-selections" && command.params.isEditing == false) {
            allSelections[mockUser.userID] = {
              startOffset: command.params.ranges[command.params.ranges.length - 1].startOffset,
              endOffset: command.params.ranges[command.params.ranges.length - 1].endOffset
            }
          }
          else if (command.id.includes("doc.operation.move-")) {
            let currentUserSelection = allSelections[mockUser.userID]
            let directionCodes = [0,1,0,-1]
            allSelections[mockUser.userID] = {
              startOffset: currentUserSelection.startOffset + Number(directionCodes[command.params.direction]),
              endOffset: currentUserSelection.endOffset + Number(directionCodes[command.params.direction]),
            }
          } else if (command.id.includes("thread-comment.mutation.add-comment")) {
            // nothing needs to happen
          } else if (command.params?.textRanges) {
            let mySelectionStart = command.params?.textRanges[0]?.startOffset
            let mySelectionEnd = command.params?.textRanges[0]?.endOffset
            if (mySelectionStart && mySelectionEnd) {
              allSelections[mockUser.userID] = {
                startOffset: mySelectionStart,
                endOffset: mySelectionEnd
              }
            }

            // move other cursors
            Object.keys(allSelections).forEach(author => {
              if (author != mockUser.userID) {
                let cStart = command.params?.actions[1]?.e[0]?.len
                let cAdd = command.params?.actions[1]?.e[1]?.len
                let pos = cAdd ? cStart + cAdd : cStart

                if (pos <= allSelections[author].startOffset) {
                  let selection = allSelections[author]
                  let startOffset = TextX.transformPosition(command.params.actions[1]?.e, selection.startOffset)
                  let endOffset = TextX.transformPosition(command.params.actions[1]?.e, selection.endOffset)
                  // console.log("transformed", startOffset, selection.startOffset)
                  if (startOffset >= 0 && endOffset >= 0) {
                    allSelections[author] = {
                      startOffset,
                      endOffset
                    }
                  }
                }
              }
            })
          }

          // console.log("safe to type ?", safeToType)
          if (!safeToType) {
            unsafeToTypeBacklog.push({command, options})
            // error out
            throw new Error("unsafe to type")
          }
          
          const uniqueId = uuidv1()
          // let previousCommandUniqueId = lastKnownCommand ? lastKnownCommand : appliedCommandIds[appliedCommandIds.length - 1]
          lastKnownCommand = uniqueId
          // let lastKnownCommandIndex = chronicleEstimationLength - 1 //chronicleEstimation.length ? chronicleEstimation.length - 1 : -1;
          // let lastKnownCommandId = chronicleEstimation[lastKnownCommandIndex]?.uniqueId;
          // let lastKnownCommandIndex = chronicleEstimation.length - 1 + toCommit.length
          let firstKnownLocalCommandId = toCommit.length > 0 ? toCommit[0].uniqueId : uniqueId;
          let lastKnownExternalCommandId = chronicleEstimation.length > 0 ? chronicleEstimation[chronicleEstimation.length - 1]?.uniqueId : null;
          let authorId = encodeHashToBase64(activeBoard.session.myPubKey);
          let commandWithId = {
            ...removeSymbolFields(command),
            uniqueId: uniqueId,
            authorId: authorId,
            // previousCommandUniqueId: lastKnownCommand,
            // lastKnownCommandIndex,
            workingFromCommit: encodeHashToBase64(workingFromCommit),
            lastKnownExternalCommandId,
            firstKnownLocalCommandId,
          }
          appliedCommandIds.push(uniqueId)

          // let newPositionChange;
          // if (command.params?.actions && command.params?.actions[1]?.e[1]?.len) {
          //   newPositionChange = {addOrRemove: command.params.actions[1].e[1].len,
          //     fromPosition: command.params.actions[1].e[0].len}
          // } else {
          //   let c = command.params?.actions ? command.params.actions[1].e[0].len : 0
          //   newPositionChange = {addOrRemove: c,
          //     fromPosition: 0}
          // }
          
          // // change to negative if delete
          // if (command.id.includes("delete")) {
          //   newPositionChange.addOrRemove = -newPositionChange.addOrRemove
          // }

          // positionChanges.push(newPositionChange)

          if (commandWithId.params) {
            toCommit.push(changeUndefinedToEmptyString(removeSymbolFields(commandWithId)))
          }

          // ========CURSORS========
          // let mySelectionStart = command.params?.textRanges[0]?.startOffset
          // let mySelectionEnd = command.params?.textRanges[0]?.endOffset
          // if (mySelectionStart && mySelectionEnd) {
          //   allSelections[mockUser.userID] = {
          //     startOffset: mySelectionStart,
          //     endOffset: mySelectionEnd
          //   }
          // }
          
          setTimeout(() => {
            setCursors()
          }, 20)

          lastTypedTime = Date.now()
          timeToRetrieve = true

          // if (keyDownCount % 5 == 0) {
          //   keyDownCount += 1
          //   debouncedApplyCommandBatch()
          // }
        } else {
          // console.log("**************** COMMAND ********************", command)
        }
        // if (command.id === "doc.operation.set-selections") {
        //   lastCursorPosition = command.params.ranges[0]
        // }
      }
    })
    unsubs.push(beforeCommandListerner)
  }

  onMount(async () => {
    await registerPlugins();
    await openPage();

    const unsub = activeBoard.session.synClient.onSignal(synSignal => {
      if (synSignal.type !== 'SessionMessage') return;
      // if (isEqual(synSignal.provenance, activeBoard.session.myPubKey)) return;

      const message: SessionMessage = synSignal.message;
      if (
        message &&
        isEqual(message.workspace_hash, activeBoard.workspace.workspaceHash)
      ) {
        if (message.payload.type === 'NewOperationsBroadcast') {
          // console.log("New Operations Broadcast", message.payload.operations.map(c => decode(c) as any))
          if (message.payload.operations.length > 0 && toCommit.length == 0 && !timeToRetrieve) {
            const decodedOps = message.payload.operations.map(c => decode(c) as any)
            applyCommands(decodedOps)
          }
        }
      }
    });
    unsubs.push(unsub)

    // return () => {
    //   window.removeEventListener("click", checkKey);
    // };
	});

  onDestroy( async () => {
    // console.log("leave")
    if (isEqual($clerk, store.myAgentPubKey)) {
      // console.log("saving")
      let resTip = await activeBoard.session.commitChanges()
      // console.log("new tip?", resTip)
    }

    // console.log("PROCESSES", processes, unsubs)
    processes.forEach(p => clearInterval(p))
    unsubs.forEach(u => u)
  })
  
  const copyWalToPocket = () => {
    const attachment: WAL = { hrl: [store.dnaHash, activeBoard.hash], context: "" }
    store.weClient?.walToPocket(attachment)
  }

</script>
<div class="board" >
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
    <!-- {JSON.stringify($synState.spreadsheet)} -->
  <div class="top-bar">
    <div class="left-items">
      {#if standAlone}
        <h2>{$synState.name}</h2>
        {:else}
        <button  class="board-button close" on:click={closeBoard} title="Close">
          <SvgIcon icon=faClose size="16px"/>
        </button>
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
          <div style="display:flex; flex-direction: row">
            <!-- <button on:click={async() => {
              console.log("saving")
              let resTip = await activeBoard.session.commitChanges()
              console.log("new tip?", resTip)
              // const commits = await activeBoard.session.synClient.getCommitsForDocument(activeBoard.document.documentHash)
              const commits = await activeBoard.session.synClient.getWorkspaceTips(activeBoard.workspace.workspaceHash)
              console.log("all commits", commits)
              let wfc = commits[commits.length - 1].target
              // console.log("wfc", wfc)
              console.log(wfc)
              const latestCommitState = await activeBoard.session.synClient.getCommit(wfc)
              console.log(latestCommitState)
              const decodedCommitState = decode(latestCommitState.record.entry.Present.entry)
              console.log(decodedCommitState)
              const fullDocument = stateFromCommitOT(decodedCommitState)
              console.log(fullDocument)
            }}>
              Save
            </button>
            <button on:click={() => {
              console.log($synState)
            }}>
              paste
            </button>
            <button 
              class="board-button" 
              on:click={() => {
                debouncedApplyCommandBatch()
              }}
            >
              Fetch
            </button>
            <button on:click={() => {buildFromCommands(chronicleEstimation)}}>build</button>
            {JSON.stringify(allSelections)}
            {JSON.stringify($clerkStatus)}
            {JSON.stringify(chronicleEstimation[chronicleEstimationLength - 1]?.params?.actions)}
            {chronicleEstimation.length}
            {$chronicle.length} -->

            <div style="margin: 7px; display: flex; flex-direction: row;" title="In order to work together, you must be synced with collaborators">
              {$clerkStatus == "found" ? "Synced" : "Syncing..."}
            </div>
            <div style="display:flex; justify-content:flex-end">
              <!-- {JSON.stringify($clerk)} -->
              <Participants board={activeBoard} highlightedAgent={$clerk} max={10}></Participants>
            </div>

            <!-- <Avatar agentPubKey={store.myAgentPubKey} showNickname={false} size={30} /> -->

            {#each Array.from(participants.entries()) as [agentPubKey, sessionData]}
              <!-- <div class:idle={Date.now()-sessionData.lastSeen >30000}> -->
                <Avatar agentPubKey={agentPubKey} showNickname={false} size={30} />
              <!-- </div> -->
            {/each}

          </div>
        </div>
      {/if}

    </div>
  </div>
  {#if $synState}

  <!-- on:click={debouncedMaybeSave} -->
  {#if loading}
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw;">
      Joining session...
      <sl-spinner></sl-spinner>
    </div>
  {/if}
  <div
    id="univer-container" style="height:100%; position: relative;">---</div>
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
