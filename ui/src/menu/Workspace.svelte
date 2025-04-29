<script lang="ts">
import { encodeHashToBase64 } from "@holochain/client";
import Participants from "../shared/Participants.svelte";
import Avatar from "../shared/Avatar.svelte";

export let workspace;
export let name;
export let store;

$: myPubKey = store.myAgentPubKeyB64;
let participants = []
$: participantsStore = workspace.sessionParticipants
$: if ($participantsStore) {
//   participants = $participantsStore.value?.filter(
//     (agentPubKey) => encodeHashToBase64(agentPubKey) != myPubKey
//   )
    participants = $participantsStore.value
    console.log("participants", participants)
}
</script>

<div style="width: 100%; display: flex; flex-direction: row; align-items: center; padding: 10px;"
    on:mousedown={async () => {
        await workspace.joinSession()
        console.log("join session", workspace.workspaceHash)
        await store.setActiveBoard(workspace.documentStore.documentHash, workspace.workspaceHash)
        // dispatch("select")
    }}
>
    <div style="margin-left: 6px; display: flex;">
        {#each participants || [] as agentPubKey}
            <span style="margin-left: -6px;">
                <Avatar size={22} agentPubKey={agentPubKey} showNickname={false} />
            </span>
        {/each}
        <!-- <div style="margin-left: 10px;">{name}</div> -->
        <div style="margin-left: 10px;">
            {name}
            {#if !(participants?.length == 1 && encodeHashToBase64(participants[0]) == myPubKey)}
                with
                {#each participants || [] as agentPubKey, index}
                    {#if index < 3}
                        {#if encodeHashToBase64(agentPubKey) == myPubKey}
                            You
                        {:else}
                            <Avatar size={22} agentPubKey={agentPubKey} showNickname={true} showAvatar={false} />
                        {/if}
                        {index == participants.length - 1 ? "" : index == participants.length - 2 ? " and " : ", "}
                    {:else if index == 3}
                        <span style="margin-left: 5px;">{participants.length - 3} others</span>
                    {/if}
                {/each}
            {/if}
        </div>
    </div>
</div>