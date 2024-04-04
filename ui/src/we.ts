import { DocumentStore, SynClient, SynStore, WorkspaceStore } from '@holochain-syn/core';
import type { BoardEphemeralState, BoardState } from './board';
import { asyncDerived, pipe, sliceAndJoin, toPromise } from '@holochain-open-dev/stores';
import { BoardType } from './boardList';
import { LazyHoloHashMap } from '@holochain-open-dev/utils';
import type { AppletHash, AppletServices, AssetInfo, WAL, WeServices } from '@lightningrodlabs/we-applet';
import { getMyDna } from './util';
import type { AppAgentClient, RoleName, ZomeName } from '@holochain/client';

const ROLE_NAME = "calcy"
const ZOME_NAME = "syn"

const SHEET_ICON_SRC = `data:image/svg+xml;utf8,
<svg fill="black" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 width="800px" height="800px" viewBox="0 0 482.81 482.81"
	 xml:space="preserve">
<g>
	<path d="M464.764,25.771H18.037C8.086,25.771,0,33.869,0,43.808v395.196c0,6.106,3.068,11.491,7.729,14.76v2.843h6.469
		c1.241,0.272,2.518,0.432,3.839,0.432h446.738c1.318,0,2.595-0.159,3.83-0.432h0.887v-0.271
		c7.654-2.093,13.317-9.032,13.317-17.331V43.813C482.81,33.869,474.717,25.771,464.764,25.771z M467.347,43.813v51.979H348.363
		v-54.56h116.4C466.194,41.233,467.347,42.392,467.347,43.813z M466.105,441.145H348.363V392.18h118.983v46.824
		C467.347,439.92,466.832,440.695,466.105,441.145z M15.457,439.004V392.18h55.842v48.965H16.698
		C15.971,440.695,15.457,439.92,15.457,439.004z M201.448,256.87v53.61H86.758v-53.61H201.448z M86.758,241.407v-57.99h114.689
		v57.99H86.758z M201.448,325.943v50.773H86.758v-50.773H201.448z M201.448,392.18v48.965H86.758V392.18H201.448z M216.913,392.18
		H332.9v48.965H216.913V392.18z M216.913,376.717v-50.779H332.9v50.779H216.913z M216.913,310.48v-53.61H332.9v53.61H216.913z
		 M216.913,241.407v-57.99H332.9v57.99H216.913z M216.913,167.954v-56.702H332.9v56.702H216.913z M216.913,95.787v-54.56H332.9
		v54.56H216.913z M201.448,95.787H86.758v-54.56h114.689V95.787z M201.448,111.252v56.702H86.758v-56.702H201.448z M71.299,167.954
		H15.457v-56.702h55.842V167.954z M71.299,183.417v57.99H15.457v-57.99H71.299z M71.299,256.87v53.61H15.457v-53.61H71.299z
		 M71.299,325.943v50.773H15.457v-50.773H71.299z M348.363,376.717v-50.779h118.983v50.779H348.363z M348.363,310.48v-53.61h118.983
		v53.61H348.363z M348.363,241.407v-57.99h118.983v57.99H348.363z M348.363,167.954v-56.702h118.983v56.702H348.363z"/>
</g>
</svg>`

export const appletServices: AppletServices = {
    // Types of attachment that this Applet offers for other Applets to be created
    creatables: {
      'spreadsheet': {
        label: "Spreadsheet",
        icon_src: SHEET_ICON_SRC,
      }
    },
    // Types of UI widgets/blocks that this Applet supports
    blockTypes: {
      'active_boards': {
        label: 'Active Boards',
        icon_src: 
        `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 0v64h64V96H64zm384 0H192v64H448V96zM64 224v64h64V224H64zm384 0H192v64H448V224zM64 352v64h64V352H64zm384 0H192v64H448V352z"/></svg>`,
        view: "applet-view",
      },      
    },
    bindAsset: async (appletClient: AppAgentClient,
      srcWal: WAL, dstWal: WAL): Promise<void> => {
      console.log("Bind requested.  Src:", srcWal, "  Dst:", dstWal)
    },
    getAssetInfo: async (
      appletClient: AppAgentClient,
      roleName: RoleName,
      integrityZomeName: ZomeName,
      entryType: string,
      wal: WAL
    ): Promise<AssetInfo | undefined> => {
      if (entryType == "document") {
        const synClient = new SynClient(appletClient, roleName, ZOME_NAME);
        const synStore = new SynStore(synClient);
        const documentHash = wal.hrl[1]
        const docStore = new DocumentStore<BoardState, BoardEphemeralState> (synStore, documentHash)
        const workspaces = await toPromise(docStore.allWorkspaces)
        const workspace = new WorkspaceStore(docStore, Array.from(workspaces.keys())[0])
        const latestState = await toPromise(workspace.latestState)


        return {
          icon_src: SHEET_ICON_SRC,
          name: latestState.name,
        };
      } else {
        throw new Error("unknown entry type:"+ entryType)
      }
    },
    search: async (
      appletClient: AppAgentClient,
      appletHash: AppletHash,
      weServices: WeServices,
      searchFilter: string
    ): Promise<Array<WAL>> => {
        const synClient = new SynClient(appletClient, ROLE_NAME, ZOME_NAME);
        const synStore = new SynStore(synClient);
        const boardHashes = asyncDerived(synStore.documentsByTag.get(BoardType.active),x=>Array.from(x.keys()))
            
        const boardData = new LazyHoloHashMap( documentHash => {
            const docStore = synStore.documents.get(documentHash)
    
            const workspace = pipe(docStore.allWorkspaces,
                workspaces => {
                    return new WorkspaceStore(docStore, Array.from(workspaces.keys())[0])
                }
            ) 
            const latestState = pipe(workspace, 
                w => w.latestState
                )
            return latestState
        })
    
        const allBoardsAsync = pipe(boardHashes,
            docHashes => sliceAndJoin(boardData, docHashes)
        )

        const allBoards = Array.from((await toPromise(allBoardsAsync)).entries())
        const dnaHash = await getMyDna(ROLE_NAME, appletClient)

        return allBoards
            .filter((r) => !!r)
            .filter((r) => {
                const state = r[1]
                return state.name.toLowerCase().includes(searchFilter.toLowerCase())
            })
            .map((r) => ({ hrl: [dnaHash, r![0]], context: undefined }));
    },
};
  