<script lang="ts">
  import type { AgentPubKey } from "@holochain/client";
  import { isEqual } from "lodash";
 
  import Avatar from "./Avatar.svelte";
  import type { Board } from "./board";

  export let board: Board
  export let highlightedAgent: AgentPubKey;
  export let max = 5
  $: participants = board ? board.sessionParticipants() : undefined

  export let size:number = 24;

</script>
<div class="wrapper"
    class:bordered={false}  >
    {#if $participants && $participants.status=="complete"}
    {@const folks = Array.from($participants.value).slice(0,max)}
    {@const extra = $participants.value.length - folks.length}
      {#each folks as agentPubKey}
      <span style="margin: 2px;">
        <Avatar size={size} agentPubKey={agentPubKey} showNickname={false} highlight={isEqual(agentPubKey, highlightedAgent)} />
      </span>
      {/each}
      {#if extra != 0}
        + {extra} more
      {/if}
    {/if}
</div>
<style>
  .bordered {
    border: solid 1px gray;
  }
  .wrapper {
    border-radius: 50%;
    display: flex;
    flex-direction: row
  }
</style>