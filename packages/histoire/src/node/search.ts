import { createRequire } from 'module'
import flexsearch from 'flexsearch'
import path from 'pathe'
import Case from 'case'
import { Context } from './context.js'
import { loadModule } from './load.js'

const require = createRequire(import.meta.url)

export async function generateTitleSearchData (ctx: Context) {
  const searchIndex = await createIndex()
  const { idMap, addToIdMap } = createIdMap()

  for (const storyFile of ctx.storyFiles) {
    if (storyFile.story) {
      searchIndex.add({
        id: addToIdMap(storyFile.story.id, 'story'),
        text: convertTitleToSentence(storyFile.story.title),
      })
      for (const variant of storyFile.story.variants) {
        searchIndex.add({
          id: addToIdMap(`${storyFile.story.id}:${variant.id}`, 'variant'),
          text: convertTitleToSentence(`${storyFile.story.title} ${variant.title}`),
        })
      }
    }
  }

  return {
    index: await exportSearchIndex(searchIndex),
    idMap,
  }
}

export async function generateDocSearchData (ctx: Context) {
  const searchIndex = await createIndex()
  const { idMap, addToIdMap } = createIdMap()

  for (const storyFile of ctx.storyFiles) {
    if (storyFile.story && storyFile.story.docsText) {
      searchIndex.add({
        id: addToIdMap(storyFile.story.id, 'story'),
        text: storyFile.story.docsText,
      })
    }
  }

  return {
    index: await exportSearchIndex(searchIndex),
    idMap,
  }
}

async function createIndex () {
  const flexsearchRoot = path.dirname(require.resolve('flexsearch/package.json'))
  return new flexsearch.Document({
    preset: 'match',
    document: {
      id: 'id',
      index: [
        'text',
      ],
    },
    charset: await loadModule(`${flexsearchRoot}/dist/module/lang/latin/advanced.js`),
    language: await loadModule(`${flexsearchRoot}/dist/module/lang/en.js`),
    tokenize: 'forward',
  })
}

function createIdMap () {
  let uid = 0
  const idMap: Record<number, { id: string, kind: string }> = {}

  function addToIdMap (id: string, kind: string) {
    const n = uid++
    idMap[n] = { id, kind }
    return n
  }

  return {
    idMap,
    addToIdMap,
  }
}

const exportKeys = new Set([
  'reg',
  'text.cfg',
  'text.map',
  'text.ctx',
  'tag',
  'store',
])

async function exportSearchIndex (index) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const exportedData: Record<string, any> = {}
    const exportedKeys = new Set<string>()
    await index.export((key, data) => {
      exportedData[key] = data
      exportedKeys.add(key)
      if (exportedKeys.size === exportKeys.size) {
        resolve(exportedData)
      }
    })
  })
}

function convertTitleToSentence (text: string) {
  return text.split(' ').map(str => Case.lower(str)).join(' ')
}

// @TODO clear handlers when SearchPane unmounts
export function getSearchDataJS (data: any) {
  return `export let searchData = ${JSON.stringify(data)}
const handlers = []
export function onUpdate (cb) {
  handlers.push(cb)
}
if (import.meta.hot) {
  import.meta.hot.accept(newModule => {
    searchData = newModule.searchData
    handlers.forEach(h => {
      h(newModule.searchData)
      newModule.onUpdate(h)
    })
  })
}`
}
