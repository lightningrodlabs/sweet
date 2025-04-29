<script lang="ts">
    // import { setupUniverDocs } from "./setup-univer";
    import { getContext, onMount, onDestroy } from "svelte";
    import type { CalcyStore, Board } from "./store";
    import { debounce, removeSymbolFields, changeUndefinedToEmptyString, extractJSONXFromCommands } from "./util";
    import { v1 as uuidv1 } from "uuid";
    // import { isEqual, uniqueId } from "lodash";
    import { decodeHashFromBase64, encodeHashToBase64 } from "@holochain/client";
    // import { stateFromCommitOT } from "@holochain-syn/core";
    // import { JSONX, UserManagerService } from '@univerjs/core';
    import { encode, decode } from '@msgpack/msgpack';
    import { get } from "svelte/store";
    import { createUniver, defaultTheme, LocaleType, merge, UniverInstanceType, JSONX } from '@univerjs/presets';
    import { UniverDocsCorePreset } from '@univerjs/presets/preset-docs-core';
    import UniverPresetDocsCoreEnUS from '@univerjs/presets/preset-docs-core/locales/en-US';
    import TopBar from "./shared/TopBar.svelte";
    import { RaftClient } from "./raft";

    export let activeBoard: Board
    export let profiles;
    export let myProfile;
    export let participants;
    export let standAlone = false
    export let tabView = false

    let raftClient: RaftClient;
    // export let profiles;
    // export let myProfile;
    // export let participants;
    $: sessionStore = activeBoard?.session
    $: participants = get(sessionStore.participants).active;
    $: synState = activeBoard?.readableState()

    $: if ($synState) {
        console.log("synState", $synState);
    }

    const { getStore } :any = getContext("store");
    let store: CalcyStore = getStore();

    let univerAPI;
    let loading = false;
    let toCommit = [];
    let allLogs = [];
    $: knownLogsLen = allLogs?.length;
    let unsubs = [];
    let lastTypedTime = Date.now();
    let timeToRetrieve = false;
    let acceptExternalCommands = true;
    let allSelections = {};
    let workingFromCommit = null;
    let workingFromState = null;
    let loadingMessage = "loading";
    let lastKnownCommand = null;

    $: myAgentPubKey = activeBoard?.session ? activeBoard?.session?.myPubKey : null;

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function applyCommands(preOps) {
        try {
            for (let i = toCommit.length - 1; i >= 0; i--) {
                let c = toCommit[i];

                const jsonX = JSONX.getInstance();
                let jsonxOps = extractJSONXFromCommands([c]);
                jsonxOps = JSONX.invertWithDoc(jsonxOps, univerAPI.getActiveDocument().getSnapshot().body);
                JSONX.apply(univerAPI.getActiveDocument().getSnapshot(), jsonxOps);

                // apply selections
                let opAuthor = c.authorId;
                console.log("opAuthor", opAuthor, allSelections);
                Object.keys(allSelections).forEach(author => {
                    if (opAuthor == encodeHashToBase64(myAgentPubKey)) {
                        allSelections[opAuthor] = {
                            startOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].startOffset, "right"),
                            endOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].endOffset, "right")
                        };
                    } else {
                        allSelections[author] = {
                            startOffset: JSONX.transformPosition(jsonxOps, allSelections[author].startOffset, "right"),
                            endOffset: JSONX.transformPosition(jsonxOps, allSelections[author].endOffset, "right")
                        };
                    }

                    console.log("allSelections", allSelections[author]);
                    univerAPI.getActiveDocument()?.setSelection(allSelections[author].startOffset, allSelections[author].endOffset);
                });
                
            }

            // let allTransformedOps = [];
            // const combinedOps = preOps.concat(toCommit);
            // for (let i = 0; i < combinedOps.length; i++) {
            //     let c = combinedOps[i];
            //     let opAuthor = c.authorId;

            //     if (c.id.includes("comment")) {
            //         univerAPI.executeCommand(c.id, c.params, {"fromCollab": true});
            //     } else if (c.id == 'doc.command.create-table') {
            //         univerAPI.executeCommand(c.id, c.params, {"fromCollab": true});
            //     }

            //     let jsonxOps = extractJSONXFromCommands([c]);
            //     let chronicleEstimationPreview = $chronicle.concat([c]);
            //     let firstKnownLocalCommandIndex = chronicleEstimationPreview.findIndex(command => command.uniqueId === c.firstKnownLocalCommandId);
            //     let lastKnownExternalCommandIndex = Math.max(-1, chronicleEstimationPreview.findIndex(command => command.uniqueId === c.lastKnownExternalCommandId));
            //     let unknownCommands = chronicleEstimationPreview.slice(lastKnownExternalCommandIndex + 1, firstKnownLocalCommandIndex);

            //     let transformedOps = jsonxOps;
            //     let unknownOps = extractJSONXFromCommands(unknownCommands);
            //     if (unknownOps.length > 0) {
            //         transformedOps = JSONX.transform(jsonxOps, unknownOps, "left");
            //     }

            //     allTransformedOps = allTransformedOps.concat(transformedOps);
            //     if (transformedOps.length > 0) {
            //         JSONX.apply(univerAPI.getActiveDocument().getSnapshot(), transformedOps);
            //     }

            //     Object.keys(allSelections).forEach(author => {
            //         if (opAuthor == encodeHashToBase64(myAgentPubKey)) {
            //             allSelections[opAuthor] = {
            //                 startOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].startOffset, "right"),
            //                 endOffset: JSONX.transformPosition(jsonxOps, allSelections[opAuthor].endOffset, "right")
            //             };
            //         } else {
            //             allSelections[author] = {
            //                 startOffset: JSONX.transformPosition(jsonxOps, allSelections[author].startOffset, "right"),
            //                 endOffset: JSONX.transformPosition(jsonxOps, allSelections[author].endOffset, "right")
            //             };
            //         }

            //         univerAPI.getActiveDocument()?.setSelection(allSelections[author].startOffset, allSelections[author].endOffset);
            //     });

            //     chronicleIndex++;

            //     // if (!isEqual($clerk, myAgentPubKey)) {
            //     //     activeBoard.session.saveOperationsToChronicle([{
            //     //         ...c,
            //     //         transformed: transformedOps
            //     //     }]);
            //     // }
            // }

            // if (isEqual($clerk, myAgentPubKey)) {
            //     const newSynState = {
            //         ...$synState.spreadsheet,
            //         body: univerAPI.getActiveDocument().getSnapshot().body
            //     };
            //     console.log("saving");
            //     activeBoard.requestChanges([{type: 'set-spreadsheet', spreadsheet: removeSymbolFields(newSynState)}]);
            // }

            hackRefresh();
        } catch(e) {
            console.log(e);
        }
    }

    function paragraphIndex(cursor) {
        let paragraphs = univerAPI.getActiveDocument().getSnapshot().body.paragraphs;
        for (let i = 0; i < paragraphs.length; i++) {
            let p = paragraphs[i];
            if (cursor <= p.startIndex) {
                return i;
            }
        }
        return undefined;
    }

    async function hackRefresh() {
        const unitId = univerAPI.getActiveDocument().id;

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
        };

        await univerAPI.executeCommand(emptySpaceCommand.id, emptySpaceCommand.params, {"fromCollab": true});
        univerAPI.getActiveDocument().setSelection(allSelections[encodeHashToBase64(sessionStore?.myPubKey)].startOffset, allSelections[encodeHashToBase64(sessionStore?.myPubKey)].endOffset);
    }

    const unapplyToCommit = async function() {
        console.log("unapplying this many", toCommit.length);
        for (let i = toCommit.length - 1; i >= 0; i--) {
            let c = toCommit[i];

            try {
                // const jsonX = JSONX.getInstance();
                let jsonxOps = extractJSONXFromCommands([c]);
                jsonxOps = JSONX.invertWithDoc(jsonxOps, univerAPI.getActiveDocument().getSnapshot().body);
                console.log("unapplying jsonxOps", jsonxOps);
                JSONX.apply(univerAPI.getActiveDocument().getSnapshot(), jsonxOps);
            } catch (e) {
                console.log("error unapplying", e);
            }
        }
        toCommit = [];
        hackRefresh();

        // for (let i = toCommit.length - 1; i >= 0; i--) {
        //     let c = toCommit[i];
        //     let jsonxOps = extractJSONXFromCommands([c]);
        //     JSONX.invertWithDoc(univerAPI.getActiveDocument().getSnapshot(), jsonxOps);
        // }
    }

    const applyNewLogs = async function(newLogs) {
        allLogs = allLogs.concat(newLogs);
        let opsToApply = [];
        // cycle through each log
        for (let i = 0; i < newLogs.length; i++) {
            try {
                console.log("log - to apply", newLogs[i]);
                const ops = newLogs[i]?.op?.ops;
                console.log("ops", ops, newLogs);
                if (!ops) {continue}
                // extract JSONX from log
                const jsonxOps = extractJSONXFromCommands(ops);
                console.log("jsonxOps", jsonxOps);
                // transform ops based on lastKnownLog
                const lastKnownLogForOp = newLogs[i].op.lastKnownLog;
                console.log("lastKnownLog", lastKnownLogForOp, newLogs[i]);
                console.log("allLogs", allLogs);
                // const notAppliedLogs = allLogs.slice( Math.min(lastKnownLogForOp + 1), allLogs.length);
                const indexOfLastKnownLog = allLogs.findIndex(l => l.log_id.index == lastKnownLogForOp);
                console.log("indexOfLastKnownLog", indexOfLastKnownLog);
                const notAppliedLogs = allLogs.slice(indexOfLastKnownLog + 1, allLogs.length);
                console.log("notAppliedLogs", notAppliedLogs);
                const notAppliedOps = notAppliedLogs.map(l => l.op.ops).flat().filter(o => o);
                console.log("notAppliedOps", notAppliedOps);
                if (notAppliedOps.length > 0) {
                    const extractedNotAppliedOps = extractJSONXFromCommands(notAppliedOps);
                    console.log("extractedNotAppliedOps", extractedNotAppliedOps);
                    // for (let i = 0; i < extractedNotAppliedOps.length; i+=2) {
                        //     console.log("extractedNotAppliedOps[i]", [extractedNotAppliedOps[i], extractedNotAppliedOps[i + 1]]);
                        //     JSONX.apply(univerAPI.getActiveDocument().getSnapshot(), [extractedNotAppliedOps[i], extractedNotAppliedOps[i + 1]]);
                        // }
                        // const transformable = JSONX.
                        const transformedOps = JSONX.transform(jsonxOps, extractedNotAppliedOps, "left")
                        console.log("transformedOps", transformedOps);
                        // add transformed ops to opsToApply
                        opsToApply = opsToApply.concat(transformedOps || jsonxOps);
                    } else {
                        console.log("no notAppliedOps");
                        opsToApply = opsToApply.concat(jsonxOps);
                    }
            } catch (e) {
                console.log("error applying log", e);
            }
        }
        const snapshot = univerAPI.getActiveDocument().getSnapshot();
        // console.log("snapshot", snapshot)
        if (opsToApply.length > 0) {
            console.log("applying ops", opsToApply);
            for (let i = 0; i < opsToApply.length; i+=2) {
                try {
                    const bothOps = opsToApply.slice(i, i + 2);
                    console.log("applying op", bothOps);
                    JSONX.apply(snapshot, bothOps);
                    // adjust cursur selections
                    Object.keys(allSelections).forEach(author => {
                        allSelections[author] = {
                            startOffset: JSONX.transformPosition(bothOps, allSelections[author].startOffset, "right"),
                            endOffset: JSONX.transformPosition(bothOps, allSelections[author].endOffset, "right")
                        };
                        univerAPI.getActiveDocument()?.setSelection(allSelections[author].startOffset, allSelections[author].endOffset);
                    });
                } catch (e) {
                    console.log("error apply ing op", e);
                }
            }
            // JSONX.apply(univerAPI.getActiveDocument().getSnapshot(), opsToApply);
            hackRefresh();
        }
    }

    const debouncedApplyCommandBatch = debounce(async() => {
        console.log("all known logs: ", allLogs, "knownLogsLen", knownLogsLen);
        // const preOps = await activeBoard.session.sendOperationsToClerk(toCommit, chronicleIndex);
        const uniqueId = uuidv1();
        console.log("agent pub keys", sessionStore?.myPubKey)
        const log = {
            // lastKnownLog: knownLogsLen - 1,
            lastKnownLog: allLogs.length > 0 ? allLogs[allLogs.length - 1].log_id.index : 0,
            opsUniqueId: uniqueId,
            ops: toCommit,
            fromUser: encodeHashToBase64(sessionStore?.myPubKey),
        }
        console.log("sending log", log);
        const sendOpsRes = await raftClient.proposeLog(log);
        if (!sendOpsRes?.Committed?.log_id) {
            console.log("sendOpsRes not valid", sendOpsRes);
            return;
        }
        const lastLogIndex = allLogs.length > 0 ? allLogs[allLogs.length - 1].log_id.index : 0;
        console.log("lastLog Index", lastLogIndex, allLogs[allLogs.length - 1]);
        const res = await raftClient.getLogs(lastLogIndex);
        console.log("res new logs", res);
        const indexOfMyNewLog = res.findIndex(l => l.op.opsUniqueId == uniqueId);
        // only logs up until and including my new log
        const newLogs = res.slice(0, indexOfMyNewLog + 1);
        const extraLogs = res.slice(indexOfMyNewLog + 1, res.length);
        console.log("extra Logs", extraLogs);
        console.log("new logs", newLogs);
        console.log("all logs", newLogs, knownLogsLen);
        // await applyCommands(preOps);
        await unapplyToCommit();
        await applyNewLogs(newLogs);
        
        // now, accept external commands
        acceptExternalCommands = true;
        // if (extraLogs.length > 0) {
        //     console.log("applying extra logs", extraLogs);
        //     await applyNewLogs(extraLogs);
        // }
    }, 100);

    function setupCommandListener() {
        let beforeCommandListener = univerAPI.onBeforeCommandExecute((command, options) => {
            // if (!options?.fromCollab && ["thread-comment.mutation.update-comment", "thread-comment.mutation.add-comment", "thread-comment.mutation.resolve-comment", "docs.command.delete-comment"].includes(command.id)) {
            //   activeBoard.requestChanges([{type: 'add-comment', comment: removeSymbolFields(changeUndefinedToEmptyString(command))}]);
            // }

            if (command.id == "doc.operation.set-selections" && command.params.isEditing == false) {
                allSelections[encodeHashToBase64(sessionStore?.myPubKey)] = {
                    startOffset: command.params.ranges[command.params.ranges.length - 1].startOffset,
                    endOffset: command.params.ranges[command.params.ranges.length - 1].endOffset
                };
                console.log("command", allSelections[encodeHashToBase64(sessionStore?.myPubKey)]);
            }

            if (!(command.id.includes("mutation") || command.id == 'doc.command.create-table-null') || options?.fromCollab) {return false;}

            // don't accept external commands while typing
            acceptExternalCommands = false;
            // const uniqueId = uuidv1();
            // lastKnownCommand = uniqueId;
            // let firstKnownLocalCommandId = toCommit.length > 0 ? toCommit[0].uniqueId : uniqueId;
            // let lastKnownExternalCommandId = $chronicle.length > 0 ? $chronicle[$chronicle.length - 1]?.uniqueId : null;
            // let authorId = encodeHashToBase64(activeBoard.session.myPubKey);
            // let commandWithId = {
            //     ...removeSymbolFields(command),
            //     uniqueId: uniqueId,
            //     authorId: authorId,
            //     workingFromCommit: encodeHashToBase64(workingFromCommit),
            //     lastKnownExternalCommandId,
            //     firstKnownLocalCommandId,
            // };
            // appliedCommandIds.push(uniqueId);
            // if (commandWithId.params) {
            //     toCommit.push(changeUndefinedToEmptyString(removeSymbolFields(commandWithId)));
            // }

            toCommit.push(command);
            // debouncedApplyCommandBatch();

            lastTypedTime = Date.now();
            timeToRetrieve = true;
        });
        unsubs.push(beforeCommandListener);
    }

    function setupExternalCommandListener() {
        console.log("setting up the external command listener", sessionStore.synClient.client.on);
        // const unsub = sessionStore.synClient.client.on(synSignal => {
        const unsub = sessionStore.synClient.client.on('signal', signal => {
            if (!acceptExternalCommands) {return;}
            if (!Object.keys(signal).includes("Raft")) {return;}
            if (!signal?.Raft?.event?.type == "entry_committed") {return;}
            // console.log("Raft Signal", signal);
            const newLog = signal.Raft.event.value;
            console.log("newLog", newLog);
            const newLogData = decode(newLog.data);
            console.log("newLogData", newLogData);
            const prevOpIndex = newLogData.lastKnownLog;
            const myLastLogIndex = allLogs.length > 0 ? allLogs[allLogs.length - 1].log_id.index : 0;
            // console.log("myLastLogIndex", myLastLogIndex);   
            // console.log("prevOpIndex", prevOpIndex);
            // check if log_id is not mine
            console.log("new op?", newLogData.fromUser, "==", encodeHashToBase64(sessionStore?.myPubKey));
            if (newLogData.fromUser != encodeHashToBase64(sessionStore?.myPubKey)) {
                applyNewLogs([{
                    log_id: newLog.log_id,
                    op: newLogData
                }]);
            }
            // const synSignal = signal.data;

            // if (!($clerkStatus == "found" && Date.now() - lastTypedTime > 200 && !timeToRetrieve)) return;
            // if (synSignal.type !== 'SessionMessage') return;

            // const message = synSignal.message;
            // if (
            //     message &&
            //     isEqual(message.workspace_hash, activeBoard?.workspace.workspaceHash)
            // ) {
            //     if (message.payload.type === 'NewOperationsBroadcast') {
            //         if (message.payload.operations.length > 0 && toCommit.length == 0 && !timeToRetrieve) {
            //             const decodedOps = message.payload.operations.map(c => decode(c));
            //             applyCommands(decodedOps);
            //         }
            //     }
            // }

        });
        unsubs.push(unsub);
    }

    // async function waitToFindClerk() {
    //     let foundClerk = false;
    //     let maxTime = setTimeout(() => {
    //         foundClerk = true;
    //     }, 150000);
    //     while (!foundClerk) {
    //         if ($clerkStatus == "found") {
    //             foundClerk = true;
    //             clearTimeout(maxTime);
    //         }
    //         await delay(100);
    //     }
    // }

    // async function getDocumentState(fromCommitHash) {
    //     let wfc = fromCommitHash;
    //     if (!wfc) {
    //         const commits = await activeBoard.session.synClient.getWorkspaceTips(activeBoard.workspace.workspaceHash);
    //         wfc = commits[commits.length - 1].target;
    //     }
    //     const latestCommitState = await activeBoard.session.synClient.getCommit(wfc);
    //     const decodedCommitState = decode(latestCommitState.record.entry.Present.entry);
    //     const fullDocument = stateFromCommitOT(decodedCommitState);
    //     return [fullDocument, wfc];
    // }

    // async function setWorkingFromCommit() {
    //     try {
    //         if (participants.length > 1) {
    //             loadingMessage = "joining session";
    //             const waitClerkProcess = await waitToFindClerk();
    //             unsubs.push(waitClerkProcess);
    //             console.log("workingFromCommit", workingFromCommit);
    //             console.log(encodeHashToBase64($clerk));
    //             const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0).catch((e) => {console.log(e)});
    //             const wfc = initialCommits[0] ? decodeHashFromBase64(initialCommits[0].workingFromCommit) : null;
    //             const [fullDocument, latestHash] = await getDocumentState(wfc);
    //             workingFromCommit = latestHash;
    //             workingFromState = fullDocument;
    //             console.log("workingFromCommit 0", workingFromCommit);
    //         } else {
    //             loadingMessage = "opening document";
    //             console.log("participants", participants);
    //             const [fullDocument, latestHash] = await getDocumentState(null);
    //             workingFromCommit = latestHash;
    //             workingFromState = fullDocument;
    //             console.log("workingFromCommit 2", workingFromCommit);
    //         }
    //     } catch (error) {
    //         console.error("An error occurred:", error);
    //     } finally {
    //         const waitClerkProcess = await waitToFindClerk();
    //         unsubs.push(waitClerkProcess);
    //         console.log(encodeHashToBase64($clerk));
    //         const initialCommits = await activeBoard.session.sendOperationsToClerk([], 0).catch((e) => {console.log(e)});
    //         const wfc = (initialCommits && initialCommits[0]) ? decodeHashFromBase64(initialCommits[0].workingFromCommit) : null;
    //         const [fullDocument, latestHash] = await getDocumentState(wfc);
    //         workingFromCommit = latestHash;
    //         workingFromState = fullDocument;
    //         console.log("workingFromCommit 3", workingFromCommit);
    //         debouncedApplyCommandBatch();

    //         allSelections[encodeHashToBase64(activeBoard.session.myPubKey)] = {
    //             startOffset: 0,
    //             endOffset: 0
    //         };
    //     }
    // }

    // async function setUsers() {
    //     const injector = univer.__getInjector();
    //     const userManagerService = injector.get(UserManagerService);
    //     let synSavedProfiles = $synState.users;
    //     const localUser = {
    //         userID: encodeHashToBase64(myAgentPubKey),
    //         name: myProfile.entry.nickname || "Anonymous User",
    //         avatar: myProfile.entry.fields.avatar,
    //         anonymous: false,
    //         canBindAnonymous: true,
    //     };
    //     console.log("localUser", localUser);
    //     let userIdFound = false;
    //     synSavedProfiles.forEach(profile => {
    //         if (profile.userID != localUser.userID) {
    //             userManagerService.addUser(profile);
    //         } else {
    //             userIdFound = true;
    //         }
    //     });
    //     if (!userIdFound) {
    //         activeBoard.requestChanges([{type: 'add-user', user: localUser}]);
    //     }

    //     userManagerService.setCurrentUser(localUser);
    // }

    // async function addSavedComments() {
    //     $synState.commentCommands.forEach(comment => {
    //         const cleanedComment = removeSymbolFields(changeUndefinedToEmptyString(comment));
    //         console.log("comment", cleanedComment);
    //         univerAPI.executeCommand(cleanedComment.id, cleanedComment.params, {"fromCollab": true});
    //     });
    // }

    function startSyncInterval() {
        const applyCommandBatchInterval = setInterval(async() => {
            if (Date.now() - lastTypedTime > 200 && timeToRetrieve) {
                timeToRetrieve = false;
                await debouncedApplyCommandBatch();
            }
        }, 500);
        unsubs.push(applyCommandBatchInterval);
    }

    onMount(async () => {
        raftClient = await new RaftClient(activeBoard.session.synClient.client, 'calcy', activeBoard.workspace.workspaceHash);
        console.log("raftClient", raftClient);
        const join = await raftClient.joinRaft(participants);
        console.log("join", join);

        const { univer, univerAPI: uAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
            [LocaleType.EN_US]: merge(
            {},
            UniverPresetDocsCoreEnUS,
            ),
        },
        theme: defaultTheme,
        presets: [
            UniverDocsCorePreset({
            container: 'univer',
            }),
        ],
        });

        univerAPI = uAPI;
        
        univerAPI.createUniverDoc({});
        
        // await setUsers();
        // loading = false;
        // await addSavedComments();
        allLogs = await raftClient.getLogs(0);
        console.log("applying first logs", allLogs);
        applyNewLogs(allLogs);
        setupCommandListener();
        setupExternalCommandListener();
        startSyncInterval();
    });

    onDestroy(async () => {
        // if (isEqual($clerk, myAgentPubKey)) {
        //     await activeBoard.session.commitChanges();
        // }
        const x = "hiik"
        unsubs.forEach(p => clearInterval(p));
        unsubs.forEach(u => u());
    });
</script>

<div id="app">
    {#if loading}
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw;">
        {loadingMessage}
        <sl-spinner></sl-spinner>
      </div>
    {/if}

    <TopBar
        activeBoard={activeBoard}
        profiles={profiles}
        myProfile={myProfile}
        participants={participants}
        raftClient={raftClient}
        univerAPI={univerAPI}
        standAlone={standAlone}
        tabView={tabView}
        store={store}
        synState={synState}
    />

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
        color: white;
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
        background: transparent;
        border: none;
        border-radius: 5px;
        padding: 0;
        display: flex;
        transform: scale(1);
        align-items: center;
        justify-content: center;
        transition: all .1s ease;
    }
  
    .board-button:hover {
        transform: scale(1.2);
    }

    .board-button:active {
        box-shadow: 0px 8px 10px rgba(53, 39, 211, 0.35);
        transform: scale(1.1);
    }
</style>
