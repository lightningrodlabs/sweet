<script lang="ts">
    import { getContext } from "svelte";
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import SvgIcon from "./SvgIcon.svelte";
    import type { CalcyStore } from "./store";
    import {asyncDerived, toPromise} from '@holochain-open-dev/stores'
    import { BoardType } from "./boardList";
    import type { Board, BoardEphemeralState, BoardState } from "./board";
    import { deserializeExport, exportBoards } from "./export";
    import { DocumentStore, WorkspaceStore } from "@holochain-syn/core";
    import { encodeHashToBase64 } from "@holochain/client";


    const { getStore } :any = getContext('store');

    const store:CalcyStore = getStore();


    let dialog
    export const open = ()=>{dialog.show()}

    let fileinput;
	const onFileSelected = (e)=>{
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.addEventListener("load", async () => {
            const importedBoardStates = deserializeExport(reader.result as string)
            if ( importedBoardStates.length > 0) {
                const boards:Array<Board> = []
                for (const b of importedBoardStates) {
                    boards.push(await store.boardList.makeBoard(b))
                }
                if (importedBoardStates.length == 1) {
                    store.setUIprops({showMenu:false})
                    store.setActiveBoard(boards[0].hash)
                }
            }
            importing = false
        }, false);
        importing = true
        reader.readAsText(file);
    };
    const createBoardFrom = async (oldBoard: BoardState) => {
        const board = await store.boardList.cloneBoard(oldBoard)
        store.setUIprops({showMenu:false})
        store.setActiveBoard(board.hash)
    }
    const exportAllBoards = async () => {
        const boardStates = []
        exporting = true

        const hashes = await toPromise(asyncDerived(store.synStore.documentsByTag.get(BoardType.active),x=>Array.from(x.keys())))
        const docs = hashes.map(hash=>new DocumentStore<BoardState, BoardEphemeralState>(store.synStore, hash))
        for (const docStore of docs) {
            try {
                const workspaces = await toPromise(docStore.allWorkspaces)
                const workspaceStore = new WorkspaceStore(docStore, Array.from(workspaces.keys())[0])
                boardStates.push(await toPromise(workspaceStore.latestSnapshot))
            } catch(e) {
                console.log("Error getting snapshot for ", encodeHashToBase64(docStore.documentHash), e)
            }
        }
        exportBoards(boardStates)
        exporting = false
    }
    let importing = false
    let exporting = false

    $: allBoards = store.boardList.allBoards

</script>


<sl-dialog label="Calcy!: UI v0.3.0 for DNA v0.3.0" bind:this={dialog} width={600} >
    <div class="about">
        <p>Xylem! is a demonstration Holochain app built by Lightning Rod Labs.</p>
        <p> <b>Developers:</b>
            Check out this hApp's source-code <a href="https://github.com/lightningrodlabs/calcy">in our github repo</a>.
            This project's real-time syncronization is powered by <a href="https://github.com/holochain/syn">Syn</a>, 
            a library that makes it really easy to build this kind of real-time collaboaration into Holochain apps.
        </p>
    <p class="small">Copyright © 2023,2024 Holochain Foundation &amp; Lightning Rod Labs.  This software is distributed under the MIT License</p>
    {#if importing}
        <div class="export-import" title="Import Boards">
            <div class="spinning" style="margin:auto"><SvgIcon icon=faSpinner color="#fff"></SvgIcon></div>
        </div>
    {:else}
        <div class="export-import" on:click={()=>{fileinput.click();}} title="Import Boards">
            <SvgIcon color="#fff" icon=faFileImport size=20px style="margin-left: 15px;"/><span>Import Boards </span>
        </div>
    {/if}
    {#if exporting}
        <div class="export-import" title="Import Boards">
            <div class="spinning" style="margin:auto"><SvgIcon icon=faSpinner  color="#fff"></SvgIcon></div>
        </div>
    {:else}
        <div class="export-import" on:click={()=>{exportAllBoards()}} title="Export All Boards"><SvgIcon color="#fff" icon=faFileExport size=20px style="margin-left: 15px;"/><span>Export All Boards</span></div>
    {/if}


    {#if $allBoards.status == "pending"}
        <div class="spinning" ><SvgIcon icon=faSpinner  color="#fff"></SvgIcon></div>
    {:else if $allBoards.status == "complete"}
        <sl-dropdown skidding=15>
            <sl-button slot="trigger" caret><SvgIcon icon=faClone size=20px style="margin-right: 10px"/><span>New Spreadsheet From </span></sl-button>
            <sl-menu>
                {#each Array.from($allBoards.value.entries()) as [key,board]}
                    <sl-menu-item on:click={()=>{
                        createBoardFrom(board.latestState)
                    }} >
                        {board.latestState.name}
                    </sl-menu-item>
                {/each}
            </sl-menu>
        </sl-dropdown>
    {:else if $allBoards.status == "error"}
        Error: {$allBoards.error}
    {/if}

    <input style="display:none" type="file" accept=".json" on:change={(e)=>onFileSelected(e)} bind:this={fileinput} >
    </div>
</sl-dialog>

<style>
    .about {
        background-color: white;
    }
    .about p {

        margin-bottom:10px;
     }
     .small {
        font-size: 80%;
     }
     .export-import {
        box-sizing: border-box;
        position: relative;
        width: 100%;
        height: 50px;
        background: #243076;
        border: 1px solid #4A559D;
        margin-top: 5px;
        color: #fff;
        display: flex;
        align-items: center;
        border-radius: 5px;
        cursor: pointer;
    }

    .export-import span {
        color: #fff;
        display: block;
        padding: 0 15px;
    }
</style>
  