<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import { onMount } from "svelte";
    import SvgIcon from "./shared/SvgIcon.svelte"
    import { onVisible } from './util';

    export let handleSave
    export let handleDelete = undefined
    export let text = ""
    export let placeholder = ""
    export let saveButtonText="Save"
    export let confirmButtons=false

    let origText = ""

    onMount(async () => {
        origText = text
        onVisible(inputElement,()=>{
            inputElement.focus()
            inputElement.select()
        })
	});
    let isEditing = false
    let inputElement

    const doCancel = ()=> {
        isEditing = false
    }


    $: text
</script>

<div class="click-edit">
    <div class="editing" class:hidden={!isEditing}>
        <sl-input placeholder={placeholder} value={text} bind:this={inputElement}
            on:sl-input={(e)=>{
                text = e.target.value
            }}
            on:sl-change={(e)=>{
                isEditing= false
            }
            }
            on:sl-blur={()=>{
                handleSave(text)
                isEditing= false
            }}
            on:keydown={(e)=> {
                if (e.keyCode == 27) {
                    text = origText
                    isEditing= false
                }
            }}
          >
        </sl-input>
        {#if confirmButtons}
            <sl-button on:mousedown={()=>handleSave(text)}>
                {saveButtonText}
            </sl-button>
            <sl-button on:mousedown={doCancel}>
                <SvgIcon icon=faCancel/>
            </sl-button>
        {/if}
    </div>
    <div class="not-editing" class:hidden={isEditing}
        
    >
        
        <span style="cursor:pointer" on:click={(e)=>{
            e.stopPropagation();
            isEditing = true;
        }}> {text} <SvgIcon icon=faEdit size=14px style="opacity: .3; height: .875rem; margin-left: 3px; position: relative; top: -.15rem"/></span >
        {#if handleDelete} 
            <span style="cursor:pointer" on:click={(e)=>{
                e.stopPropagation();
                handleDelete()
            }}><SvgIcon icon=faTrash size=14px style="opacity: .3; height: .875rem; margin-left: 3px; position: relative; top: -.15rem"/></span >
        {/if}        
    </div>
</div>


<style>
    .not-editing {
        width: 100%;
        font-weight: bold;
    }

    .hidden {
        display: none;
    }
</style>