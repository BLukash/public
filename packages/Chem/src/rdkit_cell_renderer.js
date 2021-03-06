/**
 * RDKit-based molecule cell renderer.
 * */
class RDKitCellRenderer extends DG.GridCellRenderer {

  constructor() {

    super();
    this.canvasCounter = 0;
    this.molCache = new DG.LruCache();
    this.molCache.onItemEvicted = function (mol) {
      mol.delete();
      mol = null;
    };
    this.rendersCache = new DG.LruCache();
    this.rendersCache.onItemEvicted = function (obj) {
      obj.canvas = null;
      obj.canvasId = null;
      obj = null;
    }

  }

  get name() { return 'RDKit cell renderer'; }
  get cellType() { return DG.SEMTYPE.MOLECULE; }
  get defaultWidth() { return 200; }
  get defaultHeight() { return 100; }

  _molIsInMolBlock(molString, rdkitMol) {

    const smilesMolString = rdkitMol.get_smiles();
    if (smilesMolString === molString)
      return false;
    const cxsmilesMolString = rdkitMol.get_cxsmiles();
    if (cxsmilesMolString === molString)
      return false;
    const inchiMolString = rdkitMol.get_inchi();
    if (inchiMolString === molString)
      return false;
    return true;

  }

  _molIsInSmiles(molString, rdkitMol) {

    // No, this won't always work (due to canonical)
    const smilesMolString = rdkitMol.get_smiles();
    return smilesMolString === molString;

  }

  _fetchMolGetOrCreate(molString, scaffoldMolString, molRegenerateCoords) {

    let mol = null;

    try {
      let validMol = false;
      mol = rdKitModule.get_mol(molString);
      if (mol.is_valid()) {
        // TODO: maybe split into 2 functions (with scaffold and without)
        if (molRegenerateCoords) {
          // "drop" the coordinate information from the molecule
          let rdkitMolNoCoords = rdKitModule.get_mol(mol.get_smiles());
          let molBlockString = rdkitMolNoCoords.get_molblock();
          rdkitMolNoCoords.delete();
          mol.delete();
          mol = rdKitModule.get_mol(molBlockString);
        }
        if (scaffoldMolString !== "") {
          // only after dropping, align to a given scaffold
          let rdkitScaffoldMol = this._fetchMol(scaffoldMolString, "", molRegenerateCoords, false);
          if (this._molIsInMolBlock(scaffoldMolString, rdkitScaffoldMol)) {
            const substructJson = mol.get_substruct_match(rdkitScaffoldMol);
            if (substructJson !== '{}') {
              mol.generate_aligned_coords(rdkitScaffoldMol, true);
            }
          }
        }
      } else {
        mol = rdKitModule.get_mol("");
      }
    } catch (e) {
      console.error(
        "Possibly a malformed molecule: `" + molString + "`");
      mol = null;
    }
    return mol;
  }

  _fetchMol(molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords) {
    const name = molString + " || " + scaffoldMolString + " || "
      + molRegenerateCoords + " || " + scaffoldRegenerateCoords;
    return this.molCache.getOrCreate(name, (s) =>
      this._fetchMolGetOrCreate(molString, scaffoldMolString, molRegenerateCoords));
  }

  _rendererGetOrCreate(width, height, molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords) {

    let rdkitMol = this._fetchMol(molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords);

    const canvasId = '_canvas-rdkit-' + this.canvasCounter;
    let canvas = window.document.createElement('canvas');
    canvas.setAttribute('id', canvasId);
    this.canvasCounter++;
    if (rdkitMol != null) {
      this._drawMoleculeToCanvas(rdkitMol, width, height, canvas);
    } else {
      let ctx = canvas.getContext("2d");
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#EFEFEF';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(0, height);
      ctx.stroke();
    }
    return {canvas: canvas, canvasId: canvasId};

  }

  _fetchRender(width, height, molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords) {

    const name = width + " || " + height + " || "
      + molString + " || " + scaffoldMolString  + " || "
      + molRegenerateCoords + " || " + scaffoldRegenerateCoords;
    return this.rendersCache.getOrCreate(name, (s) =>
      this._rendererGetOrCreate(width, height,
        molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords));

  }

  _drawMoleculeToCanvas(rdkitMol, w, h, canvas) {
    const opts = {
      "clearBackground": false,
      "offsetx": 0, "offsety": 0,
      "width": Math.floor(w),
      "height": Math.floor(h),
      "bondLineWidth": 1,
      "minFontSize": 11
    }
    canvas.width = w;
    canvas.height = h;
    rdkitMol.draw_to_canvas_with_highlights(canvas, JSON.stringify(opts));
  }

  _drawMolecule(x, y, w, h, onscreenCanvas,
                molString, scaffoldMolString,
                molRegenerateCoords, scaffoldRegenerateCoords) {

    const r = window.devicePixelRatio;
    x = r * x; y = r * y;
    w = r * w; h = r * h;
    const renderObj = this._fetchRender(w, h,
      molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords);
    let offscreenCanvas = renderObj.canvas;
    let image = offscreenCanvas.getContext('2d').getImageData(0, 0, w, h);
    let context = onscreenCanvas.getContext('2d');
    // As old zoom: context.drawImage(offscreenCanvas, x, y, w, h);
    context.putImageData(image, x, y);
  }

  render(g, x, y, w, h, gridCell, cellStyle) {

    let molString = gridCell.cell.value;
    if (molString == null || molString === '')
      return;

    // TODO: improve this piece
    const molCol = gridCell.tableColumn.dataFrame.columns.bySemType(DG.SEMTYPE.MOLECULE);
    let singleScaffoldMolString = molCol ? molCol.tags['chem-scaffold'] : null;

    const colTags = gridCell.tableColumn.tags;
    let molRegenerateCoords = colTags && colTags['regenerate-coords'] === 'true';
    let scaffoldRegenerateCoords = false;

    if (singleScaffoldMolString) {

      this._drawMolecule(x, y, w, h, g.canvas,
        molString, singleScaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords);

    } else {

      let df = gridCell.tableColumn.dataFrame;
      const rowScaffoldCol = (() => {

        // if given, take the 'scaffold-col' col
        let colTags = gridCell.tableColumn.tags;
        if (colTags && colTags['scaffold-col']) {
          let rowScaffoldColName = colTags['scaffold-col'];
          let rowScaffoldColProbe = df.columns.byName(rowScaffoldColName);
          if (rowScaffoldColProbe !== null) {
            const scaffoldColTags = rowScaffoldColProbe.tags;
            scaffoldRegenerateCoords = scaffoldColTags && scaffoldColTags['regenerate-coords'] === 'true';
            molRegenerateCoords = scaffoldRegenerateCoords;
            return rowScaffoldColProbe;
          }
        }
        return null;

      })();

      if (rowScaffoldCol == null || rowScaffoldCol.name === gridCell.tableColumn.name) {
        // regular drawing
        this._drawMolecule(x, y, w, h, g.canvas, molString, "", molRegenerateCoords, false);
      } else {
        // drawing with a per-row scaffold
        let idx = gridCell.tableRowIndex;
        let scaffoldMolString = df.get(rowScaffoldCol.name, idx);
        this._drawMolecule(x, y, w, h, g.canvas,
          molString, scaffoldMolString, molRegenerateCoords, scaffoldRegenerateCoords);
      }
    }
  }
}