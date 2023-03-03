importScripts("https://cdn.jsdelivr.net/pyodide/v0.22.1/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.4/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.4/dist/wheels/panel-0.14.4-py3-none-any.whl', 'pyodide-http==0.1.0', 'param', 'requests']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

#!/usr/bin/env python
# coding: utf-8

# ## Custom PDB Input Component using Vue.js
# 
# [Panel](https://panel.holoviz.org/index.html) makes it easy to build data apps in Python using a wide range of [built in components](https://panel.holoviz.org/reference/index.html). Sometimes you want to go beyond those built in components and build [custom components](https://panel.holoviz.org/user_guide/Custom_Components.html) instead.
# 
# The lessons below will build on each other, culminating in a Panel+Vue.js custom component inspired by medicinal chemistry. It’ll look like this:
# 
# ![Panel Vue.js Component](../../assets/VuePdbInput.gif)
# 
# This guide is heavily inspired by [Web Development with Python and Vue.js Components](https://blog.reverielabs.com/python-vue-components/).

# ## What is a Vue Component?

# [Vue components](https://vuejs.org/v2/guide/components.html) are self-contained elements that can render HTML/CSS, store data within Javascript variables, and much more. Once defined, they are callable as HTML tags. For example, within existing HTML a Vue component can be rendered like below:
# 
# ![Vue Component](../../assets/vue_bootstrap_component.png)

# Here, the Vue component tags \`<v-component></v-component>\` are responsible for rendering a part of the frontend that takes user input. 
# 
# The components are usually defined in a .vue file and require Webpack to serve. 
# 
# With Panel you can take a **simpler approach**, there is no need to configure, learn and maintain an advanced javascript build tool chain to utilize Vue.js. We will show you how this is done below using Panels [ReactiveHTML](https://panel.holoviz.org/user_guide/Custom_Components.html#reactivehtml-components).

# ## Lets Get Started
# 
# In order to ensure that all the resources we need (such as Vue.js) are loaded appropriately we need to declare baseclasses which declare these dependencies **before** we run the \`panel.extension\`:

# In[ ]:


import panel as pn
import param
import requests

class BasicVueComponent(pn.reactive.ReactiveHTML):
    _template = """
    <div id="container" style="height:100%; width:100%; background:#0072B5; border-radius:4px; padding:6px; color:white">
      <vue-component></vue-component>
    </div>
    """
    
    _scripts = {
        "render": """
    const template = "<div>Hello Panel + Vue.js World!</div>"
    const vue_component = {template: template}
    el=new Vue({
        el: container,
        components: {
            'vue-component' : vue_component
        } 
    })
    """
    }
        
    __javascript__=[
        "https://cdn.jsdelivr.net/npm/vue@2/dist/vue.js"
    ]
    
class BootstrapVueComponent(BasicVueComponent):
    
    __javascript__=[
        "https://cdn.jsdelivr.net/npm/vue@2/dist/vue.js",
        "https://unpkg.com/bootstrap-vue@latest/dist/bootstrap-vue.min.js",
    ]
    __css__=[
        "https://unpkg.com/bootstrap/dist/css/bootstrap.min.css",
        "https://unpkg.com/bootstrap-vue@latest/dist/bootstrap-vue.min.css",
    ]


# Now that we have declared the components we run the extension:

# In[ ]:


pn.extension(sizing_mode="stretch_width")


# ## Basic Vue Component
# 
# Let's start by rendering the \`BasicVueComponent\` which simply renders a \`Hello World\` template using Vue.js:

# In[ ]:


BasicVueComponent(height=40, width=190)


# ## What are PDBs?
# 
# This example will build a little example based on fetching and rendering so called PDBs. A PDB is a file format that stores 3-D structural information about a protein. This information is useful for example when designing drugs that inhibit disease-causing proteins. We will use the [KLIFS open source database of PDBs](https://klifs.net/).
# 
# You can find more information about PDBs [here](https://blog.reverielabs.com/building-a-global-pdb-repository/).

# ## Getting PDBs
# 
# We can get PDBs using KLIFS [\`structured_pdb_list\` rest endpoint](https://klifs.net/swagger/#/Structures/get_structures_pdb_list).

# In[ ]:


URL = "https://klifs.net/api/structures_pdb_list"

def get_pdb_data_from_klifs(pdb_id):
    if not pdb_id:
        return "Please specify a PDB ID."
    
    params = {'pdb-codes': pdb_id}
    res = requests.get(url = URL, params = params)
    data = res.json()
    
    if res.status_code == 400:
        return f"Error 400, Could not get PDB {pdb_id}", data[1]
        
    return data[0]


# Lets test the function:

# In[ ]:


get_pdb_data_from_klifs("4WSQ") # Examples: 2xyu, 4WSQ


# ## PDBInput Component
# 
# Now we will build a Vue.js component containing an input field and a button that will update the \`value\` parameter of the \`PDBInput\` component:

# In[ ]:


class PDBInput(BootstrapVueComponent):
    
    value = param.String()
    
    _template = """
    <div id="container" style="height:100%; width:100%">
      <vue-component></vue-component>
    </div>
    """
    
    _scripts = {
        "render": """
    const template = \`
    <div>
      <b-form v-on:keydown.enter.prevent>
        <b-form-input v-model="pdb_id" placeholder="Enter PDB ID" required></b-form-input>
        <b-button variant="secondary" size="sm" v-on:click="setPDBId" style="margin-top:10px;width:100%">
            Retrieve PDB metadata
        </b-button>
      </b-form>
    </div>\`
    const vue_component = {
      template: template,
      delimiters: ['[[', ']]'],
      data: function () {
        return {
          pdb_id: data.value,
        }
      },
      methods: {
        setPDBId() {
          data.value = this.pdb_id
        }
      }
    }
    const el = new Vue({
        el: container,
        components: {
            'vue-component': vue_component
        } 
    })
    """
    }


# In[ ]:


pdb_input = PDBInput(height=90, max_width=800)
pdb_input


# Please note how we *get* and *set* the \`value\` of the Parameterized python class using \`data.value\`.

# ## Display the PDB Response
# 
# Next we will [bind](https://panel.holoviz.org/user_guide/APIs.html#reactive-functions) the \`get_pdb_data_from_klifs\` function to the \`value\` parameter of the \`pdb_input\` component:

# In[ ]:


iget_klifs_data = pn.bind(get_pdb_data_from_klifs, pdb_id=pdb_input.param.value)


# In[ ]:


component = pn.Column(
    pdb_input, 
    pn.panel(iget_klifs_data, theme="light")
)
component


# ## Lets wrap it up in a nice app

# In[ ]:


ACCENT = "#0072B5"
INFO = """# Featurize Protein Structure

Use the Vue component below to retrieve PDB metadata from [KLIFS](https://klifs.net/). For example for \`2xyu\` or \`4WSQ\`"""


# In[ ]:


pn.template.BootstrapTemplate(
        site="Awesome Panel", title="Custom PDB Input Component using Vue.js", main=[INFO, component], header_background=ACCENT
).servable();


# You can serve the app via \`panel serve VuePdbInput.ipynb\` and find it at https://localhost:5006/VuePdbInput.
# 
# If you want to use Panel for Chemistry and Molecular Biology checkout [panel-chemistry](https://github.com/marcskovmadsen/panel-chemistry).


await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.runPythonAsync(`
    import json

    state.curdoc.apply_json_patch(json.loads('${msg.patch}'), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads("""${msg.location}""")
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()