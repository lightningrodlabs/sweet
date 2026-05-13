<script lang="ts">
  import { createEventDispatcher, getContext, onMount } from "svelte";
  import { get } from "svelte/store";
  import { toWordsOrdinal } from "number-to-words"
  import type { CalcyStore } from "./store";
  import { encodeHashToBase64, type HoloHash, type EntryHash } from "@holochain/client";
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import Participants from "./shared/Participants.svelte";
  import { BoardType } from "./boardList";
  import { hashEqual } from "./util";
  import SvgIcon from "./shared/SvgIcon.svelte";

  const dispatch = createEventDispatcher()
  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();

  export let boardHash: EntryHash
  export let boardType: BoardType

  $: boardData = store.boardList.boardData2.get(boardHash)
  $: uiProps = store.uiProps
  $: docStore = store.synStore.documents.get(boardHash)
</script>
<div class="wrapper" 
    title={$boardData?.value?.latestState.name}
    on:mousedown={()=>{
      dispatch("select")
    }} >
    {#if $boardData.status == "complete"}
      <div style="display: flex; flex-direction: row; width: 100%; margin-bottom: 0px;">
        {#if !hashEqual($uiProps.tips.get(boardHash), $boardData.value.tip)}
          <div class="unread"></div>
        {/if}

        <div style="margin-right: 0.5em;">
          {#if boardType == BoardType.active}
            <SvgIcon icon="spreadsheet" color="#8e31ebe6" size="20"></SvgIcon>
          {/if}
        </div>
        <div class="board-name">
          {$boardData.value.latestState.name}
        </div>
      </div>
    {:else if $boardData.status == "pending"}
      <sl-skeleton
        effect="pulse"
        style="height: 10px; width: 100%"
        ></sl-skeleton>
    {:else if $boardData.status == "error"}
      {$boardData.error}
    {/if}
</div>
<style>
  .unread {
    margin-right: 9px;
    margin-top: 9px;
    width: 10px;
    height: 10px;
    border-radius: 100px;
    border-left: 10px solid rgb(102, 137, 202);
  }

  .wrapper {
    width: 100%;
    /* height: 300px; */
    border-radius: 50%;
    display: flex;
    flex-direction: column;
  }
  .board-name {
    font-size: 16px;
    font-weight: bold;
    margin-right: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .join-workspace {
    width: 100%;
    display: flex; 
    justify-content: flex-start;
    border-radius: 10px;
  }

  .join-workspace:hover {
    background-color: hsl(235, 7%, 68%);
    cursor: pointer;
  }

  .hover-choice {
    display: block;
    transition: all 0.3s ease;
  }

  .wrapper:hover .hover-choice {
    display: block;
  }
</style>