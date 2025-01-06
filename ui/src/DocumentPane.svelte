<script lang="ts">
    import { setupUniverDocs } from "./setup-univer";
    import { onMount } from "svelte";
    import type {  Board, BoardDelta, BoardProps } from "./board";

    export let activeBoard: Board

    let univerAPI;
    let unsubs = [];
    $: synState = activeBoard.readableState()
    $: clerkStatus = activeBoard.session ? activeBoard.session.clerkStatus: null
    $: clerk = activeBoard.session ? activeBoard.session.clerk: null
    $: chronicle = activeBoard.session ? activeBoard.session.chronicle: null

    onMount(async () => {
        univerAPI = await setupUniverDocs();
        // setupToolbar(univerAPI)
        let beforeCommandListerner = univerAPI.onBeforeCommandExecute((command, options) => {
            if (!command.id.includes("mutation")) {return false;}
            console.log("beforeCommandListerner", command, options);
        });
        unsubs.push(beforeCommandListerner)
    });
</script>
{JSON.stringify($chronicle)}
<div id="app">
    <div id="toolbar"></div>
    <div id="univer"></div>
</div>

<style>
    #univer {
        height: 100vh;
        width: 100vw;
    }
</style>