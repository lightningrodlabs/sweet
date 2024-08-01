import type { DocumentStore, SessionStore, WorkspaceStore, SynStore } from "@holochain-syn/core";
import { get, type Readable } from "svelte/store";
import { v1 as uuidv1 } from "uuid";
import { type AgentPubKey, type EntryHash, type EntryHashB64, encodeHashToBase64, type AgentPubKeyB64, type Timestamp } from "@holochain/client";
import { BoardType } from "./boardList";
import type { IWorkbookData } from '@univerjs/core';
import type { WALUrl } from "./util";

export type BoardProps = {
  bgUrl: string,
  attachments: Array<WALUrl>
}

export type BoardEphemeralState = { [key: string]: string };

export interface BoardState {
  name: string;
  type: string;
  props: BoardProps;
  spreadsheet: IWorkbookData;
  document: IWorkbookData;
  boundTo: Array<WALUrl>;
  commands: Array<any>;
  lastAppliedCommand: any;
  commentCommands: Array<any>;
  users: Array<any>;
}
  
  export type BoardDelta =
    | {
        type: "set-name";
        name: string;
      }
    | {
        type: "set-spreadsheet";
        spreadsheet: IWorkbookData;
    }
    | {
        type: "set-state";
        state: BoardState;
      }
    | {
        type: "set-props";
        props: BoardProps;
      }
    | {
      type: "execute-command";
      command: any;
    }
    | {
      type: "execute-command-batch";
      commands: Array<any>;
      documentValue: IWorkbookData;
    }
    | {
      type: "add-user";
      user: any;
    }
    | {
      type: "add-comment";
      comment: any;
    };


  export const boardGrammar = {
    initialState(init: Partial<BoardState>|undefined = undefined)  {
      const state: BoardState = {
        name: "untitled",
        type: init?.type || "document",
        props: {bgUrl:"", attachments:[]},
        boundTo: [],
        spreadsheet: null,
        document: null,
        commands: [],
        lastAppliedCommand: null,
        commentCommands: [],
        users: []
      }
      if (init) {
        Object.assign(state, init);
      }
      return state
    },
    applyDelta( 
      delta: BoardDelta,
      state: BoardState,
      _ephemeralState: any,
      _author: AgentPubKey
    ) {
      switch (delta.type) {
        case "set-state":
          if (delta.state.name !== undefined) state.name = delta.state.name
          if (delta.state.type !== undefined) state.type = delta.state.type
          if (delta.state.spreadsheet !== undefined) state.spreadsheet = delta.state.spreadsheet
          if (delta.state.props !== undefined) state.props = delta.state.props
          if (delta.state.boundTo !== undefined) state.boundTo = delta.state.boundTo
          if (delta.state.commands !== undefined) state.commands = delta.state.commands
          if (delta.state.lastAppliedCommand !== undefined) state.lastAppliedCommand = delta.state.lastAppliedCommand
          if (delta.state.users !== undefined) state.users = delta.state.users
          if (delta.state.commentCommands !== undefined) state.commentCommands = delta.state.commentCommands
          break;
        case "set-spreadsheet":
          state.spreadsheet = delta.spreadsheet
          break;
        case "set-name":
          state.name = delta.name
          break;
        case "set-props":
          state.props = delta.props
          break;
        case "execute-command":
          state.commands.push(delta.command)
          if (state.commands.length > 30) {
            const itemsToRemove = state.commands.length - 30;
            state.commands.splice(0, itemsToRemove);
          }
          break;
        case "execute-command-batch":
          state.commands.push(...delta.commands)
          state.spreadsheet = delta.documentValue
          if (state.commands.length > 40) {
            const itemsToRemove = state.commands.length - 40;
            state.commands.splice(0, itemsToRemove);
          }
          break;
        case "add-user":
          console.log("ADDING USER", delta.user)
          console.log("was", state.users)
          state.users.push(delta.user)
          break;
        case "add-comment":
          if (!state.commentCommands) {state.commentCommands = []}
          state.commentCommands.push(delta.comment)
          break;
      }
    },
  };
  
export type BoardStateData = {
  hash: EntryHash,
  state: BoardState,
}
  
export class Board {
  public session: SessionStore<BoardState,BoardEphemeralState> | undefined
  public hashB64: EntryHashB64

  constructor(public document: DocumentStore<BoardState, BoardEphemeralState>, public workspace: WorkspaceStore<BoardState,BoardEphemeralState>) {
    this.hashB64 = encodeHashToBase64(this.document.documentHash)
  }

  public static async Create(synStore: SynStore, init: Partial<BoardState>|undefined = undefined) {
    const initState = boardGrammar.initialState(init)
  
    const documentStore = await synStore.createDocument(initState,{})

    await synStore.client.tagDocument(documentStore.documentHash, BoardType.active)

    if (init.type === "spreadsheet") {
      await synStore.client.tagDocument(documentStore.documentHash, BoardType.spreadsheet)
    } else if (init.type === "document") {
      await synStore.client.tagDocument(documentStore.documentHash, BoardType.document)
    }

    const workspaceStore = await documentStore.createWorkspace(
        `${new Date}`,
        undefined
       );

    const me = new Board(documentStore, workspaceStore);
    await me.join()

    if (initState !== undefined) {
      let changes : BoardDelta[] = [{
          type: "set-state",
          state: initState
          },
      ]
      if (changes.length > 0) {
          me.requestChanges(changes)
          await me.session.commitChanges()
      }
    }

    return me
  }

  get hash() : EntryHash {
    return this.document.documentHash
  }

  async join() {
    if (! this.session) 
      this.session = await this.workspace.joinSession()
    console.log("JOINED", this.session)
  }
  
  async leave() {
    if (this.session) {
      this.session.leaveSession()
      this.session = undefined
      console.log("LEFT SESSION")
    }
  }

  state(): BoardState | undefined {
      if (!this.session) {
        return undefined
      } else {
        return get(this.session.state)
      }
  }

  readableState(): Readable<BoardState> | undefined {
    if (!this.session) {
      return undefined
    } else {
      return this.session.state
    }
  }

  requestChanges(deltas: Array<BoardDelta>) {
      this.session.change((state,_eph)=>{
        for (const delta of deltas) {
          boardGrammar.applyDelta(delta, state,_eph, undefined)
        }
      })
  }

  sessionParticipants() {
    return this.workspace.sessionParticipants
  }

  participants()  {
    if (!this.session) {
      return undefined
    } else {
      return this.session._participants
    }
  }
  async commitChanges() {
      this.session.commitChanges()
  }

}
