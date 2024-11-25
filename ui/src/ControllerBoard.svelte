<script lang="ts">
    import CalcyPane from './CalcyPane.svelte'
    import CalcySpreadsheetPane from './CalcySpreadsheetPane.svelte';
    import { CalcyStore } from './store'
    import { setContext } from 'svelte';
    import type { AppClient, EntryHash } from '@holochain/client';
    import type { OTSynStore } from '@leosprograms/syn-core';
    import type { ProfilesStore } from "@holochain-open-dev/profiles";
    import type { WeaveClient } from '@lightningrodlabs/we-applet';
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
    let synStore: OTSynStore = store.synStore
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

      <div class="workspace" style="display:flex">        
        {#if show && $participants?.status == "complete"}
          {#if $profile?.status == "complete"}
            {#if $profiles?.status == "complete"}
              {#if $activeBoardHash !== undefined && profiles}
                {#if resetVar && $boardData.status == "complete"}
                  {#if $boardData.value.latestState.type === "spreadsheet"}
                    <CalcySpreadsheetPane on:reset={() => resetPane()} activeBoard={$activeBoard} myProfile={$profile.value} participants={$participants.value} profiles={profiles.value} tabView={true}/>
                  {:else if $boardData.value.latestState.type === "document"}
                    <CalcyPane on:reset={() => resetPane()} activeBoard={$activeBoard} myProfile={$profile.value} participants={$participants.value} profiles={profiles.value} tabView={true}/>
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
    padding-bottom: 10px;
    background-size: cover;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background-color: #fff;
    height: 100vh;
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
  }

</style>
