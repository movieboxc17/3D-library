FBX Viewer - static site

What this is
- A minimal static website that lists FBX files stored in `models/`, lets you click to view them with Three.js, interact (orbit), and download either from the repo or a local drag/drop.

Files added
- `index.html` — main UI
- `css/styles.css` — basic styling
- `js/viewer.js` — Three.js viewer logic using CDN modules
- `models/models.json` — list of models (edit this or replace)

How to use locally
1. Put your `.fbx` files into the `models/` folder in the repo.
2. Update `models/models.json` with entries for each file: { "name": "MyModel.fbx", "url": "models/MyModel.fbx", "size": "12 MB" }
3. Run a simple static server and open the site. Example (PowerShell):

```powershell
# from repository root
python -m http.server 8000
# then open http://localhost:8000/
```

Drag & drop: You can drag an FBX file from your file manager onto the "Drop FBX file here" area to load it locally without adding it to the repo.

Deploy to GitHub Pages
1. Create a GitHub repo and push the workspace to it (ensure `models/` contains your FBX files or keep them large and use LFS).
2. In repository settings enable GitHub Pages to serve the `main` branch root or use `gh-pages` branch.

Notes and limitations
- FBXLoader supports many but not all FBX variants. Complex scenes, custom embedded textures, or very large files may fail to load in the browser.
- Models included in the repo must be served over HTTP(S); opening `index.html` directly from the file system will be blocked by CORS or loader restrictions.
- For large uploads use Git LFS or host models on a CDN and point `models.json` to those URLs.

Next steps (optional)
- Add a small Node/Python script to auto-generate `models/models.json` by scanning the `models/` folder.
- Add model thumbnails and a progress loader.
