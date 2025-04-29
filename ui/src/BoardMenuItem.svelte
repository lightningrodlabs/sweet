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
  import Workspace from "./menu/Workspace.svelte";
    import { toPromise } from "@holochain-open-dev/stores";
    import { HoloHashMap } from "@holochain-open-dev/utils";
    import { RaftClient } from "./raft";

  const dispatch = createEventDispatcher()
  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();

  export let boardHash: EntryHash
  export let boardType: BoardType

  let width = 10
  let dropdownVisible = false;
  let selectedWorkspaces = [];

  $: boardData = store.boardList.boardData2.get(boardHash)
  $: if ($boardData) {
    console.log("boardData", $boardData)
  }
  $: uiProps = store.uiProps
  $: docStore = store.synStore.documents.get(boardHash)
  $: workspacesStore = docStore.allWorkspaces
  let workspaces: HoloHashMap<HoloHash, any> = new HoloHashMap()
  $: if ($workspacesStore) {
    workspaces = $workspacesStore.value || new HoloHashMap()
    workspaces?.forEach(async (workspace) => {
      const tip = await toPromise(workspace.tip)
      const tipTime = tip?.record?.signed_action?.hashed?.content?.timestamp / 1000
      const nowTime = Date.now()
      const minutesPassed = (nowTime - tipTime) / 1000 / 60
      if (minutesPassed > 5) {
        workspaces.delete(workspace.workspaceHash)
        workspaces = workspaces
      }
    })
  }
  $: workspacesCount = Array.from(workspaces).length
</script>
<div class="wrapper" 
    title={$boardData?.value?.latestState.name}
    on:mousedown={()=>{
      dispatch("select")
    }} >
    {#if $boardData.status == "complete"}
      <div style="display: flex; flex-direction: row; width: 100%; margin-bottom: 10px;">
        {#if !hashEqual($uiProps.tips.get(boardHash), $boardData.value.tip)}
          <div class="unread"></div>
        {/if}

        <div style="margin-right: 0.5em;">
          {#if boardType == BoardType.active}
            {#if $boardData.value.latestState.type == "spreadsheet"}
              <SvgIcon icon="spreadsheet" color="#8e31ebe6" size="20"></SvgIcon>
            {:else if $boardData.value.latestState.type == "document"}
              <SvgIcon icon="textDocument" color="#4A559D" size="20"></SvgIcon>
            {:else if $boardData.value.latestState.type == "presentation"}
              <SvgIcon icon="presentation" color="#7888ff" size="20"></SvgIcon>
            {/if}
          {/if}
        </div>
        <div class="board-name">
          {$boardData.value.latestState.name}
        </div>
      </div>

      <div class="hover-choice">
        <!-- for each workspace -->
        {#if workspacesCount > 1}
          <div
            style="
                margin-bottom: 10px;
                font-size: 14px;
                color: rgb(215 112 0 / 75%);
                font-style: italic;
                line-height: 1;
              "
          >
            There are multiple groups of people editing this document separately right now. You can join any of them.
          </div>
          {#each Array.from(workspaces) as [workspaceHash, workspace], index}
            <div class="join-workspace">
                <Workspace
                  name={"Join " + toWordsOrdinal(index + 1) + " workspace"}
                  {workspace}
                  {store}
                />
            </div>
          {/each}
        {:else if workspacesCount == 1}
          {@const workspace = Array.from(workspaces)?.[0]?.[1]}
          {#if workspace}
            <div class="join-workspace">
              <Workspace
                name={"Edit live "}
                {store}
                {workspace}
              />
            </div>
          {/if}
        {/if}

        {#if false || workspacesCount != 1}
          <!-- start new editing session -->
          {#if boardType == BoardType.active}
          <div class="join-workspace" style="display: flex; align-items: center; justify-content: space-between; padding: 10px;">
            <div on:mousedown={async ()=>{
              const newWorkspace = await docStore.createWorkspace(encodeHashToBase64(boardHash) + "_" + Date.now(), null)
              const session = await newWorkspace.joinSession()
              const raftClient = await new RaftClient(session.synClient.client, 'calcy', newWorkspace.workspaceHash);
              console.log("raftClient", raftClient);
              const initialize = await raftClient.initializeRaft();
              await store.setActiveBoard(boardHash, newWorkspace.workspaceHash)
            }} style="flex: 1; display: flex; align-items: center; cursor: pointer;">
              <SvgIcon icon="faUserPen" color="#4A559D" size="20"></SvgIcon>
              <div style="margin-left: 10px;">{workspacesCount == 0 ? "Start editing" : "Start new workspace alone"}</div>
            </div>
            <div style="position: relative; margin-left: 10px;" on:mouseenter={() => dropdownVisible = true} on:mouseleave={() => dropdownVisible = false}>
              <!-- <button style="cursor: pointer;">
                Edit from...
              </button>
              {#if dropdownVisible}
                <div class="dropdown" style="position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 5px; padding: 10px; z-index: 10;">
            {#each Array.from(workspaces) as [workspaceHash, workspace]}
              <div style="display: flex; align-items: center; margin-bottom: 5px;">
                <input type="checkbox" id={workspaceHash} bind:group={selectedWorkspaces} value={workspaceHash} />
                <label for={workspaceHash} style="margin-left: 5px;">{workspace.name || "Unnamed Workspace"}</label>
              </div>
            {/each}
            <button on:click={() => {
              console.log("Selected workspaces:", selectedWorkspaces);
              dropdownVisible = false;
            }} style="margin-top: 10px; cursor: pointer;">
              Confirm
            </button>
                </div>
              {/if} -->
            </div>
          </div>
          {/if}
        {/if}
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