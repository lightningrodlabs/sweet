<script lang="ts">
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import { createEventDispatcher, getContext } from "svelte";
  import type { CalcyStore } from "./store";
  import { weaveUrlToWAL, type WAL } from "@lightningrodlabs/we-applet";
  import SvgIcon from "./SvgIcon.svelte";
  import { hrlToString } from "@holochain-open-dev/utils";
  import type { WALUrl } from "./util";

  const dispatch = createEventDispatcher()

  export let attachments: Array<WALUrl>
  export let allowDelete = true

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();
  
</script>
<div class="attachments-list">
  {#each attachments as attachment, index}
    {@const wal = weaveUrlToWAL(attachment)}
    <div 
      class:attachment-item-with-delete={allowDelete}
      class:attachment-item={!allowDelete}
    >
      {#await store.weClient.assetInfo(wal)}
        <div style="cursor:pointer; padding: 0 5px 0 5px; border: dashed 1px;margin-right:5px" title={`Resolving WAL: ${hrlToString(wal.hrl)}?${JSON.stringify(wal.context)}`}> ...</div>
      {:then data}
        {#if data}
          {@const assetInfo = data.assetInfo}
          <sl-button  size="small"
            on:click={async (e)=>{
                e.stopPropagation()
                try {
  //                embedLink = index
                  await store.weClient.openWal(wal)
                } catch(e) {
                  alert(`Error opening link: ${e}`)
                }
              }}
            style="display:flex;flex-direction:row;margin-right:5px"><sl-icon src={assetInfo.icon_src} slot="prefix"></sl-icon>
            {assetInfo.name}
          </sl-button>
        {:else} 
        <div style="color:red; cursor:pointer; padding: 0 5px 0 5px; border: dashed 1px;margin-right:5px" title={`Failed to resolve WAL: ${hrlToString(wal.hrl)}?${JSON.stringify(wal.context)}`}>Bad WAL</div>

        {/if}
      {:catch error}
        <div style="color:red">Error getting asset info: {error}</div>
      {/await}
      {#if allowDelete}
        <sl-button size="small"
          on:click={()=>{
            dispatch("remove-attachment",index)
          }}
        >
          <SvgIcon icon=faTrash size=12 />
        </sl-button>
      {/if}
</div>
  {/each}
</div>
<style>
  .attachments-list {
    display:flex;
    flex-direction:row;
    flex-wrap: wrap;
  }
  .attachment-item {
  }
  .attachment-item-with-delete {
    border:1px solid #aaa; 
    background-color:rgba(0,255,0,.1); 
    padding:4px;
    display:flex;
    margin-right:4px;
    border-radius:4px;
  }
</style>