<script lang="ts">
    import { getContext } from "svelte";
    import type { CalcyStore } from "./store";
    import type {  EntryHash } from '@holochain/client';
    import GroupParticipants from './GroupParticipants.svelte';
    import NewBoardDialog from './NewBoardDialog.svelte';
    import SvgIcon from "./SvgIcon.svelte";
    import AboutDialog from "./AboutDialog.svelte";
    import LogoIcon from "./icons/LogoIcon.svelte";
    import BoardMenuItem from "./BoardMenuItem.svelte";
    import { BoardType } from "./boardList";
    export let wide = false

    let newBoardDialog
    let newBoardDropdown = false

    const { getStore } :any = getContext('store');

    const store:CalcyStore = getStore();

    $: activeBoards = store.boardList.activeBoardHashes
    $: archivedBoards = store.boardList.archivedBoardHashes

    $: uiProps = store.uiProps

    const bgUrl = "none"

    const addSpreadsheet = async () => {
        // @ts-ignore
        const board = await store.boardList.makeBoard({"name": "Untitled", "type": "spreadsheet"})
        store.setUIprops({showMenu:false})
        await store.boardList.setActiveBoard(board.hash)
    }

    const addDocument = async () => {
        // @ts-ignore
        const board = await store.boardList.makeBoard({"name": "Untitled", "type": "document"})
        store.setUIprops({showMenu:false})
        await store.boardList.setActiveBoard(board.hash)
    }

    const addPresentation = async () => {
        // @ts-ignore
        const board = await store.boardList.makeBoard({"name": "Untitled", "type": "presentation"})
        store.setUIprops({showMenu:false})
        await store.boardList.setActiveBoard(board.hash)
    }

    const selectBoard = async (hash: EntryHash) => {
        store.setUIprops({showMenu:false})
        store.setActiveBoard(hash)
    }

    const unarchiveBoard = async (hash: EntryHash) => {
        store.boardList.unarchiveBoard(hash)
        selectBoard(hash)
    }

    let aboutDialog

</script>

<AboutDialog bind:this={aboutDialog} />
<div class="board-menu"
    class:wide={wide} >
        <!-- <h3 class="type-header">Boards</h3> -->
        <!-- dropdown new with multiple options -->
        <div style="position: absolute; z-index: 1;" on:mouseenter={()=>newBoardDropdown = true} on:mouseleave={()=>newBoardDropdown = false}>
        <div class="new-board dropdown-button"  title="New"><SvgIcon color="white" size=25px icon=faSquarePlus style="margin-left: 15px;"/><span>New</span></div>
        {#if newBoardDropdown}
            <div class="new-board" on:click={()=>addSpreadsheet()} title="Spreadsheet"><SvgIcon color="white" size=25px icon=spreadsheet style="margin-left: 15px;"/><span>Spreadsheet</span></div>
            <div class="new-board" on:click={()=>addDocument()} title="Board"><SvgIcon color="white" size=25px icon=textDocument style="margin-left: 15px;"/><span>Document</span></div>
            <div class="new-board" on:click={()=>addPresentation()} title="Presentation"><SvgIcon color="white" size=25px icon=presentation style="margin-left: 15px;"/><span>Presentation</span></div>
            <!-- upload/import -->
            <div class="new-board" on:click={()=>addDocument()} title="Upload"><SvgIcon color="white" size=25px icon=faFileImport style="margin-left: 15px;"/><span>Import file</span></div>
        {/if}
        </div>

        <div style="margin-top: 60px;"></div>
        <!-- <GroupParticipants/> -->

        <!-- <div class="new-board" on:click={()=>newBoardDialog.open()} title="New Spreadsheet"><SvgIcon color="white" size=25px icon=faSquarePlus style="margin-left: 15px;"/><span>New Spreadsheet</span></div> -->
        <div class="boards-section">
            {#if $activeBoards.status == "complete" && $activeBoards.value.length > 0}
                {#each $activeBoards.value as hash}
                    <div
                        on:click={()=>selectBoard(hash)}
                        class="board" >
                        <BoardMenuItem boardType={BoardType.active} boardHash={hash}></BoardMenuItem>
                        <div class="board-bg" style="background-image: url({bgUrl});"></div>
                    </div>
                {/each}
            {/if}
        </div>
    <!-- {#if $uiProps.recent.length > 0 || activeBoards}
        <h3 class="type-header">Active Boards</h3>
        <div class="boards-section">
            {#if $uiProps.recent.length > 0}
                {#each $uiProps.recent as boardHash }
                    <div class="board"
                        on:click={()=>{
                            selectBoard(decodeHashFromBase64(boardHash))
                        }}>
                            <BoardMenuItem boardType={BoardType.active} boardHash={hash}></BoardMenuItem>
                            <div class="board-bg" style="background-image: url({bgUrl});"></div>
                    </div>
                {/each}
            {/if}
            {#if activeBoards}
                {#each $boardList.boards as board }
                    {#if board.status !== "archived" && !$uiProps.recent.includes(board.hash)}
                        <div
                            on:click={()=>selectBoard(board.hash)}
                            class="board" id={board.hash}>
                            <BoardMenuItem boardType={BoardType.active} boardHash={hash}></BoardMenuItem>
                            <div class="board-bg" style="background-image: url({bgUrl});"></div>
                        </div>
                    {/if}
                {/each}
            {/if}
        </div>
    {/if} -->
    {#if $archivedBoards.status == "complete" && $archivedBoards.value.length > 0}
        <h3 class="type-header">Archived Boards</h3>
        <div class="boards-section">
            {#each $archivedBoards.value as hash}
                <div
                    on:click={()=>unarchiveBoard(hash)}
                    class="board" >
                    <BoardMenuItem boardType={BoardType.archived} boardHash={hash}></BoardMenuItem>
                    <div class="board-bg" style="background-image: url({bgUrl});"></div>
                </div>
            {/each}
        </div>
    {/if}

    <NewBoardDialog bind:this={newBoardDialog}></NewBoardDialog>
    <div class="footer" 
        class:slideOut={$uiProps.showMenu == false}
        on:click={()=>aboutDialog.open()}>   
        <div class="logo" title="About Calcy!"><LogoIcon /></div>
        <div class="cog"><SvgIcon icon=faCog size="20px" color="#fff"/></div>
    </div>
</div>

<style>
    .wide {
        width: 100%;
    }
    .boards-section {
        display: flex;
        flex-wrap: wrap;
    }

    .board-menu {
        height: calc(100vh - 50px);
        overflow-y: auto;
        overflow-x: hidden;
        min-width: 330px;
        width: 330px;
        max-width: 0;
        display: flex;
        flex-direction: column;
        /* background: linear-gradient(94.53deg, #164B9A 12.76%, #5B47D6 99.41%); */
        /* background: linear-gradient(94.53deg, #2b2e31 12.76%, #545454 99.41%); */
        /* background: linear-gradient(94.53deg, #81878e 12.76%, #c2c2c2 99.41%); */
        background-color: rgb(239, 239, 239);
        flex: 0 0 auto;
        align-items: flex-start;
        position: relative;
        padding: 15px;
        padding-bottom: 50px;
    }

    .wide.board-menu {
        width: 100vw;
        height: calc(100vh - 50px);
    }


    .board-menu::-webkit-scrollbar {
        width: 10px;
        background-color: transparent;
    }

    .board-menu::-webkit-scrollbar-thumb {
        height: 5px;
        border-radius: 0;
        background: rgba(20,60,119,.9);
        opacity: 1;
    }

    .wide {
        width: 100vw;
        max-width: 100vw;
    }

    .type-header {
        font-size: 12px;
        font-weight: normal;
        color: #fff;
        opacity: .6;
        margin-top: 20px;
        margin-bottom: 10px;
        margin-left: 5px;
    }

    .board-name {
        font-size: 16px;
        font-weight: bold;
    }

    .new-board {
        box-sizing: border-box;
        position: relative;
        width: 168px;
        height: 50px;
        /* background: rgba(24, 55, 122, 1.0); */
        background: #7400eae6;
        border: 1px solid #4A559D;
        color: #fff;
        display: flex;
        align-items: center;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        transition: all .25s ease;
        left: 5px;
        padding: 15px 0;
        box-shadow: 0px 4px 8px rgba(35, 32, 74, 0);
    }

    .new-board:hover {
        cursor: pointer;
        padding: 15px 5px;
        width: 178px;
        border: 1px solid #252d5d;
        /* background: rgb(10, 25, 57); */
        background: #8e31ebe6;
        margin: 0 -5px 0 -5px;
        box-shadow: 0px 4px 15px rgba(35, 32, 74, 0.8);
    }

    .new-board.dropdown-button {
        cursor: default;
        width: 168px;
        padding: 15px 0;
        margin: 0;
        border: 1px solid #4A559D;
        box-shadow: none;
    }

    .new-board span {
        color: #fff;
        display: block;
        padding: 0 15px;
    }

    .board {
        width: 290px;
        border-radius: 5px;
        padding: 10px;
        margin: 7px;
        transition: all .15s ease;
        /* border: 1px solid; */
        background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgb(200 221 237) 100%);
        position: relative;
        display: block;
        box-shadow: 0px 4px 8px rgba(167, 165, 189, 0.8);
    }

    .board:hover {
        cursor: pointer;
        z-index: 100;
        padding: 15px;
        width: 300px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%);
        margin: 0 -10px 0 -5px;
        box-shadow: 0px 4px 14px rgba(167, 165, 189, 0.8);
        z-index: 100;
    }

    .wide .board:hover {
        margin: 0 4px 0 0;
    }

    .footer {
        position: fixed;
        padding: 10px;
        border-radius: 0;
        bottom: 0px;
        height: 40px;
        display: block;
        align-items: center;
        width: 330px;
        left: 0;
        background-color: #5c00eae6;
        animation-duration: .3s;
        animation-name: slideIn;
        animation-iteration-count: 1;
        animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1.1);
        z-index: 1000;
        --margin-end-position: 0px;
        --margin-start-position: -330px;
        margin-left: 0;
    }

    .footer.slideOut {
      animation-duration: .3s;
      animation-name: slideIn;
      --margin-end-position: -330px;
      animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1.1);
      --margin-start-position: 0px;
      margin-left: -330px;
    }

    @keyframes slideIn {
        from {
            margin-left: var(--margin-start-position);
            backdrop-filter: blur(10px);
        }

        to {
            margin-left: var(--margin-end-position);
            backdrop-filter: blur(0px);
        }
    }
    
    .wide .footer {
        width: 100%;
        bottom: 0;
    }

    .footer div {
        display: inline-block;
    }

    .footer:hover {
        cursor: pointer;
    }

    .logo {
        height: 16px;
        margin-right: 5px;
    }

    .board-bg {
        position: absolute;
        z-index: 0;
        height: 100%;
        width: 100%;
        background-size: cover;
    }
</style>