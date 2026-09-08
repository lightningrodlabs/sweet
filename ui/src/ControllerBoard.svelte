<script lang="ts">
    import CalcySpreadsheetPane from './CalcySpreadsheetPane.svelte';
    import { CalcyStore } from './store'
    import { setContext } from 'svelte';
    import type { AppClient, EntryHash } from '@holochain/client';
    import type { SynStore } from '@holochain-syn/core';
    import type { ProfilesStore } from "@holochain-open-dev/profiles";
    import type { WeaveClient } from "@theweave/api";;
    import { onMount } from 'svelte';

    export let roleName = ""
    export let client : AppClient
    export let weClient : WeaveClient
    export let profilesStore : ProfilesStore
    export let board : EntryHash
    let resetVar = true;

    let store: CalcyStore = new CalcyStore (
      weClient,
      profilesStore,
      client,
      roleName,
    );
    let synStore: SynStore = store.synStore
    store.boardList.setActiveBoard(board)
    $: activeBoardHash = store.boardList.activeBoardHash
    $: boardData = $activeBoardHash ? store.boardList.boardData2.get($activeBoardHash) : null
    $: activeBoard = store.boardList.activeBoard
    $: participants = $activeBoard ? $activeBoard.sessionParticipants() : undefined
    $: profiles = $participants ? profilesStore.allProfiles : undefined
    $: profile = profilesStore.profiles.get(client.myPubKey)

    setContext('synStore', {
      getStore: () => synStore,
    });

    setContext('store', {
      getStore: () => store,
    });

    function resetPane() {
      resetVar = false
      setTimeout(() => {
        resetVar = true
      }, 10)
    }

    const DEFAULT_KD_BG_IMG = "none"
    //const DEFAULT_KD_BG_IMG = "https://img.freepik.com/free-photo/studio-background-concept-abstract-empty-light-gradient-purple-studio-room-background-product-plain-studio-background_1258-54461.jpg"
    const NO_BOARD_IMG = "none"

    let show = false;
    onMount(() => {
      // set timeout
      setTimeout(() => {
        show = true;
        store.boardList.setActiveBoard(board)
        resetPane()
      }, 100);
    })

    $: bgUrl = DEFAULT_KD_BG_IMG  // FIXME$activeBoard ?   ($activeBoard.state.props && $boardState.props.bgUrl) ? $boardState.props.bgUrl : DEFAULT_KD_BG_IMG
  </script>
  <div class="flex-scrollable-parent">
    <div class="flex-scrollable-container">
      <div class='app'>

      <div class="wrapper">

      <div class="workspace" style="display:flex; flex:1 1 auto; min-height:0">        
        {#if show && $participants?.status == "complete"}
          {#if $profile?.status == "complete"}
            {#if $profiles?.status == "complete"}
              {#if $activeBoardHash !== undefined && profiles}
                {#if resetVar && $boardData.status == "complete"}
                  {#if $boardData.value.latestState.type === "spreadsheet"}
                    <CalcySpreadsheetPane on:reset={() => resetPane()} activeBoard={$activeBoard} tabView={true}/>
                    <!-- <SpreadsheetPane activeBoard={$activeBoard} participants={$participants.value} profiles={profiles.value} myProfile={$profile.value} tabView={true}/> -->
                  {:else if $boardData.value.latestState.type === "document"}
                    <!-- <CalcyPane on:reset={() => resetPane()} activeBoard={$activeBoard} myProfile={$profile.value} participants={$participants.value} profiles={profiles.value} tabView={true}/> -->
                      <DocumentPane activeBoard={$activeBoard} participants={$participants.value} profiles={profiles.value} myProfile={$profile.value} tabView={true}/>
                    {/if}                
                {/if}
              {/if}
            {/if}
          {/if}
        {/if}

        <!-- {#if $activeBoardHash !== undefined}
          <CalcyPane activeBoard={$activeBoard} standAlone={true}/>
        {:else}
          Unable to find board.
        {/if} -->
        </div>
        </div>
    </div>
  </div>
</div>
<style>
  .app {
    margin: 0;
    background-size: cover;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background-color: #fff;
    /* was padding-bottom: 10px -- with the global `* { box-sizing: border-box }`
       that came out of the content box, leaving a 10px dead strip under the
       sheet footer in every view. */
    /* 100% of .flex-scrollable-container (inset: 0), not of the viewport.
       100vh overflowed its own box by however much the container fell short,
       which is the couple of stray pixels of scrollbar in the main view. */
    height: 100%;
    position: relative;
  }

  :global(:root) {
    --resizeable-height: 200px;
    --tab-width: 60px;
  }

  @media (min-width: 640px) {
    .app {
      max-width: none;
    }
  }
  @-webkit-keyframes spin {
    0% { -webkit-transform: rotate(0deg); }
    100% { -webkit-transform: rotate(360deg); }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .flex-scrollable-parent {
    position: relative;
    display: flex;
    flex: 1;
  }
  .flex-scrollable-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .wrapper {
    position: relative;
    z-index: 10;
    /* .wrapper sits between .app and .workspace and was a plain block with no
       height and no flex, so the flex chain died here: .workspace could not
       fill, .board had no height to take, and the Univer container collapsed to
       nothing -- leaving only its content-sized footer in the embed view. */
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

</style>
