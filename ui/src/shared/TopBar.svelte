<script lang="ts">
    import { get } from 'svelte/store';
    import {
      WeaveClient,
      isWeaveContext,
      initializeHotReload,
      type WAL,
    } from "@theweave/api";
    import Participants from "./Participants.svelte";
    import Avatar from "./Avatar.svelte";
    import SvgIcon from "./SvgIcon.svelte";
    import EditBoardDialog from "./EditBoardDialog.svelte";
    import AttachmentsDialog from "./AttachmentsDialog.svelte";
    import AttachmentsList from "./AttachmentsList.svelte";

    export let activeBoard;
    export let store;
    export let synState;
    export let standAlone = false;
    export let tabView = false;

    $: sessionStore = activeBoard?.session
    $: participants = get(sessionStore.participants).active;

    let attachmentsDialog;
    let editBoardDialog;

    // Functions
    const copyWalToPocket = () => {
        const attachment: WAL = {
          hrl: [store.dnaHash, activeBoard.hash],
          context: JSON.stringify({docType: 'document'}),
        };
        console.log("attachment", attachment)
        store.weClient?.assets.assetToPocket(attachment);
    }

    const closeBoard = async () => {
        console.log("closeBoard", activeBoard.hash)
        await store.closeActiveBoard(false);
    };

    const leaveBoard = async () => {
        await store.closeActiveBoard(true);
    };
</script>

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
            value={$synState?.name}
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
          {#if store?.weClient}
            <AttachmentsDialog activeBoard={activeBoard} bind:this={attachmentsDialog}></AttachmentsDialog>
            {#if $synState?.boundTo?.length > 0}
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
              {#if $synState?.props?.attachments}
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
                console.log(univerAPI.getActiveDocument().getBody().dataStream)
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

            <!-- <div style="margin: 7px; display: flex; flex-direction: row;" title="In order to work together, you must be synced with collaborators">
            {$clerkStatus == "found" ? "Synced" : "Syncing..."}
            </div> -->
            <div style="display:flex; justify-content:flex-end">
            <!-- {JSON.stringify($clerk)} -->
            <!-- <Participants board={activeBoard} highlightedAgent={$clerk} max={10}></Participants> -->
            <Participants board={activeBoard} max={10}></Participants>
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

<style>

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