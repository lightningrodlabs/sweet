import type { BoardState } from "./board"
import sanitize from "sanitize-filename";

interface BoardsExport {
    version: string,
    boards: Array<BoardState>
}

const EXPORT_FORMAT_VERSION = "1"
const PREFIX = "spreadsheets"
const download = (filename: string, text: string) => {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

export const exportBoard = (state: BoardState) => {
    const fileName = sanitize(`${PREFIX}_export_${state.name}.json`)
    _exportBoards(fileName, [state])
}

export const exportBoards = (boards: Array<BoardState>) => {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-`
        + date.getHours() + "_" + ("00" + date.getMinutes()).slice(-2) +"_"+ ("00" + date.getSeconds()).slice(-2)

    const fileName = sanitize(`${PREFIX}_export_${formattedDate}.json`)
    _exportBoards(fileName, boards)
}

const _exportBoards = (fileName:string, boards: Array<BoardState>) => {
    const exportObject: BoardsExport = {
        version: EXPORT_FORMAT_VERSION,
        boards,
    }
    download(fileName, JSON.stringify(exportObject))
}

export const deserializeExport = (jsonExport:string) : Array<BoardState> => {
    try {
        const exportObject: BoardsExport = JSON.parse(jsonExport) as BoardsExport
        if (!exportObject.version) {
            throw("Expected export to have a version number")
        }

        // santize for things that may be missing from previous exports
        for (const board of exportObject.boards) {
            if (!board.props.attachments) {
                board.props.attachments = []
            }
        }
        return exportObject.boards

    } catch (e) {
        console.log("Error importing boards:", e)
        return []
    }
}