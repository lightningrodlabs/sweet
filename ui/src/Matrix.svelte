<script>
    import { onMount } from "svelte";

    let columns = [];
    const numColumns = 16;
    const numRows = 4;
    export let speed = 500; // Lower value = faster animation

    $: columns;

    function generateMatrix() {
        columns = Array.from({ length: numColumns }, () => ({
            values: Array(numRows).fill(0).map(() => Math.round(Math.random())),
            offset: Math.random() * numRows,
        }));
    }

    function updateMatrix() {
        // console.log('Updating matrix...');
        const lastColumn = columns.pop();
        const newRandomColumn = {
            values: Array(numRows).fill(0).map(() => Math.round(Math.random())),
            offset: Math.random() * numRows,
        };
        columns = [newRandomColumn, ...columns];

        // columns.forEach((col) => {
        //     const lastValue = col.values.pop();
        //     col.values.unshift(lastValue);
        // });
    }

    onMount(() => {
        generateMatrix();
        const interval = setInterval(updateMatrix, speed);
        return () => clearInterval(interval);
    });
</script>

<div class="matrix">
    {#each columns as col}
        <div class="column">
            {#each col.values as value, i}
                <!-- <span class="digit" style="animation-delay: {i * 0.1}s">{value}</span> -->
                <span class="digit">{value}</span>
            {/each}
        </div>
    {/each}
</div>

<style>
    .matrix {
        display: grid;
        grid-template-columns: repeat(16, 1fr);
        font-family: monospace;
        font-size: 10px;
        color: white;
        overflow: hidden;
    }
    .column {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
    }
    .digit {
        color: white;
        /* opacity: 0.1; */
        /* animation: fadeIn 1s infinite linear; */
    }
    /* @keyframes fadeIn {
        0% { opacity: 0.1; }
        50% { opacity: 1; }
        100% { opacity: 0.1; }
    } */
</style>
