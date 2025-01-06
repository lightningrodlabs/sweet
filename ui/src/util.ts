import { type AppAgentClient, type EntryHash, type DnaHash, CellType } from "@holochain/client";

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
