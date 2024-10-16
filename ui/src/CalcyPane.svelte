<script lang="ts">
  import { getContext, onMount } from "svelte";
  import type { CalcyStore } from "./store";
  import { v1 as uuidv1 } from "uuid";
  import type {  Board, BoardDelta, BoardProps } from "./board";
  import EditBoardDialog from "./EditBoardDialog.svelte";
  import Avatar from "./Avatar.svelte";
  import { RichText, DocumentViewModel, DocumentSkeleton, Documents, IRenderManagerService } from '@univerjs/engine-render';
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
  import { createEventDispatcher } from "svelte";
  import dmp from 'dmp';
  import type { WAL } from "@lightningrodlabs/we-applet";
  import '@lightningrodlabs/we-elements/dist/elements/wal-embed.js';

  import "@univerjs/sheets-numfmt/lib/index.css";
  import '@univerjs/thread-comment-ui/lib/index.css';
  import "@univerjs/design/lib/index.css";
  import "@univerjs/ui/lib/index.css";
  import "@univerjs/sheets-ui/lib/index.css";
  import "@univerjs/sheets-formula/lib/index.css";
  import "@univerjs/docs-ui/lib/index.css";
  
  import ThreadCommentUIEnUS from '@univerjs/thread-comment-ui/locale/en-US';
  import SheetsThreadCommentEnUS from '@univerjs/sheets-thread-comment/locale/en-US';
  import DesignEnUS from '@univerjs/design/locale/en-US';
  import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
  import SheetsEnUS from '@univerjs/sheets/locale/en-US';
  import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
  import UIEnUS from '@univerjs/ui/locale/en-US';

  import { LocaleType, LogLevel, ILogService, LocaleService, Univer, UniverInstanceType, type JSONXActions, TextXActionType, TextX, JSONX, ICommandService, CommandService, UserManagerService , Tools, IUniverInstanceService, MemoryCursor, type DocumentDataModel} from '@univerjs/core';
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
  import { UniverThreadCommentPlugin } from '@univerjs/thread-comment';
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
  import { UniverSlidesPlugin } from '@univerjs/slides';
  import { UniverSlidesUIPlugin } from '@univerjs/slides-ui';
  import { FUniver } from "@univerjs/facade";
    import { text } from "svelte/internal";
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

  // univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverDocsUIPlugin, {
    container: 'univerdoc',
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
  // ================== Register Plugins Ends ==================

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();

  const injector = univer.__getInjector();
  const iLogService = injector.get(ILogService)
  const userManagerService = injector.get(UserManagerService);
  const univerAPI = injector.get(ICommandService);
  // const univerAPI = new CommandService(injector, iLogService)
  // const univerAPI = injector.createInstance(FUniver);
  // const univerAPI = FUniver.newAPI(injector);
  console.log(injector, iLogService, univerAPI)
  
  // let previousState = {};
  // $: uiProps = store.uiProps
  // $: participants = activeBoard.participants()
  // $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: synState = activeBoard.readableState()
  // $: synComplexState = activeBoard.session.state
  $: clerkStatus = activeBoard.session ? activeBoard.session.clerkStatus: null
  // $: chronicle = activeBoard.session ? activeBoard.session.chronicle: null

  let chronicleEstimation = []
  let chronicleEstimationLength = 0
  let lastSelection = {startOffset: 0, endOffset: 0}

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

  // function refreshDocumentByDocData() {
  //   // const irender = new IRenderManagerService
  //   // const x = irender.getRenderAll()
  //   // console.log(x)
    
  //   const docModel = currentUniverEditable
  //   const docViewModel = new DocumentViewModel(docModel);
  //   const localeService = new LocaleService();
  //   const documentSkeleton = DocumentSkeleton.create(docViewModel, localeService)
  //   documentSkeleton.getViewModel().getDataModel().updateDocumentDataPageSize(1000, 1 / 0), documentSkeleton.calculate();
  // }

  // function refreshDocument() {
  //   const docModel = currentUniverEditable
  //   const docViewModel = new DocumentViewModel(docModel);
  //   docViewModel.reset(docModel);
  //   const localeService = new LocaleService();
  //   const documentSkeleton = DocumentSkeleton.create(docViewModel, localeService)
  //   documentSkeleton.calculate();
  // }

  async function hackRefresh(selection) {
    console.log("hack refresh selection", selection)
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
                        },
                        {
                            "t": "i",
                            "body": {
                                "dataStream": ""
                            },
                            "len": 0,
                            "line": 0,
                            "segmentId": ""
                        }
                    ]
                }
            ],
            "debounce": true,
            "trigger": "doc.command.insert-text"
        }
    }

    let clickCommand = {
        "id": "doc.operation.set-selections",
        "type": 1,
        "params": {
            "unitId": unitId,
            "subUnitId": unitId,
            "segmentId": "",
            "style": {
                "strokeWidth": 1.5,
                "stroke": "rgba(0, 0, 0, 0)",
                "strokeActive": "rgba(0, 0, 0, 1)",
                "fill": "rgba(130, 192, 9, 1)"
            },
            "isEditing": false,
            "ranges": [
                {
                    "startOffset": selection ? selection.startOffset : 0,
                    "endOffset": selection ? selection.endOffset : 0,
                    "collapsed": true,
                    "rangeType": "TEXT",
                    "startNodePosition": {
                        "glyph": 24,
                        "divide": 0,
                        "line": 0,
                        "column": 0,
                        "section": 0,
                        "page": 0,
                        "segmentPage": -1,
                        "pageType": 0,
                        "path": [
                            "pages",
                            0
                        ],
                        "isBack": true
                    },
                    "endNodePosition": null,
                    "direction": "none",
                    "segmentId": "",
                    "segmentPage": -1,
                    "isActive": true
                }
            ]
        }
    }

    await univerAPI.executeCommand(emptySpaceCommand.id, emptySpaceCommand.params, {"fromCollab": true})
    // univerAPI.executeCommand(clickCommand.id, clickCommand.params, {"fromCollab": true})

    // let cursor = new MemoryCursor()
    // cursor.reset()
    // cursor.moveCursor(3)
    // console.log("cursor", cursor)
    allSelections[mockUser.userID] = selection
    setCursors()

  }

  function setCursors() {
    const unitId = currentUniverEditable.getUnitId()
    const textSelectionService = injector.get(DocSelectionManagerService);
    const docRanges = textSelectionService.getDocRanges()
    const currentSelection = textSelectionService.getActiveTextRange()
    let selections = []

    // selections.push(
    //   {
    //     collapsed: true,
    //     direction: "none",
    //     isActive: false,
    //     startOffset: 0,
    //     endOffset: 0,
    //   }
    // )

    // for each in allSelections
    Object.keys(allSelections).forEach(author => {
      if (author === mockUser.userID) {
        return
      }
      let selection = allSelections[author]
      selections.push({
        collapsed: false,
        direction: "none",
        isActive: false,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      })
    })

    let mySelection = allSelections[mockUser.userID]

    selections.push({
      collapsed: true,
      direction: "none",
      isActive: true,
      startOffset: mySelection ? mySelection.startOffset : 0,
      endOffset: mySelection ? mySelection.endOffset : 0,
    })

    // console.log("textSelectionService", docRanges)
    // let selectionInfo = textSelectionService.getSelectionInfo()
    // console.log("selectionInfo", docRanges, currentSelection, selections)

    // replaceDocRanges(
    //     docRanges: ISuccinctDocRangeParam[],
    //     params: Nullable<IDocSelectionManagerSearchParam> = this._currentSelection,
    //     isEditing = true,
    //     options?: { [key: string]: boolean }
    // ) {

    textSelectionService.replaceDocRanges(
      selections,
      {
        unitId: unitId,
        subUnitId: unitId,
      },
      true,
      {}
    )
    
    // univerAPI.executeCommand(emptySpaceCommand.id, emptySpaceCommand.params, {"fromCollab": true})

    // textSelectionService.refreshSelection()
  }


  function extractActionsFromCommands(commands) {
    let actions = []
    commands.forEach(command => {
      if (command.params?.actions) {
        command.params.actions[1]["e"][0] ? actions.push(command.params.actions[1]["e"][0]) : null
        command.params.actions[1]["e"][1] ? actions.push(command.params.actions[1]["e"][1]): null

        // actions.push(removeSymbolFields(command.params.actions))
      }
    })
    return actions
  }

  let toCommit: any[] = []

  type PositionChange  = {
    addOrRemove: Number,
    fromPosition: Number,
  }
  let positionChanges: PositionChange[] = []

  const debouncedApplyCommandBatch = debounce(async() => {

    // ================CURSOR POSITION==================
    const textSelectionService = injector.get(DocSelectionManagerService);
    const docRanges = textSelectionService.getDocRanges()
    let currentSelection1 = textSelectionService.getActiveTextRange()
    let cursorPosition = currentSelection1.startOffset
    console.log("cursor position", cursorPosition)
    // let cursorPosition = TextX.transformPosition()
    // ================CURSOR POSITION ENDS==================
    
    console.log("sending to clerk", toCommit, chronicleEstimationLength - 1)
    const preOps = await activeBoard.session.sendOperationsToClerk(toCommit, chronicleEstimationLength - 1);
    console.log("clerksNewOperations", preOps)

    if (preOps.length === 0) {
      chronicleEstimation = chronicleEstimation.concat(toCommit)
      chronicleEstimationLength += toCommit.length
      chronicleEstimation = [...chronicleEstimation];
      toCommit = []
      return;
    }
    
    let commandSelection = {
      startOffset: toCommit[toCommit.length - 1]?.params?.textRanges[0]?.startOffset,
      endOffset: toCommit[toCommit.length - 1]?.params?.textRanges[0]?.endOffset
    }

    let localTransforms = extractActionsFromCommands(toCommit)
    let localTransformsReverse = TextX.invert(localTransforms)
    TextX.apply(currentUniverEditable.getSnapshot().body, localTransformsReverse)
    cursorPosition = TextX.transformPosition(localTransformsReverse, cursorPosition)
    console.log("applied", localTransformsReverse.length, "cursorposition", cursorPosition)
    // commandSelection = {
    //   startOffset: TextX.transformPosition(localTransformsReverse, commandSelection.startOffset),
    //   endOffset: TextX.transformPosition(localTransformsReverse, commandSelection.endOffset)
    // }
    console.log("command selection 2", commandSelection)

    for (let i = 0; i < preOps.length; i++) {
      let c = preOps[i]
      let opAuthor = c.authorId
      let cStart = c.params?.textRanges[0]?.startOffset
      let cEnd = c.params?.textRanges[0]?.startOffset
      if (cStart && cEnd) {
        allSelections[opAuthor] = {
          startOffset: cStart,
          endOffset: cEnd
        }
      }

      let operations = extractActionsFromCommands([c])
      let lastKnownCommandIndex = chronicleEstimation.findIndex(command => command.uniqueId === c.lastKnownCommandId)
      if (lastKnownCommandIndex === -1) {
        lastKnownCommandIndex = toCommit.findIndex(command => command.uniqueId === c.lastKnownCommandId)
      }
      let unknownCommands = chronicleEstimation.slice(lastKnownCommandIndex + 1)
      // .filter(op => {
      //   let opDocIndex = op.params.textRanges[0].startOffset
      //   return opDocIndex <= cDocIndex
      // })
      let unknownOps = extractActionsFromCommands(unknownCommands)
      let transforms = operations
      unknownOps.forEach(op => {
        console.log(transforms)
        let opDocIndex = op.len
        if (transforms[0] && opDocIndex < transforms[0].len) {
          transforms = TextX.transform(transforms, [op], "left")
        }
      })
      // transforms = TextX.transform(transforms, unknownOps, "left")
      
      let applyTransforms = transforms
      TextX.apply(currentUniverEditable.getSnapshot().body
      , applyTransforms)
      cursorPosition = TextX.transformPosition(applyTransforms, cursorPosition)
      console.log("applied", applyTransforms.length, "cursorposition", cursorPosition)
      
      // adjust local transforms according to transformed preOps
      transforms.forEach(op => {
        let opDocIndex = op.len
        let localTransformsDocIndex = localTransforms[0]?.len
        if (opDocIndex < localTransformsDocIndex) {
          localTransforms = TextX.transform(localTransforms, [op], "left")
        }
      })
      // localTransforms = TextX.transform(localTransforms, transforms)

      chronicleEstimation.push({
        ...c,
        transformed: transforms
      })
      chronicleEstimationLength += 1
    }

    TextX.apply(currentUniverEditable.getSnapshot().body, localTransforms)
    cursorPosition = TextX.transformPosition(localTransforms, cursorPosition)
    console.log("applied", localTransforms.length, "cursorposition", cursorPosition)
    // lastSelection = {
    //   startOffset: TextX.transformPosition(localTransforms, commandSelection.startOffset),
    //   endOffset: TextX.transformPosition(localTransforms, commandSelection.endOffset)
    // }

    chronicleEstimation = chronicleEstimation.concat(toCommit)
    chronicleEstimationLength += toCommit.length
    chronicleEstimation = [...chronicleEstimation];
    // console.log("chronicleEstimation", chronicleEstimation)
    
    // console.log("last selection", lastSelection, "command selection", commandSelection, "localTransforms", localTransforms)

    // get index of last local transform
    // let finalLocalTransformOp = localTransforms[localTransforms.length - 1]
    // let semiFinalLocalTransformOp = localTransforms[localTransforms.length - 2]

    // console.log("final local transforms", finalLocalTransformOp, semiFinalLocalTransformOp, localTransforms)
    // let finalDocIndex = 0;
    // if (finalLocalTransformOp && semiFinalLocalTransformOp && finalLocalTransformOp.len && semiFinalLocalTransformOp.len) {
    //   finalDocIndex = finalLocalTransformOp.len + semiFinalLocalTransformOp.len
    // } else if (finalLocalTransformOp && finalLocalTransformOp.len) {
    //   finalDocIndex = finalLocalTransformOp.len
    // } else if (semiFinalLocalTransformOp && semiFinalLocalTransformOp.len) {
    //   finalDocIndex = semiFinalLocalTransformOp.len
    // }

    hackRefresh({
      startOffset: cursorPosition,
      endOffset: cursorPosition
    })
    
    toCommit = []
  }, 20);
  // }, 1000);

  // Update logic wrapped in a debounced function
  const debouncedUpdate = debounce(async() => {
    if ($synState.type == "spreadsheet") {
      updateSheet();
    } else if ($synState.type == "document") {
      // console.log("commands -- ", $synState.commands)
      await updateDocument();
    } else {
      console.log("no update");
    }
  }, 20);

  onMount(async () => {
    console.log("PARTICIPANTS", Array.from(participants.entries()))
    console.log("MY PROFILE", mockUser, myProfile)
    let synSavedProfiles = $synState.users
    console.log("SYN SAVED PROFILES", synSavedProfiles)
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

    const savedBoard = await activeBoard.readableState()
    console.log("THIS IS THE BOARD", savedBoard)
    console.log($synState.spreadsheet)
    if ($synState.type === "spreadsheet") {
      // console.log("spreadsheet")
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_SHEET, $synState.spreadsheet);
    } else if ($synState.type === "document") {
      console.log("not spreadsheet")
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_DOC, $synState.spreadsheet);
      $synState.commands?.forEach(command => {
        // console.log("executing command", command)
        appliedCommandIds.push(command.uniqueId)
      })
      userManagerService.setCurrentUser(mockUser);
    } else {
      // console.log("not spreadsheet")
      currentUniverEditable = univer.createUnit(UniverInstanceType.UNIVER_SLIDE, $synState.spreadsheet);
    }
    console.log(currentUniverEditable)

    // previousState = cloneDeep($synState)
    lastReceivedState = cloneDeep($synState)
    // console.log("clonedeep", previousState)

    if ($synState.type == "spreadsheet") {
      window.addEventListener("keydown", checkKey);
      window.addEventListener("click", checkKey);
    } else if ($synState.type == "document") {
      window.addEventListener("keydown", checkKey);
    }

    // funiver = FUniver.newAPI(univer);
    // execute all commands
    // $synState.commands?.forEach(command => {
    //   console.log("executing command", command)
    //   funiver.executeCommand(command.id, command.params)
    // })

    $synState.commentCommands.forEach(comment => {
      // console.log("executing comment", comment)
      univerAPI.executeCommand(comment.id, comment.params, {"fromCollab": true})
    })

    setInterval(async() => {
      if ($clerkStatus == "found") {
        debouncedApplyCommandBatch()
      }
    }, 5000)

    univerAPI.onCommandExecuted((command, options) => {      
      // console.log("++++++++++++ command", command, "options", options)

      if (!options?.fromCollab) {
        if (command.id.includes("comment") && command.id.includes("mutation")) {
          activeBoard.requestChanges([{type: 'add-comment', comment: removeSymbolFields(changeUndefinedToEmptyString(command))}])
        }
        else if (command.id.includes("mutation")) {
          const uniqueId = uuidv1()
          let previousCommandUniqueId = lastKnownCommand ? lastKnownCommand : appliedCommandIds[appliedCommandIds.length - 1]
          lastKnownCommand = uniqueId
          // let lastKnownCommandIndex = chronicleEstimationLength - 1 //chronicleEstimation.length ? chronicleEstimation.length - 1 : -1;
          // let lastKnownCommandId = chronicleEstimation[lastKnownCommandIndex]?.uniqueId;
          // let lastKnownCommandIndex = chronicleEstimation.length - 1 + toCommit.length
          let lastKnownCommandId = toCommit.length > 0 ? toCommit[toCommit.length - 1].uniqueId : chronicleEstimation[chronicleEstimation.length - 1]?.uniqueId;
          let authorId = activeBoard.session.myPubKey;
          let commandWithId = {
            ...removeSymbolFields(command),
            uniqueId: uniqueId,
            authorId: authorId,
            previousCommandUniqueId: previousCommandUniqueId,
            // lastKnownCommandIndex,
            lastKnownCommandId
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
          let mySelectionStart = command.params?.textRanges[0]?.startOffset
          let mySelectionEnd = command.params?.textRanges[0]?.endOffset
          if (mySelectionStart && mySelectionEnd) {
            allSelections[mockUser.userID] = {
              startOffset: mySelectionStart,
              endOffset: mySelectionEnd
            }
          }
          setTimeout(() => {
            setCursors()
          }, 10)
          // debouncedApplyCommandBatch()
        }
        // if (command.id === "doc.operation.set-selections") {
        //   lastCursorPosition = command.params.ranges[0]
        // }
      }
    })

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

            {JSON.stringify($clerkStatus)}
            {JSON.stringify(chronicleEstimation.length)}
            <br>
            
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
