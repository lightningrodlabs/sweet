<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { NetworkInfoRequest } from '@holochain/client';
    import Matrix from './Matrix.svelte';
    import SvgIcon from './shared/SvgIcon.svelte';

    export let client;

    const timeoutInterval = 60 * 1000;

    let lastMoved = new Date().getTime();
    let collapsed = false;
    let syncInterval;
    let pullInterval;
    let networkInfo;
    let diff = 0;
    let lastTimeQueried = 0;

    function detectCursorMovement() {
        lastMoved = new Date().getTime();
        diff = 0;
    }

    async function checkSync() {
        const now = new Date().getTime();
        diff = now - lastMoved;

        if (!collapsed && diff < timeoutInterval) {
            let networkInfoRequest: NetworkInfoRequest = {
                last_time_queried: lastTimeQueried,
                agent_pub_key: client.myPubKey,
                dnas: client.cachedAppInfo.cell_info.calcy.map((cell) => cell.provisioned.cell_id[0])
            }
            // * Timestamp in ms
            lastTimeQueried = now * 1000
            // console.log("networkInfoRequest", networkInfoRequest);
            networkInfo = await client.networkInfoRequester(networkInfoRequest);
            // const newData: boolean = networkInfo?.[0]?.bytes_since_last_time_queried > 0;
            // console.log(JSON.stringify(networkInfo, null, 4));
        }
    }

    async function checkPull() {
        // const now = new Date().getTime();
        // diff = now - lastMoved;

        // if (diff < timeoutInterval) {
        //     lastTimeQueried = now * 1000
        //     console.log("checkPull", lastTimeQueried);
        //     await refetchCoordinationsWithDetails(client);
        // }
    }

    onMount(() => {
        // console.log("Sync component mounted", client);
        detectCursorMovement();
        checkSync();
        window.addEventListener('mousemove', detectCursorMovement);
        syncInterval = setInterval(checkSync, 15 * 1000);
        pullInterval = setInterval(checkPull, 1 * 60 * 1000);
    });

    onDestroy(() => {
        window.removeEventListener('mousemove', detectCursorMovement);
        clearInterval(syncInterval);
        clearInterval(pullInterval);
    });
</script>

<div class="sync-box" class:collapsed={collapsed}>
    <button class="toggle-button" on:click={() => collapsed = !collapsed}>
        {#if collapsed}▲ Network{:else}▼ Network{/if}
    </button>
    <div>
        {#if networkInfo?.[0]?.fetch_pool_info?.op_bytes_to_fetch > 0}
            <span style="margin:0 !important;">Incoming data...</span>
            <Matrix />
        {:else if diff > timeoutInterval}
            <span>
                Move cursor to check network
            </span>
        {:else if networkInfo?.[0]?.current_number_of_peers == 1}
            Alone in network
        {:else}
            <SvgIcon size=12 color="white" icon="faCheck" />
            <span
                style="margin-left: -8px;"
            >
                In sync with 
                <br>{networkInfo?.[0]?.current_number_of_peers} peers
            </span>
        {/if}
    </div>
</div>


<style>
    .sync-box {
        width: 120px;
        position: fixed;
        bottom: 0;
        right: 0;
        background-color: #c4a3f5e6;
        backdrop-filter: blur(10px);
        border: 1px solid #5c00eae6;
        color: white;
        padding: 10px;
        z-index: 1000;
        transition: transform 0.3s ease-in-out;
    }

    :global(.dark-mode ) .sync-box {
        /* background-color: rgba(255, 255, 255, 0.5); */
        color: white;
    }

    .collapsed {
        transform: translateY(100%);
    }

    .toggle-button {
        position: absolute;
        right: 16px;
        top: -29px;
        background-color: #5c00eae6;
        color: white;
        border: none;
        padding: 6px;
        cursor: pointer;
    }

    span {
        margin-left: 4px !important;
        color: white;
    }
</style>