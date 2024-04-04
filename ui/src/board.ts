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
  props: BoardProps;
  spreadsheet: IWorkbookData;
  boundTo: Array<WALUrl>
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
      };


  export const boardGrammar = {
    initialState(init: Partial<BoardState>|undefined = undefined)  {
      const state: BoardState = {
        name: "untitled",
        props: {bgUrl:"", attachments:[]},
        boundTo: [],
        spreadsheet: null
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
          if (delta.state.spreadsheet !== undefined) state.spreadsheet = delta.state.spreadsheet
          if (delta.state.props !== undefined) state.props = delta.state.props
          if (delta.state.boundTo !== undefined) state.boundTo = delta.state.boundTo
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
