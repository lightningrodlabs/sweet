import { type EntryHash, type DnaHash, CellType } from "@holochain/client";
import { JSONX } from '@univerjs/core';
import { cloneDeep } from "lodash";

export function extractActionsFromCommands(commands) {
  let actions = [];
  commands.forEach(command => {
    // const jsonX = JSONX.getInstance();
    // console.log(jsonX.editOp(command));
    if (command.params?.actions) {
      // command.params.actions.forEach(action => {
      //   if (action && action != 'body') {
      //     actions.push(action);
      //   }
      // });

      if (command.params.actions[1]["e"]?.length) {
        command.params.actions[1]["e"].forEach(item => {
          if (item) {
            actions.push(item);
          }
        });
      } else if (command.params.actions[0][1]["e"]) {
        actions.push({
          t: "i",
          body: command.params.actions[1][2]["i"]
        });
        // command.params.actions[0][1]["e"].forEach(item => {
        //   if (item && typeof item !== 'string') {
        //     actions.push(item);
        //     console.log('item', item);
        //   }
        // });
      }
    }
  });
  return actions;
}

export function extractJSONXFromCommands(commands) {
  let jsonXActions = [];
  commands.forEach(command => {
    if (command.params?.actions) {
      jsonXActions = jsonXActions.concat(command.params?.actions);
    }
  });
  return jsonXActions;
}

export function changeUndefinedToEmptyString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => changeUndefinedToEmptyString(item));
  } else if (typeof obj === 'object' && obj !== null) {
    let newObj = {};
    for (const key in obj) {
      if (obj[key] === undefined || obj[key] === null) {
        newObj[key] = "";
      } else if (typeof obj[key] === "object") {
        newObj[key] = changeUndefinedToEmptyString(obj[key]);
      } else {
        newObj[key] = obj[key];
      }
    }
    return newObj;
  }
  return obj
}

export function removeSymbolFields(obj) {
  let newObj = cloneDeep(obj)
  for (const key in newObj) {
      if (key.startsWith("Symbol") || key.startsWith("[[")) {
          delete newObj[key];
      } else if (typeof newObj[key] === "object" && newObj[key] !== null) {
          removeSymbolFields(newObj[key]);
      }
  }
  return newObj;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function onVisible(element, callback) {
    new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
        if(entry.intersectionRatio > 0) {
            callback(element);
        }
        });
    }).observe(element);
}

export type WALUrl = string

export const hashEqual = (a:EntryHash, b:EntryHash) : boolean => {
  if (!a || !b) {
    return !a && !b
  }
  for (let i = a.length; -1 < i; i -= 1) {
    if ((a[i] !== b[i])) return false;
  }
  return true;
}

export const getMyDna = async (role:string, client: AppAgentClient) : Promise<DnaHash>  => {
  const appInfo = await client.appInfo();
  const dnaHash = (appInfo.cell_info[role][0] as any)[
    CellType.Provisioned
  ].cell_id[0];
  return dnaHash
} 


// CONVERT TO PURE STRING UDM
import type { IDocumentBody } from '@univerjs/core'
import { act } from "react";

const UNIVER_PARAGRAPH_END_SYMBOL = '\r'
const UNIVER_SECTION_END_SYMBOL = '\n'

/**
 * convert pure string to UMD (Univer Document Model)
 * @param text
 * @returns
 */
export function convertPureStringToUDM(text: string): IDocumentBody {
  if (!text)
    return emptyUDM()

  let preText = text

  if (preText.includes('\n'))
    preText = preText.replace(/\n/g, UNIVER_PARAGRAPH_END_SYMBOL)

  if (preText[text.length - 1] !== UNIVER_SECTION_END_SYMBOL)
    preText += UNIVER_SECTION_END_SYMBOL

  const body: IDocumentBody = {
    dataStream: preText,
    textRuns: [],
    paragraphs: [],
    sectionBreaks: [],
    tables: [],
  }

  for (let i = 0; i < preText.length; i++) {
    if (preText[i] === UNIVER_PARAGRAPH_END_SYMBOL) {
      body.paragraphs!.push({
        startIndex: i,
        // paragraphStyle: {
        //   spaceAbove: 10,
        //   lineSpacing: 2,
        //   spaceBelow: 0,
        // },
      })
    }

    if (preText[i] === UNIVER_SECTION_END_SYMBOL) {
      body.sectionBreaks!.push({
        startIndex: i,
      })
    }
  }

  return body
}

export function emptyUDM(): IDocumentBody {
  return {
    dataStream: '\r\n',
    textRuns: [],
    tables: [],
    paragraphs: [
      {
        startIndex: 0,
      },
    ],
    sectionBreaks: [
      {
        startIndex: 1,
      },
    ],
  }
}
