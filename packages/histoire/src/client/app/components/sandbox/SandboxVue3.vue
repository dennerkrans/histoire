<script lang="ts" setup>
import { App, createApp, onMounted, onUnmounted, PropType, ref, watch } from 'vue'
import { Story, Variant, PropDefinition, AutoPropComponentDefinition } from '../../types'
import { getTagName } from '../../codegen/vue3'
import { applyStateToVariant } from '../../util/state'
// @ts-expect-error virtual module id
import * as setup from '$histoire-setup'
// @ts-expect-error virtual module id
import * as generatedSetup from '$histoire-generated-global-setup'

const props = defineProps({
  variant: {
    type: Object as PropType<Variant>,
    required: true,
  },

  story: {
    type: Object as PropType<Story>,
    required: true,
  },

  slotName: {
    type: String,
    default: 'default',
  },
})

const emit = defineEmits({
  ready: () => true,
})

const sandbox = ref<HTMLDivElement>()
let app: App
let mounting = false

async function mountVariant () {
  mounting = true

  await props.variant.initState()

  let lastPropsTypesSnapshot: string

  app = createApp({
    name: 'SandboxVue3',

    render: () => {
      const vnodes = props.variant.slots()?.[props.slotName]?.({
        state: props.variant.state ?? {},
      }) ?? props.story.slots()?.[props.slotName]?.({
        state: props.variant.state ?? {},
      })

      // Auto detect props
      if (props.slotName === 'default') {
        const propsTypes: AutoPropComponentDefinition[] = vnodes.filter(vnode => typeof vnode.type === 'object').map((vnode, index) => {
          const propDefs: PropDefinition[] = []
          for (const key in vnode.type.props) {
            const prop = vnode.type.props[key]
            let types
            let defaultValue
            if (prop) {
              const rawTypes = Array.isArray(prop.type) ? prop.type : [prop.type]
              types = rawTypes.map(t => {
                switch (t) {
                  case String:
                    return 'string'
                  case Number:
                    return 'number'
                  case Boolean:
                    return 'boolean'
                  case Object:
                    return 'object'
                  case Array:
                    return 'array'
                  default:
                    return 'unknown'
                }
              })
              defaultValue = typeof prop.default === 'function' ? prop.default.toString() : prop.default
            }
            propDefs.push({
              name: key,
              types,
              required: prop?.required,
              default: defaultValue,
            })

            // Props overrides
            if (props.variant.state?._hPropState?.[index]?.[key]) {
              vnode.props[key] = props.variant.state._hPropState[index][key]
            }
          }

          return {
            name: getTagName(vnode),
            index,
            props: propDefs,
          } as AutoPropComponentDefinition
        }).filter(def => def.props.length)

        const snapshot = JSON.stringify(propsTypes)
        if (!lastPropsTypesSnapshot || lastPropsTypesSnapshot !== snapshot) {
          applyStateToVariant(props.variant, {
            _hPropDefs: propsTypes,
          })
          if (!props.variant.state._hPropState) {
            applyStateToVariant(props.variant, {
              _hPropState: {},
            })
          }
          lastPropsTypesSnapshot = snapshot
        }
      }

      return vnodes
    },
  })

  if (typeof generatedSetup?.setupVue3 === 'function') {
    await generatedSetup.setupVue3({
      app,
      story: props.story,
      variant: props.variant,
    })
  }

  if (typeof setup?.setupVue3 === 'function') {
    await setup.setupVue3({
      app,
      story: props.story,
      variant: props.variant,
    })
  }

  if (typeof props.variant.setupApp === 'function') {
    await props.variant.setupApp({
      app,
      story: props.story,
      variant: props.variant,
    })
  }

  const target = document.createElement('div')
  sandbox.value.appendChild(target)
  app.mount(target)

  emit('ready')
}

onMounted(async () => {
  if (props.variant.initState) {
    await mountVariant()
  }
})

watch(() => props.variant.initState, value => {
  if (value && !mounting) {
    mountVariant()
  }
})

onUnmounted(() => {
  app?.unmount()
})
</script>

<template>
  <div
    ref="sandbox"
    class="__histoire-sandbox htw-overflow-auto"
  />
</template>
