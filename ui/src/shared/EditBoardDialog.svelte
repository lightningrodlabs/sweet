<script lang="ts">
    import BoardEditor from './BoardEditor.svelte';
    import type { CalcyStore } from '../store';
    import { getContext, onMount } from 'svelte';
    import { isEqual } from 'lodash'
    import { encodeHashToBase64, type EntryHash, type EntryHashB64 } from '@holochain/client';
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog';
    import type { Board, BoardProps, BoardState, } from '../board';

    let boardHash:EntryHash|undefined = undefined

    let dialog: SlDialog
    onMount(async () => {

    })

    export const  open = async (hash: EntryHash)=> {
        boardHash = hash
        boardEditor.edit(hash)
        dialog.show()
    }

    const { getStore } :any = getContext('store');

    const store:CalcyStore = getStore();

    const updateBoard = async ( name: string, props: BoardProps) => {
        const boardHashB64 = encodeHashToBase64(boardHash)

        const board: Board | undefined = await store.boardList.getBoard(boardHash)
        if (board) {
        let changes = []
        const state: BoardState = board.state()
        if (state.name != name) {
            changes.push(
            {
                type: 'set-name',
                name: name
            })
        }
        if (!isEqual(props, state.props)) {
            changes.push({type: 'set-props',
            props: props
            })
        }
        if (changes.length > 0) {
            await board.requestChanges(changes)
        }
        }
        close()
    }
    const close = ()=>{
        dialog.hide()
        boardHash=undefined
    }
    let boardEditor
</script>
<sl-dialog persistent bind:this={dialog} label="Edit Board" 
on:sl-initial-focus={(e)=>{
    boardEditor.initialFocus()
    e.preventDefault()

  }}

on:sl-request-close={(event)=>{
    if (event.detail.source === 'overlay') {
    event.preventDefault();    
}}}>
    <BoardEditor bind:this={boardEditor} handleSave={updateBoard} cancelEdit={close}/>
</sl-dialog>
