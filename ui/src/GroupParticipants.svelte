<script lang="ts">
    import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import { getContext } from "svelte";
    import type { CalcyStore } from "./store";
    import Avatar from './shared/Avatar.svelte';
    import "@holochain-open-dev/stores/dist/debug-store.js"
    import type { AgentPubKey } from "@holochain/client";
  
    const { getStore } :any = getContext('store');
    const store:CalcyStore = getStore();
  
    //$: agents = store.profilesStore.agentsWithProfile
    $: agents = store.boardList.allAuthorAgents
    $: agentBoards = store.boardList.allAgentBoards
    $: agentBoardHashes = store.boardList.agentBoardHashes
    
    //__debugStore(store.boardList.allAgentBoards)
    //.status=="complete" ? sliceAndJoin( store.boardList.boardParticipants, $agents.value): undefined
  
    export const close=()=>{dialog.hide()}
    export const open=()=>{
      dialog.show()
      }
    let dialog
  </script>
    <div class="participants">
        <div class="list">
            {#if $agents.status == "pending"}
              agents: <sl-skeleton effect="pulse" style="height: 40px; width: 100%" ></sl-skeleton>
            {:else if $agents.status == "error"}
              <div>Error loading participants: {$agents.error}</div>
            {:else if $agents.status == "complete"}
              <h4>Participants</h4>


              {#if $agentBoards.status == "pending"}
                agentBoard: <sl-skeleton effect="pulse" style="height: 40px; width: 100%" ></sl-skeleton>
              {:else if $agentBoards.status == "error"}
                <div>Error loading agent boards</div>
              {:else if $agentBoards.status=="complete"}
                <div class="participant-list">
                  {#each $agents.value as agentPubKey}
                    {@const agentBoards = $agentBoards.value.get(agentPubKey)}
                    <div class="list-item">
                        <Avatar agentPubKey={agentPubKey} size={24} namePosition="row" />
                        <div style="margin-left:10px; font-size:120%">
                              <div class="boards">
                                <span style="font-size: 12px; opacity: .7;">Contributor to</span>
                                {#if agentBoards && agentBoards.length> 0}
                                  {#each agentBoards as board}
                                      <div class="board" on:click={()=>{
                                          store.setActiveBoard(board.board.hash)
                                          close()
                                      }}>{board.latestState.name}</div>
                                  {/each}
                                {/if}
                              </div>
                        </div>
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
        </div>
    </div>
  
  <style>
    .participants {
        position: relative;
    }

    .participants:hover {
        z-index: 100;
    }
        
      .boards {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
      }
      .board {
          border-radius: 5px;
          border: 2px solid rgba(49, 74, 177, .25);
          font-size: 90%;
          font-weight: bold;
          padding: 2px 5px;
          justify-content: center;
          display: flex;
          cursor: pointer;
          margin-right: 5px;
          font-size: 12px;
          margin-bottom: 5px;
      }

      h4 {
        color: #fff;
        font-size: 12px;
        font-weight: normal;
        opacity: .6;
        margin-top: 20px;
        margin-bottom: 10px;
        margin-left: 5px;
      }

      .participants {
      }

      .board:hover {
          box-shadow: 0px 10px 35px rgb(130 107 58 / 25%);
          transform: scale(1.1);
      }
      .list {
          display: flex;
          flex-direction: column;
      }

      .participant-list {
        display: inline-flex;
      }

      .list-item {
        max-width: 290px;
        border-radius: 5px;
        padding: 10px;
        margin: 5px;
        transition: all .25s ease;
        border: 1px solid;
        background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgb(200 221 237) 100%);
        position: relative;
        display: flex;
        align-items: center;
        box-shadow: 0px 4px 8px rgba(35, 32, 74, 0.8);
      }

      .boards {
        position: absolute;
        background-color: #fff;
        top: 55px;
        left: 0;
        padding: 5px 10px 10px 10px;
        border-radius: 5px;
        transform: scale(0) translateY(-200%);
        opacity: 0;
        transition: all .25s ease;
      }

      .list-item:hover {
        cursor: pointer;
        z-index: 100;
      }

      .list-item:hover .boards {
        transform: scale(1) translateY(0%);
        opacity: 1;
      }
  </style>
  