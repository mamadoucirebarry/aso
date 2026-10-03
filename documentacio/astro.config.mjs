import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightThemeNext from 'starlight-theme-next'
import starlightImageZoom from 'starlight-image-zoom'

export default defineConfig({
  site: 'https://mamadoucirebarry.github.io',
  base: '/aso',
  integrations: [
   starlight({
      title: 'ASO - Sistemes Operatius',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mamadoucirebarry/aso' }
      ],
      plugins: [starlightThemeNext(), starlightImageZoom()],
  }),
  ],
})
