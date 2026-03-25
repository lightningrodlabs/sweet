import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { type AgentPubKey, type EntryHash, type EntryHashB64, encodeHashToBase64, HoloHashMap, LazyHoloHashMap } from "@holochain/client";
import {toPromise, type AsyncReadable, pipe, joinAsync, asyncDerived, sliceAndJoin, alwaysSubscribed} from '@holochain-open-dev/stores'
import { SynStore, WorkspaceStore } from "@holochain-syn/core";
import type { ProfilesStore } from "@holochain-open-dev/profiles";
import { cloneDeep } from "lodash";
import { Board, type BoardDelta, type BoardState } from "./board";
import { hashEqual, convertPureStringToUDM } from "./util";


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
    activeWorkspaceHash: Writable<EntryHash| undefined> = writable(undefined)
    activeWorkspaceHashB64: Readable<string| undefined> = derived(this.activeWorkspaceHash, s=> s ? encodeHashToBase64(s): undefined)
    boardCount: AsyncReadable<number>

    boardData2 = new LazyHoloHashMap( documentHash => {
        const docStore = this.synStore.documents.get(documentHash)
        const board = pipe(docStore.allWorkspaces,
            workspaces => 
                // new Board(docStore,  new WorkspaceStore(docStore, (get(this.activeWorkspaceHash) || Array.from(workspaces.keys())[0])))
            new Board(docStore, new WorkspaceStore(docStore, Array.from(workspaces.keys())[0]))
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

    constructor(public profilseStore: ProfilesStore, public synStore: SynStore) {
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

    async setActiveBoard(hash: EntryHash | undefined, workspaceHash?: EntryHash | undefined) : Promise<Board | undefined> {
        let board: Board | undefined = undefined
        const current = get(this.activeBoard)
        const currentWorkspaceHash = get(this.activeWorkspaceHash)
        // if no change then don't update
        if (!current && !hash) return
        if (current && hash && hashEqual(hash, current.hash) && hashEqual(workspaceHash, currentWorkspaceHash)) return

        if (hash) {
            let board: Board | undefined = undefined
            if (workspaceHash) {
                const documentStore = this.synStore.documents.get(hash)
                const workspaceStore = new WorkspaceStore(documentStore, workspaceHash)
                board = await new Board(this.synStore.documents.get(hash), workspaceStore)
                console.log("WORKSPACE", board)
            } else {
                board = (await toPromise(this.boardData2.get(hash))).board
                console.log("NO WORKSPACE", board)
            }
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
        this.activeWorkspaceHash.update((n) => {return workspaceHash} )

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
            options.name = "Untitled"
        }

        const univerRES = createUniver({
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

        if (options.type == "spreadsheet") {
            const newSheet = univerRES.univerAPI.createWorkbook({}) //.createUnit(UniverInstanceType.UNIVER_SHEET, {});
            console.log("NEW SHEET", newSheet.save())
            options.spreadsheet = newSheet.save()
        }
        const board = await Board.Create(this.synStore, options)
        // this.activeBoard.update((n) => {return board} )
        return board
    }
}
