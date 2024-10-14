import {
    type AppAgentClient,
    type EntryHash,
    type AgentPubKeyB64,
    type AppAgentCallZomeRequest,
    type RoleName,
    encodeHashToBase64,
    type EntryHashB64,
    type AgentPubKey,
    decodeHashFromBase64,
    type Timestamp,
    type DnaHash,
  } from '@holochain/client';
import { OTSynStore,  SynClient} from '@holochain-syn/core';
import { BoardList } from './boardList';
import TimeAgo from "javascript-time-ago"
import en from 'javascript-time-ago/locale/en'
import type { v1 as uuidv1 } from "uuid";
import { get, writable, type Unsubscriber, type Writable } from "svelte/store";
import type { ProfilesStore } from '@holochain-open-dev/profiles';
import type { BoardState } from './board';
import type { WeClient } from '@lightningrodlabs/we-applet';
import { HoloHashMap } from '@holochain-open-dev/utils';
import { getMyDna } from './util';


TimeAgo.addDefaultLocale(en)

const ZOME_NAME = 'syn'

export class CalcyService {
    constructor(public client: AppAgentClient, public roleName, public zomeName = ZOME_NAME) {}

    private callZome(fnName: string, payload: any) {
        const req: AppAgentCallZomeRequest = {
            role_name: this.roleName,
            zome_name: this.zomeName,
            fn_name: fnName,
            payload
          }
        return this.client.callZome(req);
    }
}

export enum SeenType {
    Tip="t",
}

export interface UIProps {
    showMenu: boolean,
    tips: HoloHashMap<EntryHash,EntryHash>,
    latestComment: {[key: string]: Timestamp}
  }

export class CalcyStore {
    myAgentPubKeyB64: AgentPubKeyB64
    timeAgo = new TimeAgo('en-US')
    service: CalcyService;
    boardList: BoardList;
    updating = false
    synStore: OTSynStore;
    client: AppAgentClient;
    uiProps: Writable<UIProps>
    unsub: Unsubscriber
    dnaHash: DnaHash

    constructor(
        public weClient : WeClient,
        public profilesStore: ProfilesStore,
        protected clientIn: AppAgentClient,
        protected roleName: RoleName,
        protected zomeName: string = ZOME_NAME
    ) {
        this.client = clientIn
        getMyDna(roleName, clientIn).then(res=>{
            this.dnaHash = res
          })

        this.myAgentPubKeyB64 = encodeHashToBase64(this.client.myPubKey);
        this.service = new CalcyService(
          this.client,
          this.roleName,
          this.zomeName
        );
        this.synStore = new OTSynStore(new SynClient(this.client,this.roleName,this.zomeName))
        this.boardList = new BoardList(profilesStore, this.synStore)
        this.boardList.activeBoard.subscribe((board)=>{
            if (this.unsub) {
                this.unsub()
                this.unsub = undefined
            }
            if (board != undefined) {
                this.unsub = board.workspace.tip.subscribe((tip)=>{
                    if (tip.status == "complete" && tip.value) {
                        this.updateSeenTip(board.hash, tip.value.entryHash)
                    }
                })
            }
        })
        this.uiProps = writable({
            showMenu: true,
            tips: new HoloHashMap,
            latestComment: {}
        })
        for (let i = 0; i < localStorage.length; i+=1){
            const key = localStorage.key(i)
            const [type, boardHashB64] = key.split(":")
            if (type == SeenType.Tip) {
                const tipB64 = localStorage.getItem(key)
                this.setSeenTip(decodeHashFromBase64(boardHashB64), decodeHashFromBase64(tipB64))
            } 
        }

    }

    updateSeenTip(boardHash: EntryHash, tip:EntryHash) {
        if (boardHash && tip) {
            localStorage.setItem(`${SeenType.Tip}:${encodeHashToBase64(boardHash)}`, encodeHashToBase64(tip))
            this.setSeenTip(boardHash, tip)
        }
    }

    setSeenTip(boardHash:EntryHash, tip: EntryHash) {
        this.uiProps.update((n) => {
            n.tips.set(boardHash,tip)
            return n
        })
    }

    setUIprops(props:{}) {
        this.uiProps.update((n) => {
            Object.keys(props).forEach(key=>n[key] = props[key])
            return n
        })
    }

    async setActiveBoard(hash: EntryHash | undefined) {
        const board = await this.boardList.setActiveBoard(hash)
        // let bgUrl = ""
        // if (board) {
        //     const state = board.state()
        //     if (state) {
        //         bgUrl = state.props.bgUrl
        //     }
        // }
        this.setUIprops({showMenu:false/*, bgUrl*/})
    }

    async closeActiveBoard(leave: boolean) {
        await this.boardList.closeActiveBoard(leave)
        this.setUIprops({showMenu:true, bgUrl:""})
    }


    async archiveBoard(documentHash: EntryHash) {
        const wasActive = this.boardList.archiveBoard(documentHash)
        if (wasActive ) {
            this.setUIprops({showMenu:true, bgUrl:""})
        }
    }

    get myAgentPubKey(): AgentPubKey {
        return this.client.myPubKey;
    }

}