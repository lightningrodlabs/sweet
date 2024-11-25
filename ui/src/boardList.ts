import { HoloHashMap, LazyHoloHashMap } from "@holochain-open-dev/utils";
import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { type AgentPubKey, type EntryHash, type EntryHashB64, encodeHashToBase64 } from "@holochain/client";
import {toPromise, type AsyncReadable, pipe, joinAsync, asyncDerived, sliceAndJoin, alwaysSubscribed} from '@holochain-open-dev/stores'
import { OTSynStore, OTWorkspaceStore } from "@leosprograms/syn-core";
import type { ProfilesStore } from "@holochain-open-dev/profiles";
import { cloneDeep } from "lodash";
import { Board, type BoardDelta, type BoardState } from "./board";
import { hashEqual } from "./util";


import { LocaleType, LogLevel, Univer, UniverInstanceType, UserManagerService , Tools } from '@univerjs/core';

import ThreadCommentUIEnUS from '@univerjs/thread-comment-ui/locale/en-US';
import SheetsThreadCommentEnUS from '@univerjs/sheets-thread-comment/locale/en-US';

import DesignEnUS from '@univerjs/design/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';

import { defaultTheme } from "@univerjs/design";
import { UniverDocsPlugin } from "@univerjs/docs";
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverSheetsPlugin } from "@univerjs/sheets";
import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
import { UniverUIPlugin } from "@univerjs/ui";

import { UniverExchangeClientPlugin } from '@univerjs-pro/exchange-client';
import { UniverSheetsExchangeClientPlugin } from '@univerjs-pro/sheets-exchange-client';

import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
// import { UniverDebuggerPlugin } from '@univerjs/debugger';
// import { UniverDocsDrawingUIPlugin } from '@univerjs/docs-drawing-ui';

import { IThreadCommentMentionDataService, UniverThreadCommentUIPlugin } from '@univerjs/thread-comment-ui';
import { UniverSheetsThreadCommentPlugin } from '@univerjs/sheets-thread-comment';

import { UniverSlidesPlugin } from '@univerjs/slides';
import { UniverSlidesUIPlugin } from '@univerjs/slides-ui';

export enum BoardType {
    active = "active",
    spreadsheet = "activespreadsheet",
    document = "document",
    presentation = "presentation",
    archived = "archived"
}

export interface TypedHash {
    hash: EntryHash
    type: BoardType
}

export interface BoardAndLatestState {
    board: Board,
    latestState: BoardState,
    tip: EntryHash,
}

export class BoardList {
    activeBoardHashes: AsyncReadable<EntryHash[]>
    archivedBoardHashes: AsyncReadable<EntryHash[]>
 //   typedHashes: AsyncReadable<Array<TypedHash>>
    activeBoard: Writable<Board| undefined> = writable(undefined)
    allBoards: AsyncReadable<ReadonlyMap<Uint8Array, BoardAndLatestState>>
    activeBoardHash: Writable<EntryHash| undefined> = writable(undefined)
    activeBoardHashB64: Readable<string| undefined> = derived(this.activeBoardHash, s=> s ? encodeHashToBase64(s): undefined)
    boardCount: AsyncReadable<number>

    boardData2 = new LazyHoloHashMap( documentHash => {
        const docStore = this.synStore.documents.get(documentHash)

        const board = pipe(docStore.allWorkspaces,
            workspaces => 
                new Board(docStore,  new OTWorkspaceStore(docStore, Array.from(workspaces.keys())[0]))
        )
        const latestState = pipe(board, 
            board => board.workspace.latestState
            )
        const tip = pipe(board,
            board => board.workspace.tip
            )
return alwaysSubscribed(pipe(joinAsync([tip, latestState, board]), ([tip, latestState, board]) => {return {board, latestState, tip: tip ? tip.entryHash : undefined}}))
    })


    agentBoardHashes: LazyHoloHashMap<AgentPubKey, AsyncReadable<Array<BoardAndLatestState>>> = new LazyHoloHashMap(agent =>
        pipe(this.activeBoardHashes,
            documentHashes => joinAsync(documentHashes.map(documentHash=>this.synStore.documents.get(documentHash).allAuthors), {errors: "filter_out"}),
            (documentsAuthors, documentHashes) => {
                const agentBoardHashes: AsyncReadable<BoardAndLatestState>[] = []
                const b64 = encodeHashToBase64(agent)
                for (let i = 0; i< documentsAuthors.length; i+=1) {
                    if (documentsAuthors[i].find(a=>encodeHashToBase64(a) == b64)) {
                        const hash = documentHashes[i]
                        //const state = this.boardData2.get(hash).workspace.latestSnapshot
                        //agentDocuments.push(asyncDerived(state, state=>{return {hash, state}}))
                        const x = this.boardData2.get(hash)
                        if (x) {
                            agentBoardHashes.push(x)
                        }
                    }
                }
                return joinAsync(agentBoardHashes, {errors: "filter_out"})
            },
        )
    )
        
    allAgentBoards: AsyncReadable<ReadonlyMap<AgentPubKey, Array<BoardAndLatestState>>>
    allAuthorAgents: AsyncReadable<AgentPubKey[]>

    constructor(public profilseStore: ProfilesStore, public synStore: OTSynStore) {
        this.allAgentBoards = pipe(this.profilseStore.agentsWithProfile,
            agents=>{
                return sliceAndJoin(this.agentBoardHashes, agents, {errors: "filter_out"})
            }
        )
   
        const boardHashes = asyncDerived(this.synStore.documentsByTag.get(BoardType.active),x=>Array.from(x.keys()))
        this.activeBoardHashes = boardHashes
        const archivedHashes = asyncDerived(this.synStore.documentsByTag.get(BoardType.archived),x=>Array.from(x.keys()))
        this.archivedBoardHashes = archivedHashes

        const allDocumentAuthors = pipe(this.activeBoardHashes,
            documentHashes => joinAsync(documentHashes.map(documentHash=>this.synStore.documents.get(documentHash).allAuthors), {errors: "filter_out"}),
            )
        this.allAuthorAgents = asyncDerived(allDocumentAuthors, (docAuthors) => {
            const authors: HoloHashMap<AgentPubKey, boolean> = new HoloHashMap()
            for (let v of Array.from(docAuthors.values())) {
                v.forEach((a)=> authors.set(a, true))
            }
            return Array.from(authors.keys())
        })

        // const activeTypedHashes = asyncDerived(boardHashes, hashes=>hashes.map(hash=>{const h:TypedHash = {hash, type:BoardType.active}; return h}))
        // const archivedTypedHashes = asyncDerived(archivedHashes, hashes=>hashes.map(hash=>{const h:TypedHash = {hash,type:BoardType.archived}; return h}))

        // const joinedTyped = joinAsync([activeTypedHashes, archivedTypedHashes])
        // this.typedHashes = asyncDerived(joinedTyped, 
        //     ([active,archived]) => [...active, ...archived]
        //     )

        const joined = joinAsync([boardHashes, archivedHashes])

        const asyncJoined = asyncDerived(joined, 
            ([boards,archived]) => [...boards, ...archived]
            )
        this.allBoards = pipe(asyncJoined,
            docHashes => sliceAndJoin(this.boardData2, docHashes, {errors: "filter_out"})
        )
        this.boardCount =  asyncDerived(joined,
            ([boards,archived]) => boards.length + archived.length
        )
    }
    
    async getBoard(documentHash: EntryHash) : Promise<Board | undefined> {
        if (!documentHash) return undefined
        const board = await toPromise(this.boardData2.get(documentHash))
        return board.board
    }

    async setActiveBoard(hash: EntryHash | undefined) : Promise<Board | undefined> {
        let board: Board | undefined = undefined
        const current = get(this.activeBoard)
        // if no change then don't update
        if (!current && !hash) return
        if (current && hash && hashEqual(hash, current.hash)) return

        if (hash) {
            board = (await toPromise(this.boardData2.get(hash))).board
            if (board) {
                let sessionParticipants = await toPromise(board.sessionParticipants())
                await board.join()
                this.activeBoard.update((n) => {return board} )
            } else {
                console.log("NO BOARD")
            }
        } else {
            this.activeBoard.update((n) => {return undefined} )
        }
        this.activeBoardHash.update((n) => {return hash} )

        return board
    }

    async archiveBoard(documentHash: EntryHash) : Promise<boolean> {
        let wasActive = false
        await this.synStore.client.removeDocumentTag(documentHash, BoardType.active)
        await this.synStore.client.tagDocument(documentHash, BoardType.archived)
        if (encodeHashToBase64(get(this.activeBoardHash)) == encodeHashToBase64(documentHash)) {
            await this.setActiveBoard(undefined)
            wasActive = true
        }
        return wasActive
    }

    async unarchiveBoard(documentHash: EntryHash) {
        await this.synStore.client.removeDocumentTag(documentHash, BoardType.archived)
        await this.synStore.client.tagDocument(documentHash, BoardType.active)
    }

    async closeActiveBoard(leave: boolean) {
        const hash = get(this.activeBoardHash)
        if (hash) {
            if (leave) {
                const board = await this.getBoard(hash)
                if (board) await board.leave()
                else console.log("Board Not Found!")
            }
            this.setActiveBoard(undefined)
        }
    }

    async cloneBoard(board: BoardState) : Promise<Board>  {
        const newBoard = cloneDeep(board) as BoardState
        newBoard.name = `copy of ${newBoard.name}`
        return this.makeBoard(newBoard)
    }

    async makeBoard(options: BoardState) : Promise<Board> {
        if (!options.name) {
            options.name = "untitled"
        }

        // let univer;

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
                SheetsThreadCommentEnUS,
            ),
            },
        });
        
        // univer
        // const univer = new Univer({
        //     theme: defaultTheme,
        //     locale: LocaleType.ZH_CN,
        //     locales: {
        //         [LocaleType.ZH_CN]: zhCN,
        //         [LocaleType.EN_US]: enUS,
        //         [LocaleType.RU_RU]: ruRU,
        //     },
        // });

        // core plugins
        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);
        // univer.registerPlugin(UniverDebuggerPlugin);
        // univer.registerPlugin(UniverUIPlugin, {
        //     container: 'app',
        //     footer: false,
        // });
        // univer.registerPlugin(UniverDocsPlugin);
        // univer.registerPlugin(UniverDocsUIPlugin, {
        //     container: 'univerdoc',
        //     layout: {
        //         docContainerConfig: {
        //             innerLeft: false,
        //         },
        //     },
        // });

        // core plugins
        univer.registerPlugin(UniverUIPlugin, {
            container: "spreadsheet",
            header: true,
            toolbar: true,
            footer: true,
        });
    
        // doc plugins
        univer.registerPlugin(UniverDocsPlugin, {
            hasScroll: false,
        });
    
        // sheet plugins
        univer.registerPlugin(UniverSheetsPlugin);
        univer.registerPlugin(UniverSheetsUIPlugin);
        univer.registerPlugin(UniverSheetsFormulaPlugin);
        univer.registerPlugin(UniverSlidesPlugin);
        univer.registerPlugin(UniverSlidesUIPlugin);
        
        if (options.type == "spreadsheet") {
            const newSheet = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {});
            options.spreadsheet = newSheet.save()
        } else if (options.type == "document") {
            let newDoc = univer.createUnit(UniverInstanceType.UNIVER_DOC, {});
            if (!options.spreadsheet) {
                options.spreadsheet = newDoc.snapshot
            }
        } else {
            let newPres = univer.createUnit(UniverInstanceType.UNIVER_SLIDE, {});
            if (!options.spreadsheet) {
                options.spreadsheet = newPres
            }
        }
        const board = await Board.Create(this.synStore, options)
        // this.activeBoard.update((n) => {return board} )
        return board
    }
}
