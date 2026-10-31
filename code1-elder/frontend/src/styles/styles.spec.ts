import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
const names=['base.css','layout.css','components.css','pages.css']
it('uses focused stylesheets without desktop preview selectors',()=>{const dir=join(process.cwd(),'src/styles');for(const name of names)expect(existsSync(join(dir,name)),name).toBe(true);const css=names.map(n=>readFileSync(join(dir,n),'utf8')).join('\n');for(const old of ['.layout{','.aside{','.steps{','.chatblank{','.toast{','.toggle{'])expect(css).not.toContain(old)})
