<script lang="ts">
    import { setupUniverDocs, setupUniverSheets } from "./setup-univer";
    import { getContext, onMount, onDestroy } from "svelte";
    import type { CalcyStore } from "./store";
    import { debounce, removeSymbolFields, changeUndefinedToEmptyString, extractActionsFromCommands, extractJSONXFromCommands } from "./util";
    import { v1 as uuidv1 } from "uuid";
    import { cloneDeep, isEqual } from "lodash";
    import { decodeHashFromBase64, encodeHashToBase64, type Timestamp, type Link } from "@holochain/client";
    import { SynClient, stateFromCommitOT, type Commit, type SessionMessage } from "@leosprograms/syn-core";
    import type { WAL } from "@lightningrodlabs/we-applet";
    import { LocaleType, LogLevel, ILogService, LocaleService, Univer, UniverInstanceType, type JSONXActions, type ICommand, TextXActionType, TextX, 
            JSONX, ICommandService, CommandService, UserManagerService , Tools, IUniverInstanceService, MemoryCursor, type DocumentDataModel} from '@univerjs/core';
    import type { Doc, JSONOp, Path } from 'ot-json1';
    import type {  Board, BoardDelta, BoardProps } from "./board";
    import { encode, decode } from '@msgpack/msgpack';
    import { DocSelectionManagerService } from '@univerjs/docs';
    import { exportBoard } from "./export";
    import Participants from "./Participants.svelte";
    import Avatar from "./Avatar.svelte";
    import SvgIcon from "./SvgIcon.svelte";
    import EditBoardDialog from "./EditBoardDialog.svelte";
    import AttachmentsDialog from "./AttachmentsDialog.svelte";
    import AttachmentsList from "./AttachmentsList.svelte";

    export let activeBoard: Board
    export let profiles;
    export let myProfile;
    export let participants;
    export let standAlone = false
    export let tabView = false

    const { getStore } :any = getContext("store");
    let store: CalcyStore = getStore();
    let univerAPI;
    let univer;
    let loading: boolean = false;
    let loadingMessage: string = "loading..."
    let unsubs = [];
    let toCommit = []
    let appliedCommandIds = []
    let lastKnownCommand = null
    let workingFromCommit = null
    let workingFromState = null
    let lastTypedTime = Date.now()
    let timeToRetrieve = false
    let chronicleIndex = -1
    // let currentSelection = [0, 0]
    let allSelections = {}
    let attachmentsDialog : AttachmentsDialog

    $: synState = activeBoard.readableState()
    $: clerkStatus = activeBoard.session ? activeBoard.session.clerkStatus : null
    $: clerk = activeBoard?.session ? activeBoard?.session?.clerk : null
    $: chronicle = activeBoard?.session ? activeBoard?.session?.chronicle : null

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function applyCommands(preOps) {
        try {
            console.log("clerksNewOperations", preOps)
            
            // ==================UN-APPLY MY OPERATIONS==================
            for (let i = toCommit.length - 1; i >= 0; i--) {
                let c = toCommit[i]

                const jsonX = JSONX.getInstance();
                let jsonxOps: JSONOp = extractJSONXFromCommands([c])
                console.log("jsonxOps", jsonxOps)
                jsonxOps = JSONX.invertWithDoc(jsonxOps, univerAPI.getActiveWorkbook().save().body)
                console.log("jsonxOps", jsonxOps)
                JSONX.apply(univerAPI.getActiveWorkbook().save(), jsonxOps)
                console.log("unapplied", univerAPI.getActiveWorkbook().save().body)

                if (false) {
                    // console.log("to commit", extractHumanReadableFromCommands([c])[0])
                    let operations = extractActionsFromCommands([c])
                    // if (operations.find(op => op.t == "d" || op.t == "r")) {
                        operations = TextX.makeInvertible(operations, univerAPI.getActiveWorkbook().save().body)
                    // }
                    let reversedOps = TextX.invert(operations)
                    TextX.apply(univerAPI.getActiveWorkbook().save().body, reversedOps)
                }
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
                } else if (c.id == 'doc.command.create-table') {
                    univerAPI.executeCommand(c.id, c.params, {"fromCollab": true})
                }
                
                // let operations = extractActionsFromCommands([c])
                let jsonxOps = extractJSONXFromCommands([c])
                let chronicleEstimationPreview = $chronicle.concat([c])
                let firstKnownLocalCommandIndex = chronicleEstimationPreview.findIndex(command => command.uniqueId === c.firstKnownLocalCommandId)
                let lastKnownExternalCommandIndex = Math.max(-1, chronicleEstimationPreview.findIndex(command => command.uniqueId === c.lastKnownExternalCommandId))
                let unknownCommands = chronicleEstimationPreview.slice(lastKnownExternalCommandIndex + 1, firstKnownLocalCommandIndex)
            
                // ****adjust clerk's new operations according to their unknown ops****
                let transformedOps = jsonxOps
                let unknownOps = extractJSONXFromCommands(unknownCommands)
                if (unknownOps.length > 0) {
                    // let unknownOps = extractActionsFromCommands(unknownCommands)
                    // let transformedOps = TextX.transform(operations, unknownOps)
                    console.log('transforming', jsonxOps, unknownCommands)
                    transformedOps = JSONX.transform(jsonxOps, unknownOps, "left")
                }

                // console.log("currentSelection", currentSelection)
                // let lastRetainPosition = unknownOps[0]?.len ? unknownOps[0].len : 0
                
                allTransformedOps = allTransformedOps.concat(transformedOps)
                // TextX.apply(univerAPI.getActiveWorkbook().save().body
                // , transformedOps)
                if (transformedOps.length > 0) {
                    JSONX.apply(univerAPI.getActiveWorkbook().save(), transformedOps)
                }

                Object.keys(allSelections).forEach(author => {
                    console.log("author", author, opAuthor)
                    if (opAuthor == encodeHashToBase64(store.myAgentPubKey)) {
                        console.log("author 2", author)
                        // const opPos = transformedOps[transformedOps.length - 2]?.len + transformedOps[transformedOps.length - 1]?.len
                        // allSelections[opAuthor] = {
                        //     startOffset: opPos ? opPos : TextX.transformPosition(transformedOps, allSelections[opAuthor].startOffset),
                        //     endOffset: opPos ? opPos : TextX.transformPosition(transformedOps, allSelections[opAuthor].endOffset)
                        // }

                        // console.log("current selection", allSelections[opAuthor].startOffset)

                        allSelections[opAuthor] = {
                            // startOffset: TextX.transformPosition(transformedOps, allSelections[opAuthor].startOffset),
                            // endOffset: TextX.transformPosition(transformedOps, allSelections[opAuthor].endOffset)
                            startOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].startOffset, "right"),
                            endOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].endOffset, "right")
                        }

                        console.log("transformed selection", allSelections[opAuthor].startOffset)

                        // const injector = univer.__getInjector();
                        // const docSelectionManagerService = injector.get(DocSelectionManagerService);
                    //     const y = docSelectionManagerService.getDocRanges();
                    //     console.log("current position", y)
                    //     const transformedRange = [TextX.transformPosition(transformedOps, y[0].startOffset), TextX.transformPosition(transformedOps, y[0].endOffset)]
                    //     console.log("transformed position", transformedRange)
                        // univerAPI.getActiveWorkbook()?.setSelection(transformedRange[0], transformedRange[1])
                    } else {
                        allSelections[author] = {
                            startOffset: JSONX.transformPosition(jsonxOps, allSelections[author].startOffset, "right"),
                            endOffset: JSONX.transformPosition(jsonxOps, allSelections[author].endOffset, "right")
                        }

                        // let cStart = transformedOps[0]?.len
                        // let cAdd = transformedOps[1]?.len
                        // let opPos = cAdd ? cStart + cAdd : cStart
                        // let opParagraphIndex = paragraphIndex(opPos)
                        // // let operations = extractActionsFromCommands([c])

                        // console.log(cStart, cAdd, opPos, opParagraphIndex)

                        // // console.log("inBetweenString", paragraphIndex(allSelections[author].startOffset), paragraphIndex(allSelections[author].endOffset))
                        // if (opPos <= allSelections[author].startOffset
                        //     && paragraphIndex(allSelections[author].startOffset) == opParagraphIndex
                        // ) {
                        //     // allSelections[author].startOffset = TextX.transformPosition(operations, allSelections[author].startOffset)
                        //     allSelections[author].startOffset = JSONX.transformPosition(jsonxOps, allSelections[author].startOffset, "right")
                        // }
                        // if (opPos <= allSelections[author].endOffset
                        //     && paragraphIndex(allSelections[author].endOffset) == opParagraphIndex
                        // ) {
                        //     // allSelections[author].endOffset = TextX.transformPosition(transformedOps, allSelections[author].endOffset)
                        //     allSelections[author].endOffset = JSONX.transformPosition(jsonxOps, allSelections[author].endOffset, "right")
                        // }
                    }

                    univerAPI.getActiveWorkbook()?.setSelection(allSelections[author].startOffset, allSelections[author].endOffset)
                })

                chronicleIndex ++

                // SAVE CHRONICLE IF I'M NOT THE CLERK
                // console.log(isEqual($clerk, store.myAgentPubKey))
                if (!isEqual($clerk, store.myAgentPubKey)) {
                    activeBoard.session.saveOperationsToChronicle([{
                        ...c,
                        transformed: transformedOps
                    }])
                }
            }

            // SAVE DOCUMENT IF I'M THE CLERK
            if (isEqual($clerk, store.myAgentPubKey)) {
                const newSynState = {
                    ...$synState.spreadsheet,
                    body: univerAPI.getActiveWorkbook().save().body
                }
                activeBoard.requestChanges([{type: 'set-spreadsheet', spreadsheet: removeSymbolFields(newSynState)}])
            }


            hackRefresh()
            // safeToTypeAgain()
            // console.log("allTransformedOps", allTransformedOps)
        } catch(e) {
            console.log(e)
        // safeToTypeAgain()
        }
    }

    function paragraphIndex(cursor: number): number | undefined {
        let paragraphs = univerAPI.getActiveWorkbook().save().body.paragraphs;
        for (let i = 0; i < paragraphs.length; i++) {
            let p = paragraphs[i];
            if (cursor <= p.startIndex) {
                return i;
            }
        }
        return undefined;
    }

    async function hackRefresh() {
        const unitId = univerAPI.getActiveWorkbook().id

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
        univerAPI.getActiveWorkbook().setSelection(allSelections[encodeHashToBase64(activeBoard.session.myPubKey)].startOffset, allSelections[encodeHashToBase64(activeBoard.session.myPubKey)].endOffset)
    }

    const debouncedApplyCommandBatch = debounce(async() => {
        const preOps = await activeBoard.session.sendOperationsToClerk(toCommit, chronicleIndex);
        // const preOps = await activeBoard.session.sendOperationsToClerk(toCommit, 0);
        // console.log("preOps", preOps)
        await applyCommands(preOps)
        toCommit = []
    }, 100);

    function setupCommandListener() {
        let beforeCommandListener = univerAPI.onBeforeCommandExecute((command, options) => {
            // console.log("beforeCommandListerner", command, options);

            if (command.id == "doc.operation.set-selections" && command.params.isEditing == false) {
                allSelections[encodeHashToBase64(activeBoard.session.myPubKey)] = {
                    startOffset: command.params.ranges[command.params.ranges.length - 1].startOffset,
                    endOffset: command.params.ranges[command.params.ranges.length - 1].endOffset
                }
            }

            if (!(command.id.includes("mutation") || command.id == 'doc.command.create-table-null') || options?.fromCollab) {return false;} //local mutations only
            // console.log("beforeCommandListerner", command, options);

            const uniqueId = uuidv1()
            lastKnownCommand = uniqueId
            let firstKnownLocalCommandId = toCommit.length > 0 ? toCommit[0].uniqueId : uniqueId;
            let lastKnownExternalCommandId = $chronicle.length > 0 ? $chronicle[$chronicle.length - 1]?.uniqueId : null;
            let authorId = encodeHashToBase64(activeBoard.session.myPubKey);
            let commandWithId = {
                ...removeSymbolFields(command),
                uniqueId: uniqueId,
                authorId: authorId,
                workingFromCommit: encodeHashToBase64(workingFromCommit),
                lastKnownExternalCommandId,
                firstKnownLocalCommandId,
            }
            appliedCommandIds.push(uniqueId)
            if (commandWithId.params) {
                toCommit.push(changeUndefinedToEmptyString(removeSymbolFields(commandWithId)))
            }
            lastTypedTime = Date.now()
            timeToRetrieve = true
        });
        unsubs.push(beforeCommandListener)
    }

    function setupExternalCommandListener() {
        const unsub = activeBoard.session.synClient.onSignal(synSignal => {
            if (!($clerkStatus == "found" && Date.now() - lastTypedTime > 200 && !timeToRetrieve)) return;
            if (synSignal.type !== 'SessionMessage') return;

            const message: SessionMessage = synSignal.message;
            if (
                message &&
                isEqual(message.workspace_hash, activeBoard.workspace.workspaceHash)
            ) {
                if (message.payload.type === 'NewOperationsBroadcast') {
                    // console.log("New Operations Broadcast", message.payload.operations.map(c => decode(c) as any))
                    if (message.payload.operations.length > 0 && toCommit.length == 0 && !timeToRetrieve) {
                        const decodedOps = message.payload.operations.map(c => decode(c) as any)
                        console.log("decodedOps", decodedOps)
                        applyCommands(decodedOps)
                    }
                }
            }

        });
        unsubs.push(unsub)
    }

    async function waitToFindClerk() {
        let foundClerk = false
        let maxTime = setTimeout(() => {
            foundClerk = true
        }, 150000)
        while (!foundClerk) {
        if ($clerkStatus == "found") {
            foundClerk = true
            clearTimeout(maxTime)
        }
            await delay(100)
        }
    }

    async function getDocumentState(fromCommitHash?): Promise<[any, Uint8Array]> {
        let wfc: Uint8Array = fromCommitHash;
        if (!wfc) {
            const commits = await activeBoard.session.synClient.getWorkspaceTips(activeBoard.workspace.workspaceHash)
            wfc = commits[commits.length - 1].target
        }
        const latestCommitState = await activeBoard.session.synClient.getCommit(wfc)
        const decodedCommitState = decode(latestCommitState.record.entry.Present.entry as Commit)
        const fullDocument = stateFromCommitOT(decodedCommitState)
        return [fullDocument, wfc]
    }

    async function setWorkingFromCommit() {
        try {
            // If other agents online, wait to find clerk and then document
            if (participants.length > 1) {
                loadingMessage = "joining session"
                const waitClerkProcess = await waitToFindClerk()
                unsubs.push(waitClerkProcess)
                console.log("workingFromCommit", workingFromCommit)
                console.log(encodeHashToBase64($clerk))
                const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0).catch((e) => {console.log(e)})
                const wfc: Uint8Array = initialCommits[0] ? decodeHashFromBase64(initialCommits[0].workingFromCommit) as Uint8Array : null
                const [fullDocument, latestHash] = await getDocumentState(wfc)
                workingFromCommit = latestHash as Uint8Array
                workingFromState = fullDocument
                console.log("workingFromCommit 0", workingFromCommit)
            }
            // If no other agents online, load last document and assign myself clerk
            else {
                loadingMessage = "opening document"
                console.log("participants", participants)
                const [fullDocument, latestHash] = await getDocumentState(null)
                workingFromCommit = latestHash as Uint8Array
                workingFromState = fullDocument
                console.log("workingFromCommit 2", workingFromCommit)
            }
            } catch (error) {
                console.error("An error occurred:", error);
            } finally {
                // If above process fails, try again
                const waitClerkProcess = await waitToFindClerk()
                unsubs.push(waitClerkProcess)
                console.log(encodeHashToBase64($clerk))
                const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0).catch((e) => {console.log(e)})
                const wfc: Uint8Array = (initialCommits && initialCommits[0]) ? decodeHashFromBase64(initialCommits[0].workingFromCommit) as Uint8Array : null
                const [fullDocument, latestHash] = await getDocumentState(wfc)
                workingFromCommit = latestHash as Uint8Array
                workingFromState = fullDocument
                console.log("workingFromCommit 3", workingFromCommit)
                // debouncedApplyCommandBatch()

                allSelections[encodeHashToBase64(activeBoard.session.myPubKey)] = {
                    startOffset: 0,
                    endOffset: 0
                }
            }
    }

    async function setUsers() {
        const injector = univer.__getInjector();
        const userManagerService = injector.get(UserManagerService);
        let synSavedProfiles = $synState.users
        const localUser = {
            userID: encodeHashToBase64(store.myAgentPubKey),
            name: myProfile.entry.nickname || "Anonymous User",
            avatar: myProfile.entry.fields.avatar,
            anonymous: false,
            canBindAnonymous: true,
        };
        console.log("localUser", localUser)
        let userIdFound = false
        synSavedProfiles.forEach(profile => {
        if (profile.userID != localUser.userID) {
            userManagerService.addUser(profile)
        } else {
            userIdFound = true
        }
        })
        // add-user request to syn
        if (!userIdFound) {
            activeBoard.requestChanges([{type: 'add-user', user: localUser}])
        }

        userManagerService.setCurrentUser(localUser);
    }

    function startSyncInterval() {
        const applyCommandBatchInterval = setInterval(async() => {
        if ($clerkStatus == "found" && Date.now() - lastTypedTime > 200 && timeToRetrieve) {
            timeToRetrieve = false
            await debouncedApplyCommandBatch()
        }
        }, 500)
        unsubs.push(applyCommandBatchInterval)
    }

    const copyWalToPocket = () => {
        const attachment: WAL = { hrl: [store.dnaHash, activeBoard.hash], context: JSON.stringify({docType: 'document'}) }
        store.weClient?.walToPocket(attachment)
    }

    const closeBoard = async () => {
        await store.closeActiveBoard(false);
    };

    const leaveBoard = async () => {
        await store.closeActiveBoard(true);
    };

    const leaveSession = async () => {
        await activeBoard.session.initiateElection()
        await activeBoard.session.leaveSession()
    }

    let editBoardDialog

    onMount(async () => {
        loading = true
        // setupToolbar(univerAPI)
        await setWorkingFromCommit()
        // const res = await setupUniverDocs();
        const res = await setupUniverSheets();
        univerAPI = res[0]
        univer = res[1]
        setUsers()
        loading = false
        // setupCommandListener()
        // setupExternalCommandListener()
        // startSyncInterval()
    });

    onDestroy( async () => {
        if (isEqual($clerk, store.myAgentPubKey)) {
            let resTip = await activeBoard.session.commitChanges()
            // leaveSession()
        }
        unsubs.forEach(p => clearInterval(p))
        unsubs.forEach(u => u)
    })
</script>

<div id="app">
  <div class="board" >
    <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
    <!-- {JSON.stringify($synState.spreadsheet)} -->
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
                <!-- <button
                on:click={
                    console.log(univerAPI.getActiveWorkbook().getBody().dataStream)
                }
                >
                Console
                </button> -->

                <!-- <button
                on:click={
                    console.log($chronicle)
                }
                >
                Chronicle
                </button> -->

                <!-- {JSON.stringify($chronicle.length)} -->

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
    </div>

    {#if loading}
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw;">
    {loadingMessage}
    <sl-spinner></sl-spinner>
    </div>
    {/if}

    <div id="toolbar"></div>
    <div id="univer"></div>
</div>

<style>
    #univer {
        height: 100vh;
        width: 100vw;
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
        background-color: #f9fbfd;
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
</style>